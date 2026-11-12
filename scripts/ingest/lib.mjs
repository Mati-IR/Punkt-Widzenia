// Parsing helpers for the headline ingester. Dependency-free on purpose:
// the Action runs every 30 min and must stay well under a minute (no npm install).

export const UA = 'Mozilla/5.0 (compatible; PunktWidzeniaBot/0.1; +https://punkt-widzenia.pages.dev/metodologia/)';
export const ROBOTS_TOKEN = 'punktwidzeniabot';
export const LEAD_MAX = 200;   // keep only a very short fragment (PUN-63 legal report: no full leads)

// ---------- text ----------

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  bdquo: '„', rdquo: '”', ldquo: '“', rsquo: '’', lsquo: '‘', sbquo: '‚', laquo: '«', raquo: '»',
  oacute: 'ó', Oacute: 'Ó', middot: '·', bull: '•', shy: '', zwnj: '', copy: '©', reg: '®', deg: '°',
  eacute: 'é', aacute: 'á', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', times: '×', euro: '€',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}

/** CDATA/HTML -> plain single-line text. Runs entity decoding twice: some feeds double-escape. */
export function cleanText(s) {
  if (!s) return '';
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = decodeEntities(t);
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  t = decodeEntities(t);
  return t.replace(/\s+/g, ' ').trim();
}

/** Truncate to <= max chars at a word boundary, with an ellipsis. */
export function shorten(s, max = LEAD_MAX) {
  if (!s || s.length <= max) return s || '';
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:–—-]+$/, '') + '…';
}

// ---------- dates ----------

function warsawOffsetMinutes(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs) / 60000;
}

/** Parse a feed/meta date to ISO UTC. Zone-less ISO-like times are taken as Europe/Warsaw. */
export function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  if (/^\d{10}$|^\d{13}$/.test(s)) return new Date(Number(s) * (s.length === 10 ? 1000 : 1)).toISOString(); // epoch
  const naive = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
  if (naive) {
    const [, y, mo, d, h = '0', mi = '0', se = '0'] = naive;
    const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
    const ms = asUtc - warsawOffsetMinutes(asUtc) * 60000;
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function warsawDay(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(iso)); // YYYY-MM-DD
}

// ---------- URLs ----------

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ocid|srcc|cmpid|at_[a-z_]+|_ga|igshid|ref|ref_src|xtor|wt_mc)$/i;

/** Canonical form of an article URL: https, no fragment, no tracking params, sorted query. */
export function canonicalUrl(raw, base) {
  let u;
  try { u = new URL(String(raw).trim(), base); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.protocol = 'https:';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  const keep = [...u.searchParams].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  u.search = keep.length ? '?' + new URLSearchParams(keep).toString() : '';
  return u.href;
}

/** Dedupe key: canonical URL without scheme, leading "www." and trailing slash. */
export function urlKey(canon) {
  const u = new URL(canon);
  return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + u.search;
}

// ---------- XML (RSS / Atom / sitemaps) ----------

function blocks(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

function field(block, ...tags) {
  for (const t of tags) {
    const m = block.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i'));
    if (m && m[1].trim()) return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  }
  return '';
}

function attr(tagSrc, name) {
  const m = tagSrc.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3]) : null;
}

