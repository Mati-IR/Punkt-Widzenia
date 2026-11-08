// Events ("wydarzenia") are the main entry point of the site, like stories on Ground News.
// An event is curated in data/events/events.json (title, neutral summary, framing comparison,
// matching rule). Articles come from the ingestion pipeline (data/articles/*.json) and are
// attached to an event by its title regex + time window, plus hand-picked `extra` links.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';

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
  match: { include: string; exclude?: string; from: string; to: string };
  extra: Article[];
}
type Outlet = CollectionEntry<'outlets'>;

export interface Coverage {
  outlet: Outlet;
  side: Side;
  camp: Camp;
  articles: Article[];
}
export interface NewsEvent extends Omit<RawEvent, 'match' | 'extra'> {
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

/** Multi-topic digests ("5 ważnych tematów na dziś") are not about one event. */
const DIGEST = /\d+ (ważnych )?temat|Kumulacja wydarzeń/i;

function loadArticles(): Article[] {
  const dir = 'data/articles';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Article[]);
}

const pct = <K extends string>(counts: Record<K, number>, total: number) =>
  Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, total ? Math.round(((v as number) / total) * 100) : 0])) as Record<K, number>;

let cache: Promise<NewsEvent[]> | undefined;
export const getEvents = () => (cache ??= build());

async function build(): Promise<NewsEvent[]> {
  const raw: RawEvent[] = JSON.parse(readFileSync('data/events/events.json', 'utf8'));
  const outlets = await getCollection('outlets');
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const articles = loadArticles();
  const used = new Set<string>();

  // Specific events claim articles first; a broad "catch-all" event (the biggest story) goes last.
  const catchAll = (e: RawEvent) => e.id === 'zamach-krakow';
  const order = [...raw.filter((e) => !catchAll(e)), ...raw.filter(catchAll)];
  const matched = new Map<string, Article[]>();
  for (const e of order) {
    const inc = new RegExp(e.match.include, 'i');
    const exc = e.match.exclude ? new RegExp(e.match.exclude, 'i') : null;
    const hits = articles.filter(
      (a) =>
        !used.has(a.url) &&
        a.publishedAt >= e.match.from &&
        a.publishedAt < e.match.to &&
        inc.test(a.title) &&
        !exc?.test(a.title) &&
        !DIGEST.test(a.title),
    );
    hits.forEach((a) => used.add(a.url));
    matched.set(e.id, [...hits, ...e.extra]);
  }

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
    const { match: _m, extra: _x, ...rest } = e;
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

  // Rank like a front page: number of sources first, then recency.
  return events.sort((a, b) => b.sourceCount - a.sourceCount || b.date.localeCompare(a.date));
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
