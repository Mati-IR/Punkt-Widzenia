# Events ("wydarzenia") and the AI events routine

Events are the stories on the home page. Each one has a neutral summary, a left / centre / right framing comparison and a rule that attaches headlines from `data/articles/` to it. Every event on the site carries the label **„Podsumowane przez sztuczną inteligencję”**.

Every 2 hours a Paperclip routine ("AI events routine") opens a task for an agent. The agent follows the procedure below: it reads new headlines, adds new events and extends ongoing ones, and pushes straight to `main`. The push triggers the Cloudflare build, so new events go live within minutes. Founder decision, PUN-13 / PUN-38 (2026-11-09).

## Files

| Path | Who edits it | What it is |
|---|---|---|
| `data/events/events.json` | the routine (and people, for corrections) | All events, newest last. Events whose `date` is more than 365 days old are not shown and can be removed with `check.mjs --prune`. |
| `data/events/state.json` | the routine | `lastRunAt`: the newest headline fetch the routine has already looked at. |
| `scripts/events/lib.mjs` | people | Validation and headline matching, shared by the site build and the scripts. |
| `scripts/events/headlines.mjs` | people | Prints open events and new headlines that no event has claimed (the routine's input). |
| `scripts/events/check.mjs` | people | Validates `events.json` (also in CI and in the build) and shows what each rule matches. |

## Event format

```json
{
  "id": "sp-perspektywa-ratingu",
  "title": "S&P obniża perspektywę ratingu Polski do negatywnej",
  "date": "2026-11-06",
  "location": "Warszawa",
  "tags": ["Gospodarka", "Finanse publiczne"],
  "summary": ["2–6 neutral, factual bullet points"],
  "framing": { "left": "…", "center": "…", "right": "…" },
  "match": { "include": "rating", "exclude": "optional regex", "from": "2026-11-06T00:00:00Z", "to": "optional, default from + 72 h" },
  "extra": [],
  "addedAt": "2026-11-09T14:05:00Z",
  "updatedAt": "2026-11-09T14:05:00Z"
}
```

- `labelEvidence` (optional): only when `title`/`summary` must use an extremist label; names the solid proof. See step 4.
- `id`: lowercase slug, unique, never changed once published (it is the page URL `/wydarzenie/<id>/`).
- `match.include` / `exclude`: case-insensitive regex on the headline **title**. A headline goes to one event only; events with `"broad": true` (a catch-all for the biggest story) claim last.
- `match.from` / `to`: ISO UTC. Without `to` the window is 72 h after `from`. To keep an ongoing story collecting headlines, move `to` forward.
- `extra`: optional hand-picked links `{outletId, title, url, publishedAt}`.
- `updatedAt`: when the visible text (title, date, location, tags, summary, framing) last changed. Shown next to the AI label as „zaktualizowano 9 lis, 15:05”. Never set it by hand: `node scripts/events/stamp.mjs` sets it only on events whose text differs from the last commit. The build never changes it, and new headlines being attached do not count as an update.

## Home page order and infinite scroll

Events with a headline in the last 48 h come first, ranked by number of sources; everything older follows, newest first. The home page HTML holds the hero + 8 events; the rest load as you scroll, 8 at a time, from static files `/feed/1.json`, `/feed/2.json`, … built with the site. No backend.

## Routine procedure (for the agent)

Keep each run short. Budget: one pass, no web browsing; work only from the headlines in the repo.

1. **Get a clean copy of `main`** in a separate worktree, so the shared project checkout is not touched:
   ```sh
   W=../events-routine
   [ -d "$W" ] || git worktree add --detach "$W" origin/main
   cd "$W" && git fetch -q origin && git checkout -q --detach origin/main
   ```
2. **Read the input:** `node scripts/events/headlines.mjs` (add `--leads` only if you need more context for a story).
3. **Decide.**
   - **New event**: a story covered by **at least 3 different outlets** among the unclaimed headlines, about one concrete event in or about Poland. Skip digests, horoscopes, sport results, local trivia, ads, and stories with only 1–2 outlets (they can become events on a later run; their earlier headlines will still be attached by `match.from`).
   - **Ongoing event**: if new headlines continue an open event, extend its `match.include` and/or `match.to` instead of creating a duplicate. You may update its `summary` with new facts.
   - At most ~6 new events per run. Nothing worth adding is a normal outcome.
4. **Write each new event** (Polish):
   - `title`: factual, ≤ 120 characters, no outlet's loaded wording.
   - `summary`: 2–5 bullets, facts only, attribute claims ("według prokuratury…"). Use only what the headlines/leads say; do not guess.
   - **Extremist labels** ("skrajna prawica/lewica", "radykalna prawica", "far-right", "faszyści", "ekstremiści"…) are claims, not facts. Never put them in `title` or `summary`; describe what the person/group did or said instead. You may report them in `framing` attributed to whoever used them ("OKO.press nazywa…"). Only with very solid evidence (court ruling, official designation by a state body, or the group's own self-description) may a label appear in title/summary, and then the event must carry `"labelEvidence": "<what the proof is, with source>"`. `check.mjs` enforces this.
   - `framing`: how left (L), centre (C) and right (P) outlets in the headlines present it, with short quoted headline fragments. If a side has no coverage, say so ("Brak publikacji redakcji lewicowych w monitorowanych źródłach.").
   - `match`: a regex that catches this story's headlines and not others; `from` ≈ first headline time minus a few hours; leave out `to` unless needed. `addedAt`: now (UTC). `date`: the day the event happened (YYYY-MM-DD).
   - Do not change outlet data, ratings or methodology.
5. **Check:** `node scripts/events/check.mjs` must print `OK`; for each new event run `node scripts/events/check.mjs --show <id>` and fix the regex if it caught unrelated headlines or missed obvious ones. Each new event must match ≥ 3 outlets.
6. **Stamp updates:** `node scripts/events/stamp.mjs` (sets `updatedAt` on new and edited events only).
7. **Move the cursor:** `node scripts/events/headlines.mjs --mark`.
8. **Publish** (no `[skip ci]`: the push must trigger the build):
   ```sh
   git add data/events
   git commit -m "events: +N new, M updated (AI routine)"
   git push origin HEAD:main || { git pull --rebase origin main && git push origin HEAD:main; }
   ```
   If nothing changed except the cursor, still commit and push it with `[skip ci]` in the message.
9. Close the routine task with one line: new event ids and updated ids, or "no new events".

## Corrections

A person can edit or delete any event in `events.json` through a normal PR. To stop the routine, pause it in Paperclip (Routines → AI events routine). If 2 h proves too costly, change its schedule to every 4–6 h.
