# Structured data policy

Structured data is emitted only for indexable production article pages. Draft
previews and every staging page omit JSON-LD completely.

## Article graph

Each published article emits one JSON-LD graph containing:

- `BlogPosting`, using the visible headline, summary, author, publication date,
  material-update date, language, topics and canonical production URL;
- `BreadcrumbList`, matching the visible language homepage, knowledge-base and
  current-article trail;
- `Organization`, limited to the visible `Custody Consulting` brand name and
  public production URL.

The current organizational byline references that organization node. A future
approved personal byline is represented as a `Person` with its visible name
only. An author URL, biography, credentials or `sameAs` links must not be added
until the corresponding public profile exists and has been verified.

No address, legal entity name, professional credential, review, rating or FAQ
claim is inferred. The publisher logo is also omitted until an appropriate
production image URL and dimensions are deliberately approved.

## Validation

`npm run test:astro:contract` validates the graph shape, dates, author typing,
breadcrumb order, production URLs and safe JSON serialization. After both
static builds, `npm run check:structured-data-output` parses every JSON-LD
block and verifies:

- staging contains no structured data;
- production graphs use the Schema.org context and production origin;
- each article graph contains `BlogPosting`, `BreadcrumbList` and the minimal
  publishing organization;
- required article facts and sequential breadcrumb positions are present;
- staging URLs, ratings and FAQ markup are absent.

Google's Rich Results Test and Schema Markup Validator should be run against a
published production article after the first reviewed article is released.
They cannot truthfully validate a production article URL while all current
article fixtures remain drafts and production remains on the legacy release.

The implementation follows Google's current
[Article](https://developers.google.com/search/docs/appearance/structured-data/article)
and
[Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
guidance plus the canonical
[Schema.org BlogPosting](https://schema.org/BlogPosting) vocabulary.
