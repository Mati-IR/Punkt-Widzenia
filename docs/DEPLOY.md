# Deploy — Cloudflare Pages (free tier)

Cost: 0 zł. Free tier = unlimited static requests and bandwidth, 500 builds/month.
Every push to `main` deploys production; every PR gets its own preview URL.

## One-time setup (founder, ~10 min)

1. **GitHub repo.** Create an empty repo (e.g. `punkt-widzenia-site`), then from this folder:
   ```sh
   git remote add origin git@github.com:<you>/punkt-widzenia-site.git
   git push -u origin main
   ```
2. **Cloudflare Pages.** Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → pick the repo.
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables (Production and Preview):
     - `NODE_VERSION` = `22`
     - `SITE_URL` = `https://<project>.pages.dev` (or your own domain later)
3. **Branch protection (optional, recommended).** GitHub → Settings → Branches → protect `main`, require the `CI / build` check.

The site is then live at `https://<project>.pages.dev`.

## Correction form

For now `/zglos-poprawke/` shows only a "coming soon" notice (founder decision, PUN-7). No build variables are needed.
Every "Zgłoś poprawkę" link on the site points to that page, so a real form can go there later without touching any other page.

## Local (current setup — the site runs on localhost only for now)

```sh
npm ci
npm run dev            # http://localhost:4321 (live reload while editing data)
# or, to see exactly what will be published:
npm run build && npm run preview   # http://localhost:4321
```

## Cloudflare Worker + automatic redeploy after ingest

If the site was set up in the Workers flow (not Pages), `wrangler.jsonc` describes the Worker:
it serves `dist/` as static files, with no server code. Workers Builds settings:
build command `npm run build`, deploy command `npx wrangler deploy`, variables `NODE_VERSION=22`
and `SITE_URL=https://punkt-widzenia.<subdomain>.workers.dev`.

The production deploy command must be `npx wrangler deploy`. `npx wrangler preview` only uploads a
preview version and never updates the live site, so keep it for the non-production branch deploy
command, if you use one. `wrangler.jsonc` has an empty `previews` block so that command works too.

Ingest commits carry `[skip ci]`, so Cloudflare doesn't rebuild for them. Instead the ingest Action
(`.github/workflows/ingest.yml`, job `deploy`) rebuilds and deploys the Worker itself whenever a run
on `main` finds new headlines. It needs, in GitHub → Settings → Secrets and variables → Actions:

| Name | Kind | Value |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Cloudflare → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare dashboard → Workers & Pages → Account ID (right-hand side) |
| `SITE_URL` | Variable | The same `SITE_URL` as in Workers Builds |

Without the secrets the deploy job is skipped and ingest works as before. Deploys from the Action
don't count against Workers Builds' monthly build quota.
