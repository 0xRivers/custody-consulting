export function pair() {
  return Object.fromEntries(['en', 'pl'].map(locale => [locale, { file: { path: `astro/src/content/blog/${locale}/example.md`, id: locale }, data:
`---
title: An example Bitcoin backup guide
summary: A sufficiently long summary describing the wallet backup guide.
keyAnswer: Keep your working wallet available while checking your backup on another compatible device.
locale: ${locale}
slug: ${locale === 'en' ? 'example-guide' : 'przykladowy-poradnik'}
author: Custody Consulting
publishedAt: 2026-11-11
updatedAt: 2026-11-11
draft: false
translationKey: example
topics: [${locale === 'en' ? 'foundations' : 'podstawy'}]
sources:
  - label: Official documentation
    url: https://example.com/docs
---

## What should you check?

Keep the working wallet available throughout the check.
` } ]));
}