/** RSS 2.0 / RSS 1.0 / Atom -> [{url, title, lead, published}] */
export function parseFeed(xml, base) {
  const out = [];
  const items = blocks(xml, 'item');
  if (items.length) {
    for (const b of items) {
      const link = cleanText(field(b, 'link')) || (field(b, 'guid').startsWith('http') ? cleanText(field(b, 'guid')) : '');
      out.push({
        url: link,
        title: cleanText(field(b, 'title')),
        lead: cleanText(field(b, 'description', 'summary')),
        published: parseDate(cleanText(field(b, 'pubDate', 'dc:date', 'published', 'updated'))),
      });
    }
  } else {
    for (const b of blocks(xml, 'entry')) {
      const links = [...b.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
      const alt = links.find((l) => !/rel\s*=/.test(l) || /rel\s*=\s*["']alternate["']/i.test(l)) || links[0] || '';
      out.push({
        url: attr(alt, 'href') || '',
        title: cleanText(field(b, 'title')),
        lead: cleanText(field(b, 'summary', 'content')),
        published: parseDate(cleanText(field(b, 'published', 'updated'))),
      });
    }
  }
  return out.map((i) => ({ ...i, url: canonicalUrl(i.url, base) })).filter((i) => i.url);
}

/** Sitemap index -> [{loc, lastmod}] (empty if the document is a urlset). */
export function parseSitemapIndex(xml) {
  return blocks(xml, 'sitemap').map((b) => ({ loc: cleanText(field(b, 'loc')), lastmod: parseDate(cleanText(field(b, 'lastmod'))) }));
}

/** Sitemap urlset (incl. Google News extension) -> [{url, title, published, lastmod}] in document order. */
export function parseUrlset(xml, base) {
  return blocks(xml, 'url').map((b) => ({
    url: canonicalUrl(cleanText(field(b, 'loc')), base),
    title: cleanText(field(b, 'news:title')),
    published: parseDate(cleanText(field(b, 'news:publication_date'))),
    lastmod: parseDate(cleanText(field(b, 'lastmod'))),
  })).filter((i) => i.url);
}

// ---------- HTML ----------

/** All link targets in a page (incl. JSON-embedded ones in SPA payloads), resolved, in first-seen order. */
export function extractLinks(html, pageUrl) {
  const t = html.replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    const c = canonicalUrl(decodeEntities(raw), pageUrl);
    if (c && !seen.has(c)) { seen.add(c); out.push(c); }
  };
  for (const m of t.matchAll(/href\s*=\s*\\?["']([^"'\\\s<>]+)/gi)) add(m[1]);
  for (const m of t.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) add(m[0]);
  return out;
}

function jsonLdDates(html) {
  const out = {};
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const dp = m[1].match(/"datePublished"\s*:\s*"([^"]+)"/);
    const hl = m[1].match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (dp && !out.published) out.published = dp[1];
    if (hl && !out.headline) { try { out.headline = JSON.parse(`"${hl[1]}"`); } catch {} }
  }
  return out;
}

/** Article page -> {title, lead, published, canonical}. Reads only <head>-style metadata, never body text. */
export function parseArticleMeta(html, pageUrl) {
  const head = html.slice(0, 400_000);
  const meta = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attr(m[0], 'property') || attr(m[0], 'name') || attr(m[0], 'itemprop') || '').toLowerCase();
    const content = attr(m[0], 'content');
    if (key && content != null && !(key in meta)) meta[key] = content;
  }
  const ld = jsonLdDates(head);
  const titleTag = (head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const canonTag = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((l) => /rel\s*=\s*["']canonical["']/i.test(l));
  const timeTag = (head.match(/<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/i) || [])[1];
  const dates = [meta['article:published_time'], meta['og:article:published_time'], ld.published,
    meta['datepublished'], meta['publication_date'], meta['pubdate'], meta['dc.date'], timeTag];
  let title = cleanText(meta['og:title'] || meta['twitter:title'] || ld.headline || titleTag || '');
  const site = cleanText(meta['og:site_name'] || '');
  if (site) for (const sep of [' - ', ' | ', ' – ', ' — ']) if (title.endsWith(sep + site)) title = title.slice(0, -(sep + site).length);
  return {
    title,
    lead: cleanText(meta['og:description'] || meta['description'] || meta['twitter:description'] || ''),
    published: dates.map(parseDate).find(Boolean) || null,
    canonical: canonTag ? canonicalUrl(attr(canonTag, 'href'), pageUrl) : null,
  };
}

// ---------- robots.txt (RFC 9309, simplified) ----------

export function parseRobots(txt) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && ROBOTS_TOKEN.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules).filter((r) => r.path !== '');
}

function ruleMatches(path, pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(path);
}

/** true if `url` may be fetched under `rules` (longest match wins; allow wins ties). */
export function robotsAllows(rules, url) {
  const u = new URL(url);
  const path = u.pathname + u.search;
  let best = null;
  for (const r of rules) {
    if (!ruleMatches(path, r.path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !best || best.allow;
}
