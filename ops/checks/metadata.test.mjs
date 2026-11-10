import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMetadataLinks } from '../../astro/src/lib/metadata.ts';

test('metadata links are emitted only for indexable production pages', () => {
  const input = {
    noindex: false,
    site: 'https://custody.consulting',
    canonicalPath: '/en/blog/',
    alternatePaths: [
      { lang: 'en', path: '/en/blog/' },
      { lang: 'pl', path: '/pl/blog/' },
    ],
    xDefaultPath: '/',
  };
  assert.deepEqual(buildMetadataLinks({ ...input, indexable: false }), { canonical: undefined, alternates: [] });
  assert.deepEqual(buildMetadataLinks({ ...input, indexable: true, noindex: true }), { canonical: undefined, alternates: [] });
  assert.deepEqual(buildMetadataLinks({ ...input, indexable: true }), {
    canonical: 'https://custody.consulting/en/blog/',
    alternates: [
      { hreflang: 'en', href: 'https://custody.consulting/en/blog/' },
      { hreflang: 'pl', href: 'https://custody.consulting/pl/blog/' },
      { hreflang: 'x-default', href: 'https://custody.consulting/' },
    ],
  });
});

test('x-default requires a bilingual choice and metadata paths cannot escape the site', () => {
  const result = buildMetadataLinks({
    indexable: true,
    noindex: false,
    site: 'https://custody.consulting',
    canonicalPath: '/en/blog/article/',
    alternatePaths: [{ lang: 'en', path: '/en/blog/article/' }],
    xDefaultPath: '/',
  });
  assert.equal(result.alternates.some((link) => link.hreflang === 'x-default'), false);
  assert.throws(() => buildMetadataLinks({
    indexable: true,
    noindex: false,
    site: 'https://custody.consulting',
    canonicalPath: 'https://staging.custody.consulting/en/',
  }), /site-relative/);
  assert.throws(() => buildMetadataLinks({
    indexable: true,
    noindex: false,
    site: 'https://custody.consulting',
    canonicalPath: '/en/',
    alternatePaths: [{ lang: 'en', path: '/en/' }, { lang: 'en', path: '/en/other/' }],
  }), /Duplicate hreflang/);
});
