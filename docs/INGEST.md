# Headline ingestion

Every 2 hours (and once right after any change to the pipeline is merged to `main`) a GitHub Action (`.github/workflows/ingest.yml`) fetches the latest headlines from all 30 outlets and commits them to the repo. No paid services, no dependencies.

## Files

| Path | Who edits it | What it is |
|---|---|---|
| `data/feeds.json` | people | Source registry: one entry per outlet in `data/outlets/` (`type`: `rss` / `sitemap` / `scrape`, `urls`, notes, date last verified). CI fails if an outlet has no entry. |
| `data/articles/YYYY-MM-DD.json` | the Action | Headlines, one file per publication day (Warsaw time), one record per line. Files older than 30 days are deleted. |
| `data/ingest/health.json` | the Action | Per-source report: status, error, items in source, new this run, articles in last 24 h, `lastSuccess`, `lastNewArticle`. |
| `data/ingest/seen.json` | the Action | URLs looked at and rejected (too old / no title), so they are not re-fetched. Pruned after 30 days. |
| `scripts/ingest/` | people | The fetcher (`ingest.mjs`) and parsers (`lib.mjs`). |

The same health table is shown on each Action run's summary page (Actions → Ingest headlines → a run).

**Target:** at least 27 of 30 sources fetching OK (`sourcesOk`, `meetsTarget` in `health.json`). The number of outlets with articles in the last 24 h is reported next to it but is not the target, because some small outlets publish only a few times a week. Polskie Radio's robots.txt blocks non-search bots; we respect it, so it shows as `blocked`.

## What we store (and what we don't)

Each record holds only: `outletId`, `title`, `lead` (≤ 300 characters, from the feed or the page's meta description), `url` (canonical), `publishedAt`, `fetchedAt`. **No article text** is stored. For sitemap and scrape sources the fetcher opens each new article page only to read its `<head>` metadata (title, description, publish time, canonical link).

## Source types

- **rss**: RSS or Atom feed.
- **sitemap**: sitemap or sitemap index. For an index, `children` (default 1) child sitemaps are read, picked by `childOrder` (`document`, `number-desc`, `lastmod-desc`). Titles come from Google News tags when present, otherwise from the article page.
- **scrape**: a listing page. Links matching `linkPattern` (a regex on the full URL) are treated as articles, and their metadata is read from the article page.

Sitemap and scrape sources open at most 20 new article pages per run, newest first. The rest are picked up on the next run.

## Politeness

- The fetcher identifies itself as `PunktWidzeniaBot` and **obeys robots.txt**. A source that robots.txt disallows is reported as `blocked`, not fetched.
- Low volume: one request per feed every 2 h, plus up to 40 article pages per sitemap/scrape source.
- Items published more than 7 days before they are found are skipped.

## Running it locally

```sh
node scripts/ingest/ingest.mjs --dry-run              # fetch everything and print the report, write nothing
node scripts/ingest/ingest.mjs --dry-run --only tvn24 # one source
node scripts/ingest/ingest.mjs --check                # validate data/feeds.json (also runs in CI)
```

## Fixing a broken source

1. Open the latest run summary or `data/ingest/health.json` to see the error.
2. Find a working URL (feed link in the page's `<head>`, `robots.txt` → `Sitemap:`, or a listing page).
3. Edit the entry in `data/feeds.json`, test it with `--dry-run --only <id>`, update `verified`, and open a PR.
