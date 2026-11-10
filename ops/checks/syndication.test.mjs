import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSitemapEntries,
  renderRss,
  renderSitemap,
  xmlEscape,
} from '../../astro/src/lib/syndication.ts';

const article = (id, overrides = {}) => ({
  id,
  data: {
    locale: 'en',
    slug: id,
    translationKey: id,
    draft: false,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    ...overrides,
  },
});

test('sitemap contains only published routes and uses source dates for lastmod', () => {
  const articles = [
    ...Array.from({ length: 7 }, (_, index) => article(`post-${index + 1}`, {
      publishedAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`),
      topics: ['foundations'],
    })),
    article('updated', {
      publishedAt: new Date('2026-01-08T00:00:00Z'),
      updatedAt: new Date('2026-02-01T12:00:00Z'),
      topics: ['recovery'],
    }),
    article('szkic', { locale: 'pl', draft: true }),
  ];
  const entries = buildSitemapEntries(articles);
  const byPath = new Map(entries.map((entry) => [entry.path, entry.lastmod]));

  assert(byPath.has('/'));
  assert(byPath.has('/en/'));
  assert(byPath.has('/pl/'));
  assert(byPath.has('/en/blog/page/2/'));
  assert(byPath.has('/en/blog/topics/foundations/'));
  assert(byPath.has('/en/blog/topics/foundations/page/2/'));
  assert.equal(byPath.get('/en/blog/updated/'), '2026-02-01T12:00:00.000Z');
  assert.equal(byPath.get('/en/blog/'), '2026-02-01T12:00:00.000Z');
  assert.equal(byPath.has('/pl/blog/szkic/'), false);
  assert.equal(byPath.has('/404/'), false);
  assert.equal(byPath.has('/en/rss.xml'), false);
});

test('sitemap and RSS use production links, escape XML and exclude drafts and other locales', () => {
  const published = article('keys-and-backups', {
    title: 'Keys & <backups>',
    summary: 'Use "tested" backups & recovery plans.',
  });
  const draft = article('private-draft', { draft: true });
  const polish = article('klucze', { locale: 'pl', title: 'Klucze', summary: 'Opis' });
  const site = 'https://custody.consulting';

  const sitemap = renderSitemap(site, buildSitemapEntries([published, draft, polish]));
  assert.match(sitemap, /https:\/\/custody\.consulting\/en\/blog\/keys-and-backups\//);
  assert.doesNotMatch(sitemap, /private-draft|staging\./);

  const rss = renderRss(site, 'en', [published, draft, polish]);
  assert.match(rss, /<atom:link href="https:\/\/custody\.consulting\/en\/rss\.xml"/);
  assert.match(rss, /Keys &amp; &lt;backups&gt;/);
  assert.match(rss, /Use &quot;tested&quot; backups &amp; recovery plans\./);
  assert.match(rss, /Thu, 01 Jan 2026 00:00:00 GMT/);
  assert.doesNotMatch(rss, /private-draft|\/pl\/blog\/klucze\/|staging\./);
  assert.equal(xmlEscape("'\"<&>"), '&apos;&quot;&lt;&amp;&gt;');
});
