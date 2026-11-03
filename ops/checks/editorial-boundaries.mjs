import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const contentRoot = new URL('../../astro/src/content/blog/', import.meta.url);
const productionRoot = new URL('../../build/astro-production/', import.meta.url);

async function filesUnder(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await filesUnder(path, suffix));
    else if (!suffix || entry.name.endsWith(suffix)) files.push(path);
  }
  return files;
}

function scalar(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(?:"([^"]*)"|'([^']*)'|([^#\\n]+))\\s*$`, 'm'));
  if (!match) throw new Error(`Missing ${field}`);
  return (match[1] ?? match[2] ?? match[3]).trim();
}

const articles = [];
for (const file of await filesUnder(contentRoot)) {
  if (!/\.mdx?$/.test(file.pathname)) continue;
  const source = await readFile(file, 'utf8');
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  assert(match, `Missing frontmatter in ${file.pathname}`);
  const data = match[1];
  articles.push({
    file: relative(contentRoot.pathname, file.pathname),
    locale: scalar(data, 'locale'),
    slug: scalar(data, 'slug'),
    translationKey: scalar(data, 'translationKey'),
    draft: scalar(data, 'draft') === 'true',
  });
}

const pairs = Map.groupBy(articles, (article) => article.translationKey);
for (const [translationKey, pair] of pairs) {
  assert.deepEqual(
    [...new Set(pair.map((article) => article.locale))].sort(),
    ['en', 'pl'],
    `${translationKey} must have one English and one Polish entry`,
  );
  assert.equal(new Set(pair.map((article) => article.draft)).size, 1, `${translationKey} must use the same draft state in both languages`);
}

const productionFiles = await filesUnder(productionRoot, '.html');
const productionHtml = (await Promise.all(productionFiles.map((file) => readFile(file, 'utf8')))).join('\n');
for (const article of articles.filter((candidate) => candidate.draft)) {
  assert(!productionHtml.includes(article.slug), `Draft slug ${article.slug} from ${article.file} leaked into production HTML`);
}

console.log(`Verified ${articles.length} bilingual entries; ${articles.filter((article) => article.draft).length} drafts are absent from production HTML.`);
