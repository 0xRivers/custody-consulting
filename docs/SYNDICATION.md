# Sitemap and feed policy

Astro generates the sitemap and RSS feeds only during the explicit production
build. The staging build does not contain these endpoints or advertise feeds.
Staging remains protected separately by page-level robots metadata and the
public `X-Robots-Tag` response header.

## Production outputs

- `/sitemap.xml` lists the language chooser, English and Polish homepages, blog
  indexes, and routes derived from published articles.
- `/en/rss.xml` contains published English articles.
- `/pl/rss.xml` contains published Polish articles.
- `/robots.txt` advertises the production sitemap.
- production blog and article pages advertise their locale feed with an RSS
  discovery link.

Every absolute URL uses `https://custody.consulting`. Draft previews, staging
URLs, error pages, robots files, feeds and other utility pages are excluded
from the sitemap. RSS items are likewise limited to published content in the
requested language.

## Dates

An article sitemap entry uses `updatedAt` when a genuine material update is
recorded; otherwise it uses `publishedAt`. Blog, topic and pagination entries
use the latest genuine date among the articles they list. Static pages omit
`lastmod` rather than inventing a deployment or build date. RSS item dates use
`publishedAt`; the channel build date reflects the newest genuine article
publication or update.

## Verification

`npm run test:astro:contract` tests route derivation, draft filtering, dates,
locale filtering and XML escaping. After both builds,
`npm run check:syndication-output` verifies that:

- staging has no sitemap or RSS artifacts;
- production has the sitemap and both feeds;
- every advertised URL uses the production origin;
- drafts, errors and utility URLs are absent;
- production robots and feed discovery point to the generated artifacts;
- staging robots and HTML do not advertise production syndication endpoints.
