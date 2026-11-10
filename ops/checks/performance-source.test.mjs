import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const sourceRoot = new URL('../../astro/src/', import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (/\.(?:astro|css|ts)$/.test(entry.name)) files.push(url);
  }
  return files;
}

test('hero image is responsive, explicit and prioritized as the likely LCP resource', async () => {
  const source = await readFile(new URL('components/LandingPage.astro', sourceRoot), 'utf8');
  assert.match(source, /widths=\{\[480, 768, 1200, 1600\]\}/);
  assert.match(source, /sizes="100vw"/);
  assert.match(source, /format="webp"/);
  assert.match(source, /loading="eager"/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /fetchpriority="high"/);
});

test('brand images request bounded transforms and reserve intrinsic space', async () => {
  const header = await readFile(new URL('components/SiteHeader.astro', sourceRoot), 'utf8');
  const footer = await readFile(new URL('components/SiteFooter.astro', sourceRoot), 'utf8');
  const gateway = await readFile(new URL('pages/index.astro', sourceRoot), 'utf8');
  assert.match(header, /width=\{336\}/);
  assert.match(header, /fetchpriority="low"/);
  assert.match(footer, /width=\{256\}/);
  assert.match(footer, /loading="lazy"/);
  assert.match(gateway, /width=\{384\}/);
});

test('Astro source has no hydration directives or downloaded web fonts', async () => {
  for (const file of await sourceFiles(sourceRoot)) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /client:(?:load|idle|visible|media|only)/, `Hydration directive in ${file.pathname}`);
    assert.doesNotMatch(source, /@font-face|fonts\.(?:googleapis|gstatic)\.com|\.woff2?/i, `Downloaded font in ${file.pathname}`);
  }
});

test('backend templates cache fingerprinted assets without making HTML stale', async () => {
  for (const name of ['site.Caddyfile', 'staging.Caddyfile']) {
    const source = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.match(source, /@immutable path \/_astro\/\*/);
    assert.match(source, /public, max-age=31536000, immutable/);
    assert.match(source, /@mutable not path \/_astro\/\*/);
    assert.match(source, /header @mutable Cache-Control "no-cache"/);
  }
});
