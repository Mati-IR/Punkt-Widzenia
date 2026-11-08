// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Set SITE_URL in CI once the production domain is known.
export default defineConfig({
  site: process.env.SITE_URL || 'https://punkt-widzenia.pages.dev',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
