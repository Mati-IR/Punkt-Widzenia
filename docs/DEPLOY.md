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
