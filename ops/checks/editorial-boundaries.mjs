import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { articleFrontmatter } from './article-frontmatter.mjs';

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

const articles = [];
for (const file of await filesUnder(contentRoot)) {
  if (!/\.mdx?$/.test(file.pathname)) continue;
  const source = await readFile(file, 'utf8');
  const filePath = relative(contentRoot.pathname, file.pathname);
  const data = articleFrontmatter(source, filePath);
  assert.equal(filePath.split('/')[0], data.locale, `Article language must match its folder: ${filePath}`);
  articles.push({ file: filePath, ...data });
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
const syndication = await Promise.all(['sitemap.xml', 'en/rss.xml', 'pl/rss.xml'].map(
  (path) => readFile(new URL(path, productionRoot), 'utf8'),
));
for (const article of articles.filter((candidate) => candidate.draft)) {
  assert(!productionHtml.includes(article.slug), `Draft slug ${article.slug} from ${article.file} leaked into production HTML`);
  assert(!syndication.some((xml) => xml.includes(`/${article.locale}/blog/${article.slug}/`)),
    `Draft URL for ${article.file} leaked into the production sitemap or a feed`);
}

console.log(`Verified ${articles.length} bilingual entries; ${articles.filter((article) => article.draft).length} drafts are absent from production HTML.`);
