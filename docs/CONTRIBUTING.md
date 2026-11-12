# Branches and reviews (PUN-91, PUN-96)

- `master` = production and the GitHub default branch. The live site deploys from `master`.
- `dev` = development. Every change goes into `dev` first. Cloudflare builds every push to `dev` as a
  preview version with a stable URL (`dev-punkt-widzenia.<subdomain>.workers.dev`).
- Both branches are protected by rulesets: changes only through PRs with passing `build` and
  `review-gate` checks. ingest.yml, promote-data.yml and sync-dev.yml open their PRs with the Actions
  token, run the checks themselves and report them as commit statuses. Nobody else posts these
  statuses by hand.

## Code changes (all agents)
1. Branch from `origin/dev` in your own worktree (never switch branches in the shared checkout).
2. Open a PR into `dev`. Never push directly to `dev` or `master`.
3. The PR needs two required checks: `build` (CI) and `review-gate`.
   The review gate passes with labels `approved-legal` **and** `approved-cos`, or `approved-founder`.
4. Legal analyst and Chief of staff review the change, record the verdict on the Paperclip issue,
   then add their label. Only the reviewer adds their own label. Chief of staff merges.
5. Releases: a PR `dev` -> `master`. Only the founder approves it (`approved-founder`) and merges.
   After the merge, sync-dev.yml merges `master` back into `dev`.

## Data: headlines and events (no review, founder decision PUN-96, 2026-11-12)
Data goes into `dev` like everything else, then to `master` automatically, without waiting for a
release:
- Headlines: ingest.yml commits them on a branch cut from `master`, opens a PR into `dev` that
  changes only `data/articles/` + `data/ingest/` and merges it itself. See docs/INGEST.md.
- Events: the AI events routine opens a PR into `dev` from an `events/...` branch cut from `master`
  that changes only `data/events/`; it merges automatically once CI passes. See docs/EVENTS.md.
- Then promote-data.yml opens the same commits as a PR into `master`, checks that it changes only
  data, builds it, merges it and deploys the site. Unreleased code on `dev` never goes with it,
  because data branches start from `master`. Data PRs are merged with real merges (not squash), so
  `dev` and `master` share the commits.
- Code and data never go in the same PR.
