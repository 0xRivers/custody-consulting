import type { APIRoute } from 'astro';
import { buildEnvironment } from '../../environment.mjs';
import { getPublishedArticles } from '../lib/articles';
import { buildSitemapEntries, renderSitemap } from '../lib/syndication';

export const prerender = true;

export function getStaticPaths() {
  const environment = buildEnvironment(process.env.SITE_ENV);
  return environment.indexable ? [{ params: { document: 'sitemap' } }] : [];
}

export const GET: APIRoute = async () => {
  const environment = buildEnvironment(process.env.SITE_ENV);
  const articles = await getPublishedArticles();
  return new Response(renderSitemap(environment.site, buildSitemapEntries(articles)), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
