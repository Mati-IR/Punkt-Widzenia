// Validates data/events/events.json (also runs in CI) and shows what each event's match rule catches.
//
//   node scripts/events/check.mjs                  # validate; list events from the last 3 days with source counts
//   node scripts/events/check.mjs --show <id>      # list the headlines attached to one event
//   node scripts/events/check.mjs --prune          # drop events older than the retention period (365 days)
import { writeFileSync } from 'node:fs';
import { EVENTS_FILE, RETENTION_DAYS, readJson, loadArticles, matchArticles, retained, validateEvents, windowEnd } from './lib.mjs';

const args = process.argv.slice(2);
const all = readJson(EVENTS_FILE);
const problems = validateEvents(all);
if (problems.length) {
  console.error(`${EVENTS_FILE}: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

if (args.includes('--prune')) {
  const keep = retained(all);
  writeFileSync(EVENTS_FILE, JSON.stringify(keep, null, 2) + '\n');
  console.log(`Removed ${all.length - keep.length} event(s) older than ${RETENTION_DAYS} days; ${keep.length} left.`);
  process.exit(0);
}

const events = retained(all);
const matched = matchArticles(events, loadArticles());
const showId = args[args.indexOf('--show') + 1];

if (args.includes('--show')) {
  const list = matched.get(showId);
  if (!list) {
    console.error(`No event "${showId}".`);
    process.exit(1);
  }
  for (const a of [...list].sort((x, y) => x.publishedAt.localeCompare(y.publishedAt))) console.log(`${a.publishedAt.slice(0, 16)} ${a.outletId.padEnd(20)} ${a.title}`);
  console.log(`${list.length} headlines, ${new Set(list.map((a) => a.outletId)).size} outlets`);
  process.exit(0);
}

const since = new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10);
console.log(`OK: ${all.length} events valid (${events.length} within ${RETENTION_DAYS} days).`);
for (const e of events.filter((e) => e.date >= since)) {
  const list = matched.get(e.id) ?? [];
  console.log(`${String(new Set(list.map((a) => a.outletId)).size).padStart(3)} outlets ${String(list.length).padStart(4)} art. | ${e.id} (to ${windowEnd(e).slice(0, 16)})`);
}
