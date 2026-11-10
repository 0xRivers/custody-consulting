# CC-16 verification — production sitemap and bilingual RSS

Implementation commit: `5a0e1501c905f7082d9dc5e73ae7d94df2ec0f30`

## Syndication contract

- The production build generates `/sitemap.xml`, `/en/rss.xml` and
  `/pl/rss.xml`; the staging build generates none of those artifacts.
- Sitemap and feed URLs use `https://custody.consulting` exclusively.
- Drafts, staging URLs, error pages and utility pages are excluded.
- Article `lastmod` values use a genuine `updatedAt` when present and otherwise
  use `publishedAt`; derived listings use the newest source-content date.
- Static pages omit `lastmod` rather than using an invented build date.
- Production robots advertises the sitemap, while staging robots does not.
- Production blog and article pages advertise their locale feed; staging HTML
  does not advertise production feeds.

The complete policy is documented in `docs/SYNDICATION.md`.

## Automated evidence

- Verify Astro static builds run `41718420172` completed successfully.
- Ten contract tests passed with zero failures.
- Both staging and production static builds completed successfully.
- The production build generated the sitemap and both locale feeds; the
  staging route list contained none of them.
- The artifact validator reported: `Verified production-only sitemap,
  bilingual RSS, robots discovery and feed metadata.`
- The editorial boundary check confirmed that two drafts were absent from the
  production artifact, and the dependency audit reported zero vulnerabilities.
- Editorial run `41718420194`, foundation run `41718420232`, board run
  `41718420190` and staging deployment run `41718420109` all completed
  successfully.

## Public staging evidence

- Deployment run `41718420109` activated and publicly verified release
  `5a0e1501c905f7082d9dc5e73ae7d94df2ec0f30` through the dedicated non-root
  staging account.
- The public response retained
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- The deployed staging artifact contains neither sitemap nor RSS files, as
  enforced before deployment by the production/staging artifact validator.

## Production isolation

The protected `main` branch remained at
`9b6b41f5f33dac420f4a4b389f13f7ab586b636d`. No production deployment was
triggered, and the production site remains unchanged.
