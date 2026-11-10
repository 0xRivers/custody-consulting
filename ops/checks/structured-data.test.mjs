import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildArticleStructuredData,
  serializeStructuredData,
} from '../../astro/src/lib/structured-data.ts';

const article = (overrides = {}) => ({
  id: 'keys',
  data: {
    locale: 'en',
    slug: 'keys-and-backups',
    translationKey: 'keys-and-backups',
    draft: false,
    publishedAt: new Date('2026-01-02T09:30:00Z'),
    updatedAt: new Date('2026-02-03T10:45:00Z'),
    title: 'Keys and tested backups',
    summary: 'A visible summary that accurately describes the article.',
    author: 'Custody Consulting',
    topics: ['foundations', 'recovery'],
    ...overrides,
  },
});

function graphByType(data, type) {
  return data['@graph'].find((node) => node['@type'] === type);
}

test('article graph matches visible production facts and site hierarchy', () => {
  const data = buildArticleStructuredData(
    'https://custody.consulting',
    article(),
    { home: 'Home', blog: 'Knowledge base' },
  );
  const organization = graphByType(data, 'Organization');
  const posting = graphByType(data, 'BlogPosting');
  const breadcrumb = graphByType(data, 'BreadcrumbList');

  assert.deepEqual(organization, {
    '@type': 'Organization',
    '@id': 'https://custody.consulting/#organization',
    name: 'Custody Consulting',
    url: 'https://custody.consulting/',
  });
  assert.equal(posting.url, 'https://custody.consulting/en/blog/keys-and-backups/');
  assert.equal(posting.headline, 'Keys and tested backups');
  assert.equal(posting.description, 'A visible summary that accurately describes the article.');
  assert.equal(posting.inLanguage, 'en-GB');
  assert.equal(posting.datePublished, '2026-01-02T09:30:00.000Z');
  assert.equal(posting.dateModified, '2026-02-03T10:45:00.000Z');
  assert.deepEqual(posting.author, { '@id': organization['@id'] });
  assert.deepEqual(breadcrumb.itemListElement.map((item) => item.position), [1, 2, 3]);
  assert.equal(breadcrumb.itemListElement[0].item, 'https://custody.consulting/en/');
  assert.equal(breadcrumb.itemListElement[1].item, 'https://custody.consulting/en/blog/');
  assert.equal(breadcrumb.itemListElement[2].item, undefined);
});

test('a genuine named byline becomes a minimally described Person', () => {
  const data = buildArticleStructuredData(
    'https://custody.consulting',
    article({ author: 'Example Author', updatedAt: undefined }),
    { home: 'Home', blog: 'Knowledge base' },
  );
  const posting = graphByType(data, 'BlogPosting');
  assert.deepEqual(posting.author, { '@type': 'Person', name: 'Example Author' });
  assert.equal(posting.dateModified, posting.datePublished);
});

test('serialization prevents script breakout and no unsupported claims are introduced', () => {
  const data = buildArticleStructuredData(
    'https://custody.consulting',
    article({ title: 'Safe </script><script>alert(1)</script>' }),
    { home: 'Home', blog: 'Knowledge base' },
  );
  const serialized = serializeStructuredData(data);
  assert.doesNotMatch(serialized, /<\/script|<script/);
  assert.equal(graphByType(JSON.parse(serialized), 'BlogPosting').headline, 'Safe </script><script>alert(1)</script>');
  assert.doesNotMatch(serialized, /aggregateRating|ratingValue|FAQPage|address|credential/);
  assert.throws(
    () => buildArticleStructuredData('http://custody.consulting', article(), { home: 'Home', blog: 'Knowledge base' }),
    /HTTPS origin/,
  );
});
