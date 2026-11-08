# Dataset (schema v0.2)

The agreed spec is the `dataset-schema` document on PUN-2. The code that enforces it is `src/lib/dataset.ts`.

## Where the data lives
| File | What it holds |
|---|---|
| `data/outlets/<id>.json` | One outlet. The file name must equal `id`, and the page is `/media/<id>/`. |
| `data/sources.json` | Every source, listed once. Outlets point to it by `sourceId` / `sourceIds`. |
| `data/meta.json` | `datasetVersion`, `methodologyVersion`, `updated`. A version below `1.0.0` shows the "wersja robocza" (draft) notice. |

To update the site, edit these files and open a PR. No code changes are needed.

## What makes the build fail
For published records (`"published": true`):
- a field is missing, has the wrong format, or uses a value not on the allowed lists
- `id` does not match the file name
- `reliability.total` ≠ factualRecord + corrections + transparency
- `reliability.label` does not match the total (5–6 `high`, 3–4 `mixed`, 0–2 `low`)
- `leaning.classic.value` does not match the average of `economic` and `sociocultural`
  - when the average is x.5 (e.g. −1 and 0), either neighbouring value is accepted, but `contested` must be `true` (methodology §1.5)
- a `sourceId` is not in `data/sources.json`
- `pl` text is missing (`en` is optional; the site shows Polish)

Records with `"published": false` are left off the site. Any problems in them only show as warnings.

## Check locally
```
npm install
npm run build     # validates all data, then builds the site into dist/
```

## Current data (v0.5.0)
`data/outlets/` holds the 30 approved outlets (20 mainstream, 10 independent), researched on 2026-11-08 (PUN-3). All 30 are `"published": true` after the founder's decisions of 2026-11-08:
- Polish-axis ratings without the content sample are published with `contested: true` (shown as "sporne"). The sample runs in parallel for v1.1.
- Reliability ratings with no external source are published with `"provisional": true` inside `reliability` (optional, default `false`). The site shows a "Wstępna" badge and a one-line explanation, so `rationale.pl` no longer carries the "Ocena wstępna:" prefix.
- Fact-check sweep (PUN-9, v0.5.0): 9 of the 26 provisional ratings now cite an outlet-specific external source, mainly the KRRiT 2025 annual report (`krrit-sprawozdanie-2025`). 17 stay provisional because the sweep found no outlet-specific external record. Notes and the script that applied the changes are in `research/reliability-sweep/`.
- The 13 left–right boundary cases (§1.5) use the values the founder approved. They keep `contested: true`, because the build requires it for x.5 averages.

The review list is the `dataset-review` document on PUN-3.
