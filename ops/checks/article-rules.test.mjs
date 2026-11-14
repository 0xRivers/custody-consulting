import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  articlePath,
  articleTopics,
  paginateArticles,
  publishedArticles,
  validateArticleCollection,
} from '../../astro/src/lib/article-rules.ts';

const entry = (id, overrides = {}) => ({
  id,
  data: {
    locale: 'en',
    slug: id,
    translationKey: id,
    draft: false,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  },
});

test('article paths are locale-specific and stable', () => {
  assert.equal(articlePath(entry('backups')), '/en/blog/backups/');
  assert.equal(articlePath(entry('kopie', { locale: 'pl' })), '/pl/blog/kopie/');
});

test('duplicate URLs and duplicate translations fail validation', () => {
  assert.throws(
    () => validateArticleCollection([entry('one', { slug: 'same' }), entry('two', { slug: 'same' })]),
    /Duplicate article URL/,
  );
  assert.throws(
    () => validateArticleCollection([entry('one', { translationKey: 'pair' }), entry('two', { translationKey: 'pair' })]),
    /Duplicate en translation/,
  );
});

test('invalid date order fails and production selection excludes drafts', () => {
  assert.throws(
    () => validateArticleCollection([entry('dates', { updatedAt: new Date('2025-12-31T00:00:00Z') })]),
    /updatedAt precedes publishedAt/,
  );
  const published = publishedArticles([
    entry('draft', { draft: true }),
    entry('published'),
    entry('polish', { locale: 'pl' }),
  ], 'en');
  assert.deepEqual(published.map((article) => article.id), ['published']);
});

test('pagination and topic routes are derived only from existing articles', () => {
  const articles = Array.from({ length: 7 }, (_, index) => entry(`post-${index + 1}`, {
    topics: index < 6 ? ['foundations'] : ['recovery'],
  }));
  assert.deepEqual(paginateArticles(articles, 1).items.map((article) => article.id), articles.slice(0, 6).map((article) => article.id));
  assert.deepEqual(paginateArticles(articles, 2).items.map((article) => article.id), ['post-7']);
  assert.deepEqual(articleTopics(articles), ['foundations', 'recovery']);
  assert.throws(() => paginateArticles(articles, 3), /exceeds/);
});

import { articleFrontmatter } from './article-frontmatter.mjs';

test('editorial boundaries accept equivalent block and CMS flow-style YAML', () => {
  const block = '---\nlocale: en\nslug: testing-cms-articles\ntranslationKey: testing-cms-articles\ndraft: false\n---\nText';
  const flow = '---\n{\n  title: "Testing CMS articles",\n  locale: en,\n  slug: testing-cms-articles,\n  translationKey: testing-cms-articles,\n  draft: false\n}\n---\nText';
  assert.deepEqual(articleFrontmatter(flow), articleFrontmatter(block));
});

test('editorial boundaries preserve unpublished state in both YAML styles', () => {
  for (const metadata of ['locale: pl\nslug: testujemy-artykuly\ntranslationKey: testing-cms-articles\ndraft: true', '{locale: pl, slug: testujemy-artykuly, translationKey: testing-cms-articles, draft: true}']) {
    assert.equal(articleFrontmatter('---\n' + metadata + '\n---\nText').draft, true);
  }
});

test('editorial boundaries reject missing identity and ambiguous draft flags', () => {
  assert.throws(() => articleFrontmatter('---\nslug: test\ntranslationKey: test\ndraft: false\n---\nText'), /locale/);
  for (const draft of ['"true"', '"false"', 'null', '0']) {
    assert.throws(() => articleFrontmatter('---\nlocale: en\nslug: test\ntranslationKey: test\ndraft: ' + draft + '\n---\nText'), /draft/);
  }
  assert.throws(() => articleFrontmatter('---\nlocale: en\nlocale: pl\nslug: test\ntranslationKey: test\ndraft: false\n---\nText'), /unique/i);
});
