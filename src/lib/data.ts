import rawSources from '../../data/sources.json';
import rawMeta from '../../data/meta.json';
import { sourcesSchema, metaSchema, formatIssues, type Source } from './dataset';

function parse<T>(file: string, schema: { safeParse: (v: unknown) => any }, value: unknown): T {
  const res = schema.safeParse(value);
  if (!res.success) throw new Error(`${file} is invalid:\n${formatIssues(res.error)}`);
  return res.data;
}

export const sources = parse<Source[]>('data/sources.json', sourcesSchema, rawSources);
export const sourceById = new Map(sources.map((s) => [s.id, s]));
export const meta = parse<{ datasetVersion: string; methodologyVersion: string; updated: string }>(
  'data/meta.json',
  metaSchema,
  rawMeta,
);

/** Dataset versions below 1.0.0 are drafts: the site shows a "wersja robocza" notice. */
export const isDraft = meta.datasetVersion.startsWith('0.');

/** Resolve source ids to full records (ids are already checked at build time). */
export const resolve = (ids: string[]) => ids.map((id) => sourceById.get(id)!).filter(Boolean);
