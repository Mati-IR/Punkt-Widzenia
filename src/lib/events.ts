// Events ("wydarzenia") are the main entry point of the site, like stories on Ground News.
// Events live in data/events/events.json (title, neutral summary, framing comparison, matching
// rule); the AI events routine adds new ones every 2 h (docs/EVENTS.md). Articles come from the
// ingestion pipeline (data/articles/*.json) and are attached to an event by its title regex +
// time window, plus hand-picked `extra` links. Matching lives in scripts/events/lib.mjs so the
// routine's scripts see exactly what the site shows.
import { getCollection, type CollectionEntry } from 'astro:content';
import { EVENTS_FILE, readJson, loadArticles, matchArticles, retained, validateEvents } from '../../scripts/events/lib.mjs';

export type Side = 'left' | 'center' | 'right';
export type Camp = 'gov' | 'mixed' | 'opp';

export interface Article {
  outletId: string;
  title: string;
  url: string;
  publishedAt: string;
}
interface RawEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  tags: string[];
  summary: string[];
  framing: Record<Side, string>;
  match: { include: string; exclude?: string; from: string; to?: string };
  extra?: Article[];
  /** When the AI routine added the event (ISO). */
  addedAt?: string;
  /** Last change to the visible text (title, summary, framing…). Set by scripts/events/stamp.mjs, never by the build. */
  updatedAt?: string;
  /** Catch-all event for the biggest story: claims headlines after the specific events. */
  broad?: boolean;
}
type Outlet = CollectionEntry<'outlets'>;

export interface Coverage {
  outlet: Outlet;
  side: Side;
  camp: Camp;
  articles: Article[];
}
export interface NewsEvent extends Omit<RawEvent, 'match' | 'extra' | 'broad'> {
  coverage: Coverage[];
  articleCount: number;
  sourceCount: number;
  sides: Record<Side, number>;
  camps: Record<Camp, number>;
  pct: Record<Side, number>;
  campPct: Record<Camp, number>;
  ownership: [string, number][];
  missing: Outlet[];
  blindspot: Side | null;
  firstSeen: string;
  lastSeen: string;
}

/** Blindspot: one side's share of sources is at most MAX_SHARE while the other side has at least MIN_OTHER. */
export const BLINDSPOT = { MAX_SHARE: 15, MIN_OTHER: 30 };

export const sideOf = (o: Outlet): Side => {
  const v = o.data.leaning.classic.value;
  return v === 'left' || v === 'center-left' ? 'left' : v === 'center' ? 'center' : 'right';
};
export const campOf = (o: Outlet): Camp => {
  const v = o.data.leaning.polish.value;
  return v.includes('government') ? 'gov' : v.includes('opposition') ? 'opp' : 'mixed';
};
export const sideLabel: Record<Side, string> = { left: 'Lewica', center: 'Centrum', right: 'Prawica' };
export const campLabel: Record<Camp, string> = { gov: 'Prorządowe', mixed: 'Niezależne / mieszane', opp: 'Proopozycyjne' };
export const blindspotLabel: Record<Side, string> = {
  left: 'Pomijane przez lewicę',
  center: 'Pomijane przez centrum',
  right: 'Pomijane przez prawicę',
};

const pct = <K extends string>(counts: Record<K, number>, total: number) =>
  Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, total ? Math.round(((v as number) / total) * 100) : 0])) as Record<K, number>;

let cache: Promise<NewsEvent[]> | undefined;
export const getEvents = () => (cache ??= build());

async function build(): Promise<NewsEvent[]> {
  const all = readJson(EVENTS_FILE);
  const problems = validateEvents(all);
  if (problems.length) throw new Error(`${EVENTS_FILE} is invalid:\n- ${problems.join('\n- ')}`);
  const raw: RawEvent[] = retained(all);
  const outlets = await getCollection('outlets');
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const matched: Map<string, Article[]> = matchArticles(raw, loadArticles());

  const events = raw.map((e): NewsEvent => {
    const seen = new Set<string>();
    const list = matched
      .get(e.id)!
      .filter((a) => byId.has(a.outletId))
      .filter((a) => {
        const k = `${a.outletId}|${a.title.trim()}`;
        if (seen.has(k) || seen.has(a.url)) return false;
        seen.add(k).add(a.url);
        return true;
      })
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

    const groups = new Map<string, Article[]>();
    for (const a of list) groups.set(a.outletId, [...(groups.get(a.outletId) ?? []), a]);
    const coverage: Coverage[] = [...groups].map(([id, arts]) => {
      const outlet = byId.get(id)!;
      return { outlet, side: sideOf(outlet), camp: campOf(outlet), articles: arts };
    });
    coverage.sort((a, b) => b.articles.length - a.articles.length || a.outlet.data.name.localeCompare(b.outlet.data.name, 'pl'));

    const sides = { left: 0, center: 0, right: 0 } as Record<Side, number>;
    const camps = { gov: 0, mixed: 0, opp: 0 } as Record<Camp, number>;
    const own = new Map<string, number>();
    for (const c of coverage) {
      sides[c.side]++;
      camps[c.camp]++;
      own.set(c.outlet.data.ownership.category, (own.get(c.outlet.data.ownership.category) ?? 0) + 1);
    }
    const n = coverage.length;
    const p = pct(sides, n);
    let blindspot: Side | null = null;
    if (p.left <= BLINDSPOT.MAX_SHARE && p.right >= BLINDSPOT.MIN_OTHER) blindspot = 'left';
    else if (p.right <= BLINDSPOT.MAX_SHARE && p.left >= BLINDSPOT.MIN_OTHER) blindspot = 'right';

    const covered = new Set(coverage.map((c) => c.outlet.id));
    const { match: _m, extra: _x, broad: _b, ...rest } = e;
    return {
      ...rest,
      coverage,
      articleCount: list.length,
      sourceCount: n,
      sides,
      camps,
      pct: p,
      campPct: pct(camps, n),
      ownership: [...own].sort((a, b) => b[1] - a[1]),
      missing: outlets.filter((o) => !covered.has(o.id)).sort((a, b) => a.data.name.localeCompare(b.data.name, 'pl')),
      blindspot,
      firstSeen: list[0]?.publishedAt ?? e.date,
      lastSeen: list.at(-1)?.publishedAt ?? e.date,
    };
  });

  return rank(events);
}

