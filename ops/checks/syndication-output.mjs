import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const stagingRoot = new URL('../../build/astro-staging/', import.meta.url);
const productionRoot = new URL('../../build/astro-production/', import.meta.url);
const productionOrigin = 'https://custody.consulting';

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

for (const path of ['sitemap.xml', 'en/rss.xml', 'pl/rss.xml']) {
  assert.equal(await exists(new URL(path, stagingRoot)), false, `Staging must not generate ${path}`);
  assert.equal(await exists(new URL(path, productionRoot)), true, `Production must generate ${path}`);
}

const sitemap = await readFile(new URL('sitemap.xml', productionRoot), 'utf8');
for (const path of ['/', '/en/', '/pl/']) {
  assert(sitemap.includes(`<loc>${productionOrigin}${path}</loc>`), `Sitemap is missing ${path}`);
}
assert.doesNotMatch(sitemap, /staging\.custody\.consulting|bitcoin-self-custody-foundations|podstawy-samodzielnego-przechowywania-bitcoina/);
assert.doesNotMatch(sitemap, /<loc>[^<]*(?:404|robots\.txt|rss\.xml)/);

for (const lang of ['en', 'pl']) {
  const rss = await readFile(new URL(`${lang}/rss.xml`, productionRoot), 'utf8');
  assert(rss.includes(`<link>${productionOrigin}/${lang}/blog/</link>`));
  assert(rss.includes(`<atom:link href="${productionOrigin}/${lang}/rss.xml"`));
  assert.doesNotMatch(rss, /staging\.custody\.consulting|bitcoin-self-custody-foundations|podstawy-samodzielnego-przechowywania-bitcoina|<item>/);
}

const productionRobots = await readFile(new URL('robots.txt', productionRoot), 'utf8');
const stagingRobots = await readFile(new URL('robots.txt', stagingRoot), 'utf8');
assert.match(productionRobots, /^Sitemap: https:\/\/custody\.consulting\/sitemap\.xml$/m);
assert.doesNotMatch(stagingRobots, /^Sitemap:/m);

for (const lang of ['en','pl']) {
  const blog = await readFile(new URL(`${lang}/blog/index.html`, productionRoot), 'utf8');
  const home = await readFile(new URL(`${lang}/index.html`, productionRoot), 'utf8');
  assert.match(home, /href="https:\/\/cal\.com\/custody\.consulting\/discovery"/);
  const noindex = /<meta name="robots" content="noindex/.test(blog);
  assert.equal(sitemap.includes(`<loc>${productionOrigin}/${lang}/blog/</loc>`), !noindex);
  assert.equal(home.includes(`href="/${lang}/blog/"`), !noindex);
  assert.equal(blog.includes('application/rss+xml'), !noindex);
}
const stagingBlog = await readFile(new URL('en/blog/index.html', stagingRoot), 'utf8');
assert.doesNotMatch(stagingBlog, /application\/rss\+xml/);

console.log('Verified production-only sitemap, bilingual RSS, robots discovery and feed metadata.');
