import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const contentRoot = new URL('../../astro/src/content/blog/', import.meta.url);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await markdownFiles(url));
    else if (/\.mdx?$/.test(entry.name)) files.push(url);
  }
  return files;
}

function parseArticle(source, pathname) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert(match, `Invalid frontmatter boundary in ${pathname}`);
  const [, frontmatter, body] = match;
  const field = (name) => frontmatter.match(new RegExp(`^${name}:\\s*"([^"]+)"`, 'm'))?.[1];
  return {
    pathname,
    frontmatter,
    body,
    locale: field('locale'),
    translationKey: field('translationKey'),
    keyAnswer: field('keyAnswer'),
    headings: [...body.matchAll(/^##\s+(.+)$/gm)].map((heading) => heading[1].trim()),
    sourceCount: [...frontmatter.matchAll(/^\s+- label:/gm)].length,
  };
}

const articles = await Promise.all((await markdownFiles(contentRoot)).map(async (file) =>
  parseArticle(await readFile(file, 'utf8'), file.pathname)
));

test('every article opens with a concise answer and useful question-led structure', () => {
  for (const article of articles) {
    assert(article.keyAnswer, `Missing keyAnswer in ${article.pathname}`);
    assert(article.keyAnswer.length >= 40 && article.keyAnswer.length <= 240, `keyAnswer is not concise in ${article.pathname}`);
    assert(article.body.trimStart() && !article.body.trimStart().startsWith('#'), `Article body needs introductory context in ${article.pathname}`);
    assert(article.headings.length >= 3, `Article needs enough navigable sections in ${article.pathname}`);
    assert(article.headings.filter((heading) => heading.endsWith('?')).length >= 2, `Article needs descriptive question headings in ${article.pathname}`);
    assert.equal(new Set(article.headings).size, article.headings.length, `Duplicate headings in ${article.pathname}`);
  }
});

test('articles connect evidence and services without search-manipulation claims', () => {
  const prohibited = /guarante(?:e|ed)|rank\s*#?1|featured snippet|AI citation|gwarancj\w*\s+(?:pozycj|cytow)|pierwsze miejsce w google/i;
  for (const article of articles) {
    assert(article.sourceCount >= 2, `Use multiple relevant sources in ${article.pathname}`);
    assert.match(article.body, new RegExp(`\\(/${article.locale}/#services\\)`), `Missing contextual services link in ${article.pathname}`);
    assert.match(article.body, /^\|.+\|$/m, `Use a comparison table when the article compares approaches in ${article.pathname}`);
    assert.doesNotMatch(`${article.frontmatter}\n${article.body}`, prohibited, `Unsupported search promise in ${article.pathname}`);
  }
});

test('translation pairs preserve the same decision structure', () => {
  const pairs = new Map();
  for (const article of articles) {
    const pair = pairs.get(article.translationKey) ?? [];
    pair.push(article);
    pairs.set(article.translationKey, pair);
  }
  for (const [translationKey, pair] of pairs) {
    assert.deepEqual(pair.map((article) => article.locale).sort(), ['en', 'pl'], `Incomplete language pair for ${translationKey}`);
    assert.equal(pair[0].headings.length, pair[1].headings.length, `Section mismatch for ${translationKey}`);
    assert.equal(pair[0].sourceCount, pair[1].sourceCount, `Source mismatch for ${translationKey}`);
  }
});
