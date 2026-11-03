import { buildEnvironment } from '../../environment.mjs';

export const prerender = true;
export function GET() {
  const environment = buildEnvironment(process.env.SITE_ENV);
  // Staging must remain crawlable for its noindex header/meta to be observed.
  const sitemap = environment.indexable ? `Sitemap: ${environment.site}/sitemap.xml\n` : '';
  return new Response(`User-agent: *\nAllow: /\n${sitemap}`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
