# Takedown and infringement reports (internal procedure)

Reports come by e-mail from the form at `/zglos-naruszenie/` (subject starts with `[Zgłoszenie naruszenia]`). The contact address is set in `src/lib/site.ts`.

## SLA

- **Within 48 hours** (`TAKEDOWN_SLA_HOURS`): reply to the sender. Either the content is removed, or we explain why it stays, or we ask for missing details.
- If the report looks plausible and checking will take longer, **hide the content first**, then check.
- Keep a short log (date received, sender, URL, decision, date closed) in a private note. Do not commit it to the repo: it contains personal data.

## How to remove things

| What | How |
|---|---|
| One headline | Delete its line from `data/articles/YYYY-MM-DD.json` and add its URL to `data/ingest/seen.json` (key = host without `www.` + path without trailing slash, e.g. `"tvn24.pl/polska/abc-123": "2026-11-11"`, like the other keys) so it is not fetched again. If it was hand-picked, also remove it from `extra` in `data/events/events.json`. |
| An event summary (AI text) | Edit or delete the event in `data/events/events.json`, then `node scripts/events/check.mjs`. |
| All headlines from one publisher (opt-out) | In `data/feeds.json` add `"paused": "opt-out <date>, <who>"` to the outlet's entry. The fetcher then skips it and reports it as `paused`. Delete its existing lines from `data/articles/` if the publisher asks. |
| An outlet's rating or description | Do not change it yourself: pass the report to the Media Research Analyst (methodology owner). |

Open a PR with the change; the site rebuilds when it is released to `master`.

## What we show (keeps reports rare)

- Only the headline, the outlet's name as text and a link to the original article. No article text, no photos, no logos.
- Stored leads are cut to 200 characters and are used only as input for the AI event summaries, never shown.
- AI-written text carries the label „Podsumowane przez sztuczną inteligencję”.
- The fetcher obeys robots.txt, prefers RSS and spaces requests to one host (docs/INGEST.md).
