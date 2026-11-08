import { defineCollection } from 'astro:content';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outletSchema, formatIssues } from './lib/dataset';
import { sources } from './lib/data';

/**
 * Outlets collection — dataset schema v0.2 (see src/lib/dataset.ts and docs/DATASET.md).
 * Reads data/outlets/*.json. The build fails if a published record breaks any rule.
 * Records with "published": false are left out of the site; problems in them are only warnings.
 */
const DIR = 'data/outlets';
const schema = outletSchema(new Set(sources.map((s) => s.id)));

const outlets = defineCollection({
  loader: {
    name: 'outlets-v0.2',
    load: async ({ store, parseData, logger, watcher }) => {
      store.clear();
      const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
      for (const file of files) {
        const path = join(DIR, file);
        let data: any;
        try {
          data = JSON.parse(readFileSync(path, 'utf8'));
        } catch (e) {
          throw new Error(`${path}: not valid JSON (${(e as Error).message})`);
        }
        const fileId = file.replace(/\.json$/, '');
        if (data?.id !== fileId) throw new Error(`${path}: "id" is "${data?.id}" but must equal the file name "${fileId}"`);

        if (data.published !== true) {
          const res = schema.safeParse(data);
          if (!res.success) logger.warn(`${path} (unpublished) has problems to fix before publishing:\n${formatIssues(res.error)}`);
          continue;
        }
        const parsed = await parseData({ id: fileId, data, filePath: path });
        store.set({ id: fileId, data: parsed, filePath: path });
      }
      watcher?.add(DIR);
    },
  },
  schema,
});

export const collections = { outlets };
