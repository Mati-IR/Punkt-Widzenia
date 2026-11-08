import { z } from 'astro/zod';

/**
 * Dataset schema v0.2 (+ reliability.provisional, PUN-8) — agreed with the Media Research Analyst on PUN-6
 * (document `dataset-schema` on PUN-2). Field meanings: docs/DATASET.md.
 *
 * Files (repo root):
 *   data/outlets/<id>.json  one per outlet; file name must equal `id`; `id` is the URL /media/<id>/
 *   data/sources.json       shared bibliography, referenced by `sourceId` / `sourceIds`
 *   data/meta.json          dataset + methodology version
 *
 * This module only defines shapes and rules. Display labels live in src/lib/labels.ts.
 */

// ---- Enums (kebab-case) ----------------------------------------------------
export const TYPE = ['tv', 'radio', 'daily', 'weekly', 'monthly', 'portal', 'online', 'youtube', 'podcast'] as const;
export const SEGMENT = ['mainstream', 'independent'] as const;
export const CLASSIC = ['left', 'center-left', 'center', 'center-right', 'right'] as const;
export const POLISH = [
  'government-aligned',
  'leans-government',
  'independent-mixed',
  'leans-opposition',
  'opposition-aligned',
] as const;
export const OWNERSHIP = ['state-public', 'polish-private', 'foreign', 'church-linked', 'party-linked', 'reader-funded'] as const;
export const CHAIN_LEVEL = ['brand', 'publisher', 'owner', 'ultimate-owner'] as const;
export const FUNDING = [
  'advertising',
  'subscriptions',
  'copy-sales',
  'donations',
  'crowdfunding',
  'platform-revenue',
  'public-funding',
  'grants',
] as const;
export const REACH_METRIC = [
  'tv-share',
  'tv-avg-viewers',
  'radio-share',
  'real-users',
  'print-sales',
  'youtube-subscribers',
  'patrons',
  'daily-listeners',
] as const;
export const RELIABILITY = ['high', 'mixed', 'low'] as const;
export const SOURCE_TYPE = ['research', 'regulator', 'factcheck', 'register', 'court', 'outlet', 'sample', 'press'] as const;

// ---- Primitives ------------------------------------------------------------
export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = z.string().regex(ID_RE, 'use [a-z0-9-] only, e.g. "tvn24"');
const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'YYYY-MM-DD');
const period = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/, 'YYYY, YYYY-MM or YYYY-Qn');
const url = z.url();
/** PL is required, EN optional — the site falls back to PL. */
const text = z.object({ pl: z.string().min(1), en: z.string().min(1).optional() }).strict();
const axis = z.number().int().min(-2).max(2);
const score = z.number().int().min(0).max(2);

const rated = {
  rationale: text,
  sourceIds: z.array(id).min(1),
  asOf: date,
  contested: z.boolean().default(false),
};

