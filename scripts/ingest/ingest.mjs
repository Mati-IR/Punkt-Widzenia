#!/usr/bin/env node
// Headline ingester: reads data/feeds.json, fetches every outlet's source, stores
// headline records in data/articles/YYYY-MM-DD.json and a per-source report in
// data/ingest/health.json. See docs/INGEST.md.
//
//   node scripts/ingest/ingest.mjs            full run (writes files)
//   node scripts/ingest/ingest.mjs --dry-run  fetch + report, write nothing
//   node scripts/ingest/ingest.mjs --check    validate the registry only (CI)
//   node scripts/ingest/ingest.mjs --only tvn24,wpolityce
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UA, LEAD_MAX, cleanText, shorten, canonicalUrl, urlKey, warsawDay,
  parseFeed, parseSitemapIndex, parseUrlset, extractLinks, parseArticleMeta, parseRobots, robotsAllows,
} from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTLETS_DIR = path.join(ROOT, 'data/outlets');
const REGISTRY = path.join(ROOT, 'data/feeds.json');
const ARTICLES_DIR = path.join(ROOT, 'data/articles');
const INGEST_DIR = path.join(ROOT, 'data/ingest');
const HEALTH = path.join(INGEST_DIR, 'health.json');
const SEEN = path.join(INGEST_DIR, 'seen.json');

const RETENTION_DAYS = 365;    // day files older than this are deleted (founder decision 2026-11-09)
const MAX_AGE_DAYS = 7;        // newly found items published earlier than this are skipped
const MAX_PAGE_FETCHES = 40;   // per sitemap/scrape source per run (new article pages; sized for a 2-h cadence)
const PAGE_CONCURRENCY = 3;    // per source
const MAX_CANDIDATES = 100;    // newest sitemap/listing entries looked at per run
const FETCH_TIMEOUT_MS = 15_000;
const HOST_GAP_MS = 500;       // politeness: at least this long between two requests to the same host (PUN-64)
const TARGET_OUTLETS = 27;
const DAY = 86_400_000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const CHECK = args.includes('--check');
const onlyArg = args.find((a) => a.startsWith('--only'));
const ONLY = onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1]).split(',') : null;

const START = Date.now();
const DEADLINE = START + Number(process.env.INGEST_BUDGET_MS || 90_000);
const NOW_ISO = new Date(START).toISOString();

const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };

// ---------- registry ----------

function loadRegistry() {
  const outletIds = fs.readdirSync(OUTLETS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  const raw = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const reg = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('$')));
  const problems = [];
  for (const id of outletIds) if (!reg[id]) problems.push(`${id}: outlet has no entry in data/feeds.json`);
  for (const [id, c] of Object.entries(reg)) {
    if (!outletIds.includes(id)) problems.push(`${id}: registry entry has no data/outlets/${id}.json`);
    if (!['rss', 'sitemap', 'scrape'].includes(c.type)) problems.push(`${id}: type must be rss | sitemap | scrape`);
    if (!Array.isArray(c.urls) || !c.urls.length || c.urls.some((u) => !/^https:\/\//.test(u))) problems.push(`${id}: urls must be a non-empty list of https URLs`);
    if (c.paused !== undefined && (typeof c.paused !== 'string' || !c.paused.trim())) problems.push(`${id}: paused must be a non-empty reason string`);
    if (c.type === 'scrape') {
      try { new RegExp(c.linkPattern); } catch { problems.push(`${id}: scrape sources need a valid linkPattern`); }
      if (!c.linkPattern) problems.push(`${id}: scrape sources need a linkPattern`);
    }
    if (c.childOrder && !['document', 'number-desc', 'lastmod-desc'].includes(c.childOrder)) problems.push(`${id}: childOrder must be document | number-desc | lastmod-desc`);
  }
  return { reg, outletIds, problems };
}

// ---------- fetching (robots-aware) ----------

class SkipError extends Error { constructor(kind, msg, status) { super(msg); this.kind = kind; this.status = status; } }

const robotsCache = new Map();
function robotsFor(origin) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(origin, (async () => {
      try {
        const r = await fetch(origin + '/robots.txt', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10_000) });
        if (r.status >= 400 && r.status < 500) return [];               // no robots.txt -> allowed
        if (!r.ok) return null;                                          // 5xx -> unreachable
        return parseRobots(await r.text());
      } catch { return null; }
    })());
  }
  return robotsCache.get(origin);
}

