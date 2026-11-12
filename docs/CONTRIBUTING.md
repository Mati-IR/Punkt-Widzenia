# Branches and reviews (PUN-91)

- `main` = production. The live site deploys from `main`.
- `dev` = development and the GitHub default branch. Cloudflare builds every push to `dev` as a
  preview version with a stable URL (`dev-punkt-widzenia.<subdomain>.workers.dev`).

## Code changes (all agents)
1. Branch from `origin/dev` in your own worktree (never switch branches in the shared checkout).
2. Open a PR into `dev`. Never push directly to `dev` or `main`.
3. The PR needs two required checks: `CI / build` and `Review gate / review-gate`.
   The review gate passes with labels `approved-legal` **and** `approved-cos`, or `approved-founder`.
4. Legal analyst and Chief of staff review the change, record the verdict on the Paperclip issue,
   then add their label. Only the reviewer adds their own label. Chief of staff merges.
5. Releases: a PR `dev` -> `main`. Only the founder approves it (`approved-founder`) and merges.

Headlines and events data follow a separate flow, see docs/INGEST.md and docs/EVENTS.md.
