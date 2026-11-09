import assert from 'node:assert/strict';
import { access, readdir, readFile, stat } from 'node:fs/promises';

const candidates = [
  new URL('../../build/astro-staging/', import.meta.url),
  new URL('../../build/astro-production/', import.meta.url),
];
const roots = [];
for (const root of candidates) {
  try {
    await access(root);
    roots.push(root);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
assert(roots.length > 0, 'Build an Astro artifact before checking performance output.');

function imageTag(html, className) {
  return [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
    .find((tag) => new RegExp(`class="[^"]*\\b${className}\\b`).test(tag));
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) result.push(...await files(url));
    else result.push(url);
  }
  return result;
}

for (const root of roots) {
  const landing = await readFile(new URL('en/index.html', root), 'utf8');
  const hero = imageTag(landing, 'hero__image');
  assert(hero, `Hero image missing from ${root.pathname}`);
  assert.equal(attribute(hero, 'loading'), 'eager');
  assert.equal(attribute(hero, 'decoding'), 'async');
  assert.equal(attribute(hero, 'fetchpriority'), 'high');
  assert.equal(attribute(hero, 'sizes'), '100vw');
  assert.match(attribute(hero, 'src') ?? '', /\.webp$/);
  assert((attribute(hero, 'srcset') ?? '').split(',').length >= 4, 'Hero needs at least four responsive candidates');

  const headerLogo = imageTag(landing, 'brand__logo');
  const footerLogo = imageTag(landing, 'footer-logo');
  assert(headerLogo && footerLogo, `Brand images missing from ${root.pathname}`);
  assert.equal(attribute(headerLogo, 'loading'), 'eager');
  assert.equal(attribute(headerLogo, 'fetchpriority'), 'low');
  assert.equal(attribute(footerLogo, 'loading'), 'lazy');

  for (const tag of landing.match(/<img\b[^>]*>/g) ?? []) {
    assert.match(attribute(tag, 'width') ?? '', /^\d+$/, `Image width missing in ${root.pathname}`);
    assert.match(attribute(tag, 'height') ?? '', /^\d+$/, `Image height missing in ${root.pathname}`);
  }

  for (const locale of ['en','pl']) {
    const homepage = await readFile(new URL(`${locale}/index.html`, root), 'utf8');
    assert.doesNotMatch(homepage, /<script\b/, `/${locale}/ must not ship client JavaScript: ${root.pathname}`);
  }
  assert.doesNotMatch(landing, /fonts\.(?:googleapis|gstatic)\.com|\.woff2?/i, `External font dependency in ${root.pathname}`);

  for (const file of await files(root)) {
    const pathname = file.pathname;
    const size = (await stat(file)).size;
    if (/\.(?:avif|webp|png|jpe?g)$/i.test(pathname)) {
      assert(size <= 90_000, `Image exceeds 90 KB budget: ${pathname} (${size} bytes)`);
    }
    if (/\.css$/i.test(pathname)) {
      assert(size <= 25_000, `CSS exceeds 25 KB budget: ${pathname} (${size} bytes)`);
      const css = await readFile(file, 'utf8');
      assert.doesNotMatch(css, /@font-face|fonts\.(?:googleapis|gstatic)\.com|\.woff2?/i, `Downloaded font found in ${pathname}`);
    }
  }
}

console.log('Verified responsive images, intrinsic dimensions, LCP priority, system fonts and zero client JS on language homepages.');