/** Events active in the last TOP_HOURS (before the newest headline) lead the front page. */
export const TOP_HOURS = 48;

/**
 * Front-page order: events with a headline in the last TOP_HOURS, by number of sources;
 * then everything older, newest first. The home page shows the first 9; the rest load on scroll.
 */
function rank(events: NewsEvent[]): NewsEvent[] {
  const newest = events.reduce((m, e) => (e.lastSeen > m ? e.lastSeen : m), '');
  const since = newest ? new Date(Date.parse(newest) - TOP_HOURS * 3600e3).toISOString() : '';
  const byRecent = (a: NewsEvent, b: NewsEvent) => b.lastSeen.localeCompare(a.lastSeen);
  const top = events.filter((e) => e.lastSeen >= since).sort((a, b) => b.sourceCount - a.sourceCount || byRecent(a, b));
  const older = events.filter((e) => e.lastSeen < since).sort(byRecent);
  return [...top, ...older];
}

/** Infinite scroll on the home page: hero + FIRST_PAGE events in the HTML, then batches of PAGE_SIZE. */
export const FIRST_PAGE = 8;
export const PAGE_SIZE = 8;
export const feedUrl = (n: number) => `/feed/${n}.json`;
/** Events for feed page n (1-based), i.e. after the hero and the first page. */
export const feedPage = (events: NewsEvent[], n: number) =>
  events.slice(1 + FIRST_PAGE + (n - 1) * PAGE_SIZE, 1 + FIRST_PAGE + n * PAGE_SIZE);
export const feedPageCount = (events: NewsEvent[]) => Math.ceil(Math.max(0, events.length - 1 - FIRST_PAGE) / PAGE_SIZE);

export const AI_LABEL = 'Podsumowane przez sztuczną inteligencję';
/** "✦ Podsumowane przez sztuczną inteligencję · zaktualizowano 9 lis, 15:05". Time comes from the data, not the build. */
export const aiLabel = (e: { updatedAt?: string; addedAt?: string }) => {
  const t = e.updatedAt ?? e.addedAt;
  return t ? `${AI_LABEL} · zaktualizowano ${fmtDateTime(t)}` : AI_LABEL;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' } as Record<string, string>)[c]};`);

/** Thin L/C/P bar. Same markup as <BiasBar size="mini">. */
export const biasBarMiniHtml = (pct: Record<Side, number>) =>
  `<div class="bias mini" role="img" aria-label="${esc(`Rozkład źródeł: lewica ${pct.left}%, centrum ${pct.center}%, prawica ${pct.right}%`)}">` +
  (['left', 'center', 'right'] as const).filter((s) => pct[s] > 0).map((s) => `<span class="seg ${s}" style="flex-grow:${pct[s]}"></span>`).join('') +
  `</div>`;

/** One event in a list. Used by <EventRow> and by the feed JSON, so server and scroll-loaded rows look the same.
 *  The homepage hides the AI label (founder, PUN-38); the event page still carries it. */
export function eventRowHtml(e: NewsEvent, compact = false, showAiLabel = true): string {
  const d = dominant(e);
  return (
    `<article class="ev-row${compact ? ' compact' : ''}" data-id="${esc(e.id)}">` +
    (compact ? '' : `<p class="kicker">${esc(e.tags.slice(0, 2).join(' · '))}</p>`) +
    `<h3><a href="/wydarzenie/${esc(e.id)}/">${esc(e.title)}</a></h3>` +
    `<div class="ev-meta">${biasBarMiniHtml(e.pct)}` +
    `<span>${e.pct[d]}% ${sideLabel[d]} · ${e.sourceCount} źródeł · ${e.articleCount} art.</span>` +
    (e.blindspot ? `<span class="bs-badge">${blindspotLabel[e.blindspot]}</span>` : '') +
    `</div>` +
    (showAiLabel ? `<p class="ai-label">${esc(aiLabel(e))}</p>` : '') +
    `</article>`
  );
}

export const dominant = (e: NewsEvent): Side =>
  (Object.entries(e.pct) as [Side, number][]).sort((a, b) => b[1] - a[1])[0][0];

const tz = 'Europe/Warsaw';
export const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz });
export const initials = (name: string) =>
  name
    .replace(/[!.]/g, '')
    .split(/[\s-]+/)
    .filter((w) => /^[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('') || name.slice(0, 2);
