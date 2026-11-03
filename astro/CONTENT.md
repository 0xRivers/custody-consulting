# Blog content contract

Articles live in `src/content/blog/<locale>/` as Markdown or MDX. Every entry
must provide the fields validated by `src/content.config.ts`:

- `title` and `summary` for listings and metadata;
- `locale`: `en` or `pl`;
- `slug`: the locale-specific URL segment;
- `author`: the public byline;
- `publishedAt` and optional `updatedAt` dates;
- `draft`: explicit publication state;
- `translationKey`: the stable key shared by translated versions;
- one to five URL-safe `topics`.

Article URLs have the form `/<locale>/blog/<slug>/`. The build rejects duplicate
URLs, more than one entry for the same translation key and locale, invalid dates,
and an update date earlier than the publication date.

Production indexes, article pages, feeds and sitemaps must obtain entries from
`getPublishedArticles()` in `src/lib/articles.ts`. It always removes drafts.
Draft previews must use `getPreviewArticles()`, which throws outside a staging
build. Do not query the blog collection directly in a public page or endpoint.

The paired draft fixtures exercise validation but are not approved articles.
They contain no wallet secrets and must remain excluded from production output.
