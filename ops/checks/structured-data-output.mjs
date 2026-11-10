import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const stagingRoot = new URL('../../build/astro-staging/', import.meta.url);
const productionRoot = new URL('../../build/astro-production/', import.meta.url);
const productionOrigin = 'https://custody.consulting/';

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await htmlFiles(url));
    else if (entry.name.endsWith('.html')) files.push(url);
  }
  return files;
}

function structuredData(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

for (const file of await htmlFiles(stagingRoot)) {
  const html = await readFile(file, 'utf8');
  assert.equal(structuredData(html).length, 0, `Structured data leaked into staging: ${file.pathname}`);
}

let articleGraphs = 0;
for (const file of await htmlFiles(productionRoot)) {
  const html = await readFile(file, 'utf8');
  for (const data of structuredData(html)) {
    assert.equal(data['@context'], 'https://schema.org');
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /staging\.custody\.consulting|aggregateRating|ratingValue|FAQPage/);
    const nodes = data['@graph'];
    assert(Array.isArray(nodes));
    const posting = nodes.find((node) => node['@type'] === 'BlogPosting');
    const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    const organization = nodes.find((node) => node['@type'] === 'Organization');
    assert(posting && breadcrumb && organization);
    assert(posting.url.startsWith(productionOrigin));
    assert(posting.headline && posting.description && posting.author);
    assert.match(posting.datePublished, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(posting.dateModified, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(breadcrumb.itemListElement.map((item) => item.position), [1, 2, 3]);
    assert.equal(organization.name, 'Custody Consulting');
    assert.equal(organization.url, productionOrigin);
    articleGraphs += 1;
  }
}

console.log(`Verified structured-data boundaries; ${articleGraphs} published article graph(s) present.`);
