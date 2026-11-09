// Shared by the site build (src/lib/events.ts) and the events routine scripts (check.mjs, headlines.mjs).
// No dependencies. See docs/EVENTS.md for the file format and the routine's procedure.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EVENTS_FILE = 'data/events/events.json';
export const ARTICLES_DIR = 'data/articles';
export const RETENTION_DAYS = 365; // events whose date is older than this are left out (founder decision 2026-11-09)
export const DEFAULT_WINDOW_H = 72; // a match window without `to` stays open this long after `from`

const DAY = 86400e3;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Multi-topic digests ("5 ważnych tematów na dziś") are not about one event. */
export const DIGEST = /\d+ (ważnych )?temat|Kumulacja wydarzeń/i;

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** All stored headlines, oldest first. */
export function loadArticles(dir = ARTICLES_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => readJson(join(dir, f)))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}

/** End of an event's match window (ISO). */
export const windowEnd = (e) => e.match.to ?? new Date(Date.parse(e.match.from) + DEFAULT_WINDOW_H * 3600e3).toISOString();

/** Events still inside the retention period (by `date`), relative to `now`. */
export const retained = (events, now = Date.now()) => {
  const cutoff = new Date(now - RETENTION_DAYS * DAY).toISOString().slice(0, 10);
  return events.filter((e) => e.date >= cutoff);
};

/** Returns a list of problems (empty = valid). */
export function validateEvents(events) {
  const errs = [];
  if (!Array.isArray(events)) return ['events.json must be an array'];
  const ids = new Set();
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  events.forEach((e, i) => {
    const at = `event #${i + 1} (${e?.id ?? 'no id'})`;
    const bad = (msg) => errs.push(`${at}: ${msg}`);
    if (!e || typeof e !== 'object') return bad('not an object');
    if (!str(e.id) || !SLUG.test(e.id)) bad('"id" must be a lowercase slug like "marsz-niepodleglosci-2026"');
    else if (ids.has(e.id)) bad('duplicate "id"');
    else ids.add(e.id);
    if (!str(e.title) || e.title.length > 160) bad('"title" is required (max 160 characters)');
    if (!DATE.test(e.date ?? '')) bad('"date" must be YYYY-MM-DD');
    if (!str(e.location)) bad('"location" is required');
    if (!Array.isArray(e.tags) || e.tags.length < 1 || !e.tags.every(str)) bad('"tags" must be a non-empty list of strings');
    if (!Array.isArray(e.summary) || e.summary.length < 2 || e.summary.length > 6 || !e.summary.every(str)) bad('"summary" must have 2–6 non-empty bullet points');
    if (!e.framing || !['left', 'center', 'right'].every((s) => str(e.framing[s]))) bad('"framing" needs non-empty "left", "center" and "right"');
    const m = e.match;
    if (!m || typeof m !== 'object') bad('"match" is required');
    else {
      for (const k of ['include', 'exclude']) {
        if (k === 'include' && !str(m.include)) bad('"match.include" is required');
        if (m[k] !== undefined) {
          try { new RegExp(m[k], 'i'); } catch (err) { bad(`"match.${k}" is not a valid regex: ${err.message}`); }
        }
      }
      if (!ISO.test(m.from ?? '')) bad('"match.from" must be an ISO UTC time like 2026-11-09T06:00:00Z');
      if (m.to !== undefined && (!ISO.test(m.to) || m.to <= m.from)) bad('"match.to" must be an ISO UTC time after "from" (or left out)');
    }
    if (e.extra !== undefined && (!Array.isArray(e.extra) || !e.extra.every((a) => str(a?.outletId) && str(a?.title) && str(a?.url) && ISO.test(a?.publishedAt ?? ''))))
      bad('"extra" must be a list of {outletId, title, url, publishedAt}');
    if (e.addedAt !== undefined && !ISO.test(e.addedAt)) bad('"addedAt" must be an ISO UTC time');
    if (e.broad !== undefined && typeof e.broad !== 'boolean') bad('"broad" must be true or false');
  });
  return errs;
}

/** First index in sorted `articles` with publishedAt >= iso. */
function lowerBound(articles, iso) {
  let lo = 0, hi = articles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (articles[mid].publishedAt < iso) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Attaches headlines to events: title matches `include`, not `exclude`, published inside the window.
 * Each headline goes to one event only. Specific events claim first; `broad` (catch-all) events last.
 * `articles` must be sorted by publishedAt. Returns Map(eventId -> articles incl. `extra`).
 */
export function matchArticles(events, articles) {
  const used = new Set();
  const matched = new Map();
  const order = [...events.filter((e) => !e.broad), ...events.filter((e) => e.broad)];
  for (const e of order) {
    const inc = new RegExp(e.match.include, 'i');
    const exc = e.match.exclude ? new RegExp(e.match.exclude, 'i') : null;
    const to = windowEnd(e);
    const hits = [];
    for (let i = lowerBound(articles, e.match.from); i < articles.length && articles[i].publishedAt < to; i++) {
      const a = articles[i];
      if (!used.has(a.url) && inc.test(a.title) && !exc?.test(a.title) && !DIGEST.test(a.title)) hits.push(a);
    }
    hits.forEach((a) => used.add(a.url));
    matched.set(e.id, [...hits, ...(e.extra ?? [])]);
  }
  return matched;
}
