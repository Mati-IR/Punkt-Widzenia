// Input for the AI events routine (docs/EVENTS.md): prints, compactly,
//  1. open events (still collecting headlines, or active in the last 24 h) with their match rule, and
//  2. headlines fetched since the last run that no existing event has claimed.
//
//   node scripts/events/headlines.mjs                 # since the cursor in data/events/state.json
//   node scripts/events/headlines.mjs --hours 12      # ignore the cursor, look back 12 h
//   node scripts/events/headlines.mjs --leads         # also print leads (longer output)
//   node scripts/events/headlines.mjs --mark          # move the cursor to the newest headline seen; prints nothing else
import { existsSync, writeFileSync } from 'node:fs';
import { EVENTS_FILE, readJson, loadArticles, matchArticles, retained, windowEnd } from './lib.mjs';

const STATE = 'data/events/state.json';
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};

const articles = loadArticles();
const newestFetch = articles.reduce((m, a) => (a.fetchedAt > m ? a.fetchedAt : m), '');

if (args.includes('--mark')) {
  writeFileSync(STATE, JSON.stringify({ lastRunAt: newestFetch }, null, 2) + '\n');
  console.log(`Cursor set to ${newestFetch}`);
  process.exit(0);
}

const state = existsSync(STATE) ? readJson(STATE) : {};
const now = Date.now();
const hours = opt('--hours');
const since = hours
  ? new Date(now - Number(hours) * 3600e3).toISOString()
  : state.lastRunAt ?? new Date(now - 6 * 3600e3).toISOString();

// Outlet sides, as on the site: L = left/centre-left, C = centre, P = right/centre-right.
const side = {};
for (const a of new Set(articles.map((a) => a.outletId))) {
  const path = `data/outlets/${a}.json`;
  if (!existsSync(path)) continue;
  const o = readJson(path);
  if (o.published !== true) continue;
  const v = o.leaning.classic.value;
  side[a] = v === 'left' || v === 'center-left' ? 'L' : v === 'center' ? 'C' : 'P';
}

const events = retained(readJson(EVENTS_FILE));
const matched = matchArticles(events, articles);
const claimed = new Set([...matched.values()].flat().map((a) => a.url));

const recent = new Date(now - 24 * 3600e3).toISOString();
const open = events.filter((e) => windowEnd(e) > recent || (matched.get(e.id) ?? []).some((a) => a.publishedAt > recent));
const time = (iso) => new Date(iso).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

console.log(`Now ${new Date(now).toISOString()} · headlines fetched after ${since} · newest fetch ${newestFetch}`);
console.log(`\n## Open events (${open.length}) — id | date | window | sources | include /exclude/`);
for (const e of open) {
  const outlets = new Set((matched.get(e.id) ?? []).map((a) => a.outletId)).size;
  console.log(`${e.id} | ${e.date} | ${e.match.from} → ${windowEnd(e)}${e.match.to ? '' : ' (default)'} | ${outlets} | ${e.match.include}${e.match.exclude ? ` /${e.match.exclude}/` : ''}`);
  console.log(`   ${e.title}`);
}

const fresh = articles.filter((a) => a.fetchedAt > since && side[a.outletId] && !claimed.has(a.url));
console.log(`\n## Unclaimed new headlines (${fresh.length}) — published (Warsaw) | side outlet | title`);
for (const a of fresh) {
  console.log(`${time(a.publishedAt)} | ${side[a.outletId]} ${a.outletId} | ${a.title}`);
  if (args.includes('--leads') && a.lead) console.log(`      ${a.lead.slice(0, 200)}`);
}
