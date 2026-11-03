import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  articlePath,
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