function decodeBody(buf, contentType) {
  const head = Buffer.from(buf.slice(0, 2048)).toString('latin1');
  const cs = (contentType.match(/charset=([\w-]+)/i) || head.match(/encoding=["']([\w-]+)["']/i) || head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  try { return new TextDecoder(cs || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

// Plain headers on purpose: one WAF (wPolityce) refuses some q-weighted Accept + Accept-Language combinations.
// Per-host throttle: requests to one host start at least HOST_GAP_MS apart, whatever the concurrency.
const hostNext = new Map();
async function hostSlot(origin) {
  const now = Date.now();
  const at = Math.max(now, hostNext.get(origin) ?? 0);
  hostNext.set(origin, at + HOST_GAP_MS);
  if (at > now) await new Promise((res) => setTimeout(res, at - now));
}

async function get(url) {
  const left = DEADLINE - Date.now();
  if (left < 2_000) throw new SkipError('deadline', 'run time budget used up');
  const rules = await robotsFor(new URL(url).origin);
  if (rules === null) throw new SkipError('error', 'robots.txt unreachable (treated as disallow)');
  if (!robotsAllows(rules, url)) throw new SkipError('blocked', `robots.txt disallows ${new URL(url).pathname}`);
  let r;
  // Up to three plain retries on transient refusals (wPolityce's Cloudflare refuses the first request or two from a new client, then serves the same URL).
  for (let attempt = 0; attempt < 4; attempt++) {
    await hostSlot(new URL(url).origin);
    try {
      r = await fetch(url, {
        headers: { 'user-agent': UA, accept: '*/*' },
        redirect: 'follow', signal: AbortSignal.timeout(Math.max(1_000, Math.min(FETCH_TIMEOUT_MS, DEADLINE - Date.now() - 1_000))),
      });
    } catch (e) {
      throw new SkipError('error', e.name === 'TimeoutError' ? 'timeout' : String(e.cause?.code || e.message));
    }
    if (r.ok || ![403, 429, 500, 502, 503, 504].includes(r.status) || DEADLINE - Date.now() < 5_000) break;
    await r.arrayBuffer().catch(() => {});
    await new Promise((res) => setTimeout(res, 2_000 * (attempt + 1)));
  }
  if (!r.ok) throw new SkipError('error', `HTTP ${r.status} on ${new URL(url).pathname}`, r.status);
  return { status: r.status, url: r.url, text: decodeBody(new Uint8Array(await r.arrayBuffer()), r.headers.get('content-type') || '') };
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// ---------- sources ----------

/** Fill title/lead/published from article pages for up to MAX_PAGE_FETCHES unseen candidates. */
async function enrich(cands, known, seen, stats) {
  stats.items = cands.length;
  // Only the newest MAX_CANDIDATES entries are considered: at a 2-h cadence that is plenty,
  // and it stops us walking back through months of undated sitemap entries.
  const fresh = cands.slice(0, MAX_CANDIDATES).filter((c) => !known.has(urlKey(c.url)) && !seen.has(urlKey(c.url)));
  const todo = fresh.slice(0, MAX_PAGE_FETCHES);
  stats.deferred = fresh.length - todo.length;
  const res = await pool(todo, PAGE_CONCURRENCY, async (c) => {
    try {
      const page = await get(c.url);
      const m = parseArticleMeta(page.text, page.url);
      const sameSite = m.canonical && new URL(m.canonical).hostname.replace(/^www\./, '') === new URL(c.url).hostname.replace(/^www\./, '');
      return { url: sameSite ? m.canonical : c.url, altKey: urlKey(c.url), title: c.title || m.title, lead: m.lead, published: c.published || m.published };
    } catch (e) {
      stats.pageErrors = (stats.pageErrors || 0) + 1;
      stats.lastPageError = e.message;
      return c.title ? { ...c, lead: '' } : null;   // news sitemap entries still usable without a lead
    }
  });
  return res.filter(Boolean);
}

async function runRss(cfg, stats) {
  const all = [];
  for (const u of cfg.urls) {
    const r = await get(u);
    stats.httpStatus = r.status;
    all.push(...parseFeed(r.text, r.url));
  }
  stats.items = all.length;
  return all;
}

function numberIn(u) { const m = u.match(/(\d+)(?!.*\d)/); return m ? Number(m[1]) : -1; }

async function runSitemap(cfg, ctx, stats) {
  let entries = [];
  for (const u of cfg.urls) {
    const r = await get(u);
    stats.httpStatus = r.status;
    let children = parseSitemapIndex(r.text);
    if (!children.length) { entries.push(...parseUrlset(r.text, r.url)); continue; }
    if (cfg.childOrder === 'number-desc') children.sort((a, b) => numberIn(b.loc) - numberIn(a.loc));
    else if (cfg.childOrder === 'lastmod-desc') children.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''));
    for (const c of children.slice(0, cfg.children || 1)) {
      const cr = await get(c.loc);
      entries.push(...parseUrlset(cr.text, cr.url));
    }
  }
  const cutoff = new Date(START - MAX_AGE_DAYS * DAY).toISOString();
  entries = entries.filter((e) => !(e.published || e.lastmod) || (e.published || e.lastmod) >= cutoff);
  if (entries.some((e) => e.published || e.lastmod)) {
    entries = entries.map((e, i) => ({ e, i }))
      .sort((a, b) => ((b.e.published || b.e.lastmod || '').localeCompare(a.e.published || a.e.lastmod || '')) || a.i - b.i)
      .map(({ e }) => e);
  }
  return enrich(entries.map((e) => ({ url: e.url, title: e.title, published: e.published })), ctx.known, ctx.seen, stats);
}

async function runScrape(cfg, ctx, stats) {
  const re = new RegExp(cfg.linkPattern);
  const links = [];
  for (const u of cfg.urls) {
    const r = await get(u);
    stats.httpStatus = r.status;
    for (const l of extractLinks(r.text, r.url)) if (re.test(l) && !links.includes(l)) links.push(l);
  }
  return enrich(links.map((url) => ({ url })), ctx.known, ctx.seen, stats);
}

// ---------- store ----------

function loadStore() {
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  const oldest = warsawDay(new Date(START - RETENTION_DAYS * DAY).toISOString());
  const days = new Map();
  const pruned = [];
  for (const f of fs.readdirSync(ARTICLES_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
    const day = f.slice(0, 10);
    if (day < oldest) { pruned.push(f); continue; }
    days.set(day, readJson(path.join(ARTICLES_DIR, f), []));
  }
  return { days, pruned };
}

const serialize = (recs) => (recs.length ? '[\n' + recs.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n' : '[]\n');

// ---------- main ----------

async function main() {
  const { reg, outletIds, problems } = loadRegistry();
  if (problems.length) {
    console.error('Registry problems:\n- ' + problems.join('\n- '));
    if (CHECK) process.exit(1);
  }
  if (CHECK) { console.log(`data/feeds.json OK: ${Object.keys(reg).length} sources for ${outletIds.length} outlets.`); return; }

  const { days, pruned } = loadStore();
  const known = new Set();
  for (const recs of days.values()) for (const r of recs) known.add(urlKey(r.url));
  const seenRaw = readJson(SEEN, {});
  const seenCutoff = new Date(START - RETENTION_DAYS * DAY).toISOString().slice(0, 10);
  const seenOut = Object.fromEntries(Object.entries(seenRaw).filter(([, d]) => d >= seenCutoff));
  const seen = new Set(Object.keys(seenOut));
  const prev = readJson(HEALTH, { sources: {} }).sources || {};
  const ctx = { known, seen };

  const ids = Object.keys(reg).filter((id) => !ONLY || ONLY.includes(id)).sort();
  const results = await Promise.all(ids.map(async (id) => {
    const cfg = reg[id];
    const stats = { items: 0 };
    let recs = [];
    let status = 'ok';
    let error = null;
    // `paused` (a reason string) stops fetching an outlet, e.g. after a publisher's opt-out (docs/TAKEDOWN.md).
    if (cfg.paused) return { id, cfg, recs, status: 'paused', error: String(cfg.paused), stats };
    try {
      recs = cfg.type === 'rss' ? await runRss(cfg, stats) : cfg.type === 'sitemap' ? await runSitemap(cfg, ctx, stats) : await runScrape(cfg, ctx, stats);
      if (!stats.items) status = 'empty';
    } catch (e) {
      status = e.kind || 'error';
      error = e.message;
      stats.httpStatus = e.status;
    }
    return { id, cfg, recs, status, error, stats };
  }));

  // merge
  const maxAge = new Date(START - MAX_AGE_DAYS * DAY).toISOString();
  const future = new Date(START + 3_600_000).toISOString();
  const added = {};
  for (const { id, recs } of results) {
    added[id] = 0;
    for (const r of recs) {
      const title = shorten(cleanText(r.title), 300);
      const key = urlKey(r.url);
      if (known.has(key) || (r.altKey && known.has(r.altKey))) continue;
      const publishedAt = r.published && r.published <= future ? r.published : NOW_ISO;
      if (!title || publishedAt < maxAge) {
        seenOut[key] = NOW_ISO.slice(0, 10);
        if (r.altKey) seenOut[r.altKey] = NOW_ISO.slice(0, 10);
        continue;
      }
      known.add(key);
      if (r.altKey) known.add(r.altKey);
      const day = warsawDay(publishedAt);
      if (day < warsawDay(new Date(START - RETENTION_DAYS * DAY).toISOString())) continue;
      if (!days.has(day)) days.set(day, []);
      days.get(day).push({ outletId: id, title, lead: shorten(cleanText(r.lead), LEAD_MAX), url: r.url, publishedAt, fetchedAt: NOW_ISO });
      added[id]++;
    }
  }

  // health
  const since24 = new Date(START - DAY).toISOString();
  const count24 = {};
  for (const recs of days.values()) for (const r of recs) if (r.publishedAt >= since24) count24[r.outletId] = (count24[r.outletId] || 0) + 1;
  const sources = {};
  for (const { id, cfg, status, error, stats } of results) {
    const p = prev[id] || {};
    sources[id] = {
      type: cfg.type,
      status,
      ...(error ? { error } : {}),
      ...(stats.httpStatus ? { httpStatus: stats.httpStatus } : {}),
      itemsInSource: stats.items || 0,
      newArticles: added[id],
      ...(stats.deferred ? { deferredToNextRun: stats.deferred } : {}),
      ...(stats.pageErrors ? { articlePageErrors: stats.pageErrors, lastArticlePageError: stats.lastPageError } : {}),
      articles24h: count24[id] || 0,
      lastSuccess: status === 'ok' ? NOW_ISO : p.lastSuccess || null,
      lastNewArticle: added[id] ? NOW_ISO : p.lastNewArticle || null,
    };
  }
  if (ONLY) for (const [id, s] of Object.entries(prev)) if (!sources[id]) sources[id] = s;
  const allIds = Object.keys(reg).sort();
  const with24 = allIds.filter((id) => (count24[id] || 0) > 0);
  // Target (founder decision, PUN-13): count sources fetching OK; the 24 h article count is tracked alongside.
  const healthy = allIds.filter((id) => sources[id] && sources[id].status === 'ok');
  const health = {
    generatedAt: NOW_ISO,
    runSeconds: Math.round((Date.now() - START) / 1000),
    sourcesOk: healthy.length,
    outletsWithArticles24h: with24.length,
    outletsTotal: allIds.length,
    target: TARGET_OUTLETS,
    targetMetric: 'sourcesOk',
    meetsTarget: healthy.length >= TARGET_OUTLETS,
    failing: allIds.filter((id) => sources[id] && sources[id].status !== 'ok'),
    noArticles24h: allIds.filter((id) => !(count24[id] > 0)),
    sources: Object.fromEntries(allIds.filter((id) => sources[id]).map((id) => [id, sources[id]])),
  };

  const totalNew = Object.values(added).reduce((a, b) => a + b, 0);
  const lines = [
    `## Headline ingest — ${NOW_ISO}`,
    '',
    `**${healthy.length}/${allIds.length}** sources fetching OK (target ${TARGET_OUTLETS}). ${with24.length}/${allIds.length} outlets have articles from the last 24 h. New this run: ${totalNew}. Run time: ${health.runSeconds}s.`,
    '',
    '| Outlet | Type | Status | New | 24 h | Last success | Note |',
    '|---|---|---|---:|---:|---|---|',
    ...allIds.filter((id) => sources[id]).map((id) => {
      const s = sources[id];
      const icon = s.status === 'ok' ? (s.articles24h ? '✅' : '🟡') : '❌';
      const note = [s.error, s.deferredToNextRun ? `${s.deferredToNextRun} deferred` : '', s.articlePageErrors ? `${s.articlePageErrors} page errors (${s.lastArticlePageError})` : ''].filter(Boolean).join('; ');
      return `| ${id} | ${s.type} | ${icon} ${s.status} | ${s.newArticles} | ${s.articles24h} | ${s.lastSuccess ? s.lastSuccess.slice(0, 16).replace('T', ' ') : '—'} | ${note.replace(/\|/g, '/')} |`;
    }),
    '',
  ];
  const summary = lines.join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');

  if (DRY) { console.log('(dry run: nothing written)'); return; }
  for (const f of pruned) fs.unlinkSync(path.join(ARTICLES_DIR, f));
  for (const [day, recs] of days) {
    const p = path.join(ARTICLES_DIR, `${day}.json`);
    const s = serialize(recs);
    if (readFileOr(p) !== s) fs.writeFileSync(p, s);
  }
  fs.mkdirSync(INGEST_DIR, { recursive: true });
  fs.writeFileSync(HEALTH, JSON.stringify(health, null, 2) + '\n');
  const seenLines = Object.entries(seenOut).sort(([a], [b]) => a.localeCompare(b)).map(([k, d]) => `${JSON.stringify(k)}:${JSON.stringify(d)}`);
  fs.writeFileSync(SEEN, seenLines.length ? '{\n' + seenLines.join(',\n') + '\n}\n' : '{}\n');
}

function readFileOr(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

main().catch((e) => { console.error(e); process.exit(1); });
