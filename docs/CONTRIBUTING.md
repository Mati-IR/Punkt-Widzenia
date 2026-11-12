# Branches and reviews (PUN-91)

- `main` = production. The live site deploys from `main`.
- `dev` = development and the GitHub default branch. Cloudflare builds every push to `dev` as a
  preview version with a stable URL (`dev-punkt-widzenia.<subdomain>.workers.dev`).
- Both branches are protected by rulesets: changes only through PRs with passing `build` and
  `review-gate` checks. ingest.yml and sync-dev.yml open their PRs with the Actions token, run the
  checks themselves and report them as commit statuses. Nobody else posts these statuses by hand.

## Code changes (all agents)
1. Branch from `origin/dev` in your own worktree (never switch branches in the shared checkout).
2. Open a PR into `dev`. Never push directly to `dev` or `main`.
3. The PR needs two required checks: `build` (CI) and `review-gate`.
   The review gate passes with labels `approved-legal` **and** `approved-cos`, or `approved-founder`.
4. Legal analyst and Chief of staff review the change, record the verdict on the Paperclip issue,
   then add their label. Only the reviewer adds their own label. Chief of staff merges.
5. Releases: a PR `dev` -> `main`. Only the founder approves it (`approved-founder`) and merges.

## Data (no review, founder decision 2026-11-12)
- Headlines: ingest.yml opens a PR into `main` that changes only `data/articles/` + `data/ingest/`
  and merges it itself. See docs/INGEST.md.
- Events: the AI events routine opens a PR into `main` from an `events/...` branch that changes only
  `data/events/`; it merges automatically once CI passes. See docs/EVENTS.md.
- After anything lands on `main`, sync-dev.yml merges `main` into `dev`.
- Code and data never go in the same PR.
