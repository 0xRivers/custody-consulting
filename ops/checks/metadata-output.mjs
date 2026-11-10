import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const stagingRoot = new URL('../../build/astro-staging/', import.meta.url);
const productionRoot = new URL('../../build/astro-production/', import.meta.url);
const productionOrigin = 'https://custody.consulting';

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

function first(html, pattern) {
  return html.match(pattern)?.[1];
}

function outputPath(root, file) {
  const path = relative(fileURLToPath(root), fileURLToPath(file));
  if (path === 'index.html') return '/';
  return `/${path.replace(/index\.html$/, '')}`;
}

for (const file of await htmlFiles(stagingRoot)) {
  const html = await readFile(file, 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/, `Staging noindex missing from ${file.pathname}`);
  assert.doesNotMatch(html, /<link rel="canonical"/, `Staging canonical leaked into ${file.pathname}`);
  assert.doesNotMatch(html, /<link rel="alternate" hreflang=/, `Staging hreflang leaked into ${file.pathname}`);
}

const pages = new Map();
const titles = new Set();
const descriptions = new Set();
for (const file of await htmlFiles(productionRoot)) {
  const html = await readFile(file, 'utf8');
  const path = outputPath(productionRoot, file);
  const noindex = /<meta name="robots" content="noindex/.test(html);
  const canonical = first(html, /<link rel="canonical" href="([^"]+)">/);
  const title = first(html, /<title>([^<]+)<\/title>/);
  const description = first(html, /<meta name="description" content="([^"]+)">/);
  const lang = first(html, /<html lang="([^"]+)">/);
  const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
    .map((match) => ({ hreflang: match[1], href: match[2] }));

  assert(['en', 'pl'].includes(lang), `Invalid lang on ${path}`);
  if (noindex) {
    assert.equal(canonical, undefined, `Noindex page ${path} must not declare a canonical`);
    continue;
  }

  assert.equal(canonical, `${productionOrigin}${path}`, `Self-canonical mismatch on ${path}`);
  assert(!canonical.includes('staging.'), `Staging hostname leaked into ${path}`);
  assert(title && !titles.has(title), `Missing or duplicate title on ${path}`);
  assert(description && !descriptions.has(description), `Missing or duplicate description on ${path}`);
  titles.add(title);
  descriptions.add(description);
  for (const alternate of alternates) {
    assert(alternate.href.startsWith(`${productionOrigin}/`), `Non-production alternate on ${path}`);
    if (alternate.hreflang === 'x-default') assert.equal(alternate.href, `${productionOrigin}/`);
  }
  pages.set(canonical, { path, lang, alternates });
}

for (const [canonical, page] of pages) {
  if (page.path === '/') continue;
  for (const alternate of page.alternates.filter((link) => ['en', 'pl'].includes(link.hreflang) && link.href !== canonical)) {
    const target = pages.get(alternate.href);
    assert(target, `Alternate target ${alternate.href} from ${page.path} was not generated`);
    assert(
      target.alternates.some((link) => link.hreflang === page.lang && link.href === canonical),
      `Alternate ${alternate.href} does not link back to ${canonical}`,
    );
  }
}

console.log(`Verified metadata for ${pages.size} indexable production pages and all staging HTML.`);