// ---- sources.json / meta.json ---------------------------------------------
export const sourceSchema = z
  .object({
    id,
    title: z.string().min(1),
    publisher: z.string().optional(),
    url: url.optional(),
    date: date.optional(),
    accessed: date,
    type: z.enum(SOURCE_TYPE),
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;

export const sourcesSchema = z.array(sourceSchema).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((s, i) => {
    if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate source id "${s.id}"` });
    seen.add(s.id);
  });
});

export const metaSchema = z
  .object({
    datasetVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'semver, e.g. 0.2.0'),
    methodologyVersion: z.string().min(1),
    updated: date,
  })
  .strict();

// ---- Outlet record ---------------------------------------------------------
export const outletShape = z
  .object({
    id,
    published: z.boolean(),
    name: z.string().min(1),
    type: z.enum(TYPE),
    segment: z.enum(SEGMENT),
    url: url.optional(),
    description: text,
    reach: z
      .array(
        z
          .object({
            metric: z.enum(REACH_METRIC),
            value: z.number().nonnegative(),
            unit: z.string().optional(),
            period,
            sourceId: id,
          })
          .strict(),
      )
      .default([]),
    leaning: z
      .object({
        classic: z.object({ value: z.enum(CLASSIC), economic: axis, sociocultural: axis, ...rated }).strict(),
        polish: z.object({ value: z.enum(POLISH), ...rated }).strict(),
      })
      .strict(),
    ownership: z
      .object({
        category: z.enum(OWNERSHIP),
        secondaryTags: z.array(z.enum(OWNERSHIP)).default([]),
        chain: z
          .array(
            z
              .object({
                level: z.enum(CHAIN_LEVEL),
                name: z.string().min(1),
                country: z.string().regex(/^[A-Z]{2}$/, 'ISO-2, e.g. PL').optional(),
                share: z.number().gt(0).max(100).optional(),
                sourceId: id,
              })
              .strict(),
          )
          .min(1),
        fundingModel: z.array(z.enum(FUNDING)).min(1),
        asOf: date,
      })
      .strict(),
    reliability: z
      .object({
        factualRecord: score,
        corrections: score,
        transparency: score,
        total: z.number().int().min(0).max(6),
        label: z.enum(RELIABILITY),
        ...rated,
        /** true = based only on our check of the outlet's own site, no fact-checker review yet (shown as "Wstępna"). */
        provisional: z.boolean().default(false),
      })
      .strict(),
    lastReviewed: date,
    changelog: z.array(z.object({ date, change: text }).strict()).default([]),
  })
  .strict();
export type Outlet = z.infer<typeof outletShape>;

/** Reliability label from total (methodology: 5–6 high, 3–4 mixed, 0–2 low). */
export const labelFor = (total: number) => (total >= 5 ? 'high' : total >= 3 ? 'mixed' : 'low');

/**
 * Allowed classic values for an (economic, sociocultural) pair.
 * Integer average → exactly one value. x.5 average → either neighbour (methodology §1.5),
 * and the record must then be `contested: true` so the founder picks.
 */
export function classicFor(economic: number, sociocultural: number) {
  const avg = (economic + sociocultural) / 2; // −2…+2, step 0.5
  const idx = (n: number) => CLASSIC[n + 2];
  return Number.isInteger(avg)
    ? { allowed: [idx(avg)], boundary: false }
    : { allowed: [idx(Math.floor(avg)), idx(Math.ceil(avg))], boundary: true };
}

/** Collect every source id an outlet references, with its JSON path. */
function sourceRefs(o: Outlet): Array<[string, (string | number)[]]> {
  const refs: Array<[string, (string | number)[]]> = [];
  o.reach.forEach((r, i) => refs.push([r.sourceId, ['reach', i, 'sourceId']]));
  o.ownership.chain.forEach((c, i) => refs.push([c.sourceId, ['ownership', 'chain', i, 'sourceId']]));
  const lists: Array<[string[], (string | number)[]]> = [
    [o.leaning.classic.sourceIds, ['leaning', 'classic', 'sourceIds']],
    [o.leaning.polish.sourceIds, ['leaning', 'polish', 'sourceIds']],
    [o.reliability.sourceIds, ['reliability', 'sourceIds']],
  ];
  for (const [ids, path] of lists) ids.forEach((s, i) => refs.push([s, [...path, i]]));
  return refs;
}

/** Full outlet schema: shape + the cross-field rules that must fail the build. */
export const outletSchema = (sourceIds: Set<string>) =>
  outletShape.superRefine((o, ctx) => {
    const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const r = o.reliability;

    const sum = r.factualRecord + r.corrections + r.transparency;
    if (r.total !== sum) fail(['reliability', 'total'], `total is ${r.total} but the 3 scores add up to ${sum}`);
    if (r.label !== labelFor(r.total))
      fail(['reliability', 'label'], `label "${r.label}" does not match total ${r.total} (expected "${labelFor(r.total)}")`);

    const c = o.leaning.classic;
    const { allowed, boundary } = classicFor(c.economic, c.sociocultural);
    if (!allowed.includes(c.value))
      fail(['leaning', 'classic', 'value'], `"${c.value}" does not match economic ${c.economic} / sociocultural ${c.sociocultural} (expected ${allowed.map((a) => `"${a}"`).join(' or ')})`);
    if (boundary && !c.contested)
      fail(['leaning', 'classic', 'contested'], `average is x.5 (boundary case, methodology §1.5): set "contested": true`);

    if (o.ownership.secondaryTags.includes(o.ownership.category))
      fail(['ownership', 'secondaryTags'], `secondaryTags repeats the main category "${o.ownership.category}"`);

    for (const [sid, path] of sourceRefs(o))
      if (!sourceIds.has(sid)) fail(path, `sourceId "${sid}" is not in data/sources.json`);
  });

/** Turn a zod error into readable lines: "leaning.classic.value: message". */
export const formatIssues = (err: z.ZodError) =>
  err.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
