// Static JSON pages for the home page's infinite scroll: /feed/1.json, /feed/2.json, …
// Each holds the next PAGE_SIZE events as ready-made rows plus the URL of the next page (null at the end).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEvents, feedPage, feedPageCount, feedUrl, eventRowHtml } from '../../lib/events';

export const getStaticPaths = (async () => {
  const events = await getEvents();
  const pages = feedPageCount(events);
  return Array.from({ length: pages }, (_, i) => ({ params: { page: String(i + 1) }, props: { n: i + 1, pages } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { n, pages } = props as { n: number; pages: number };
  const events = feedPage(await getEvents(), n);
  const body = {
    events: events.map((e) => ({ id: e.id, html: eventRowHtml(e) })),
    next: n < pages ? feedUrl(n + 1) : null,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
