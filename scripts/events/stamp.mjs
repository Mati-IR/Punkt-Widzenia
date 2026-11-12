// Sets `updatedAt` on events whose visible content changed since a git revision (default HEAD).
// Run by the events routine (and by people editing events) just before committing.
// Builds never touch `updatedAt`, so an event's "zaktualizowano" time only moves when its text does.
//
//   node scripts/events/stamp.mjs              # compare with HEAD, stamp changed/new events with "now"
//   node scripts/events/stamp.mjs --base <rev> # compare with another revision, e.g. origin/master
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { EVENTS_FILE, readJson, visibleContent } from './lib.mjs';

const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'HEAD';
let before = [];
try {
  before = JSON.parse(execFileSync('git', ['show', `${base}:${EVENTS_FILE}`], { encoding: 'utf8' }));
} catch {
  console.warn(`No ${EVENTS_FILE} at ${base}; treating every event as new.`);
}
const old = new Map(before.map((e) => [e.id, visibleContent(e)]));
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const events = readJson(EVENTS_FILE);
const stamped = [];
for (const e of events) {
  if (old.get(e.id) === visibleContent(e)) continue;
  e.updatedAt = old.has(e.id) ? now : (e.addedAt ?? now);
  stamped.push(e.id);
}
if (stamped.length) writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2) + '\n');
console.log(stamped.length ? `updatedAt set on: ${stamped.join(', ')}` : 'No content changes; updatedAt untouched.');
