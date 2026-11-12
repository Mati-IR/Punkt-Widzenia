// Worker entry for `punkt-widzenia`.
// - fetch: serves the built static site from dist/ unchanged (ASSETS binding).
// - scheduled: every 2 h (cron in wrangler.jsonc) starts the "Ingest headlines" GitHub Action,
//   because GitHub's own free-tier cron skips most runs. See docs/DEPLOY.md.
// Needs the secret GH_DISPATCH_TOKEN (fine-grained token, this repo only, Actions: read & write).

const REPO = 'Mati-IR/Punkt-Widzenia';
const WORKFLOW = 'ingest.yml';

export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env) {
    if (!env.GH_DISPATCH_TOKEN) {
      console.warn('GH_DISPATCH_TOKEN not set, skipping ingest dispatch');
      return;
    }
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'punkt-widzenia-worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    );
    if (res.status !== 204) {
      // Throwing marks the cron invocation as failed in the Cloudflare dashboard.
      throw new Error(`Ingest dispatch failed: ${res.status} ${await res.text()}`);
    }
    console.log('Ingest dispatched');
  },
};
