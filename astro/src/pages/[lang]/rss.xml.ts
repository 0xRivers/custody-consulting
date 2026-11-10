import type { APIRoute } from 'astro';
import { buildEnvironment } from '../../../environment.mjs';
import { getPublishedArticles } from '../../lib/articles';
import { locales, type Locale } from '../../lib/i18n';
import { renderRss } from '../../lib/syndication';

export const prerender = true;

export function getStaticPaths() {
  const environment = buildEnvironment(process.env.SITE_ENV);
  return environment.indexable ? locales.map((lang) => ({ params: { lang }, props: { lang } })) : [];
}

export const GET: APIRoute = async ({ props }) => {
  const environment = buildEnvironment(process.env.SITE_ENV);
  const lang = props.lang as Locale;
  return new Response(renderRss(environment.site, lang, await getPublishedArticles(lang)), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
