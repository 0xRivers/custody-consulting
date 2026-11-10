# CC-17 verification — accurate structured data

Implementation commit: `cee7c04e8d42713f085503ba4cee092a1a85eeb4`

## Structured-data contract

- Published production articles emit a `BlogPosting`, a `BreadcrumbList` that
  matches the visible navigation trail, and a minimal `Organization` node for
  the visible Custody Consulting brand.
- Headline, description, byline, publication date, material-update date,
  language, topics and canonical URL come directly from visible article data.
- The organizational byline references the brand node. A future approved
  personal byline becomes a minimal `Person` with its visible name only.
- Staging and draft pages emit no JSON-LD.
- No address, legal identity, credential, rating, review, FAQ claim or
  unverified profile link is inferred.
- JSON serialization escapes script-breaking characters and structured URLs
  require a credential-free HTTPS origin.

The complete policy and post-publication external validation step are
documented in `docs/STRUCTURED-DATA.md`.

## Automated evidence

- Verify Astro static builds run `41719961650` completed successfully.
- Thirteen contract tests passed with zero failures.
- Both staging and production static builds completed successfully.
- The artifact validator reported: `Verified structured-data boundaries; 0
  published article graph(s) present.` Zero is the expected production count
  because both current article fixtures remain drafts.
- Metadata, syndication and editorial boundary validators also passed.
- The dependency audit reported zero vulnerabilities.
- Editorial run `41719963090`, foundation run `41719961513`, board run
  `41719961037` and staging deployment run `41719961341` all completed
  successfully.

## Public staging evidence

- Deployment run `41719961341` activated and publicly verified release
  `cee7c04e8d42713f085503ba4cee092a1a85eeb4` through the dedicated non-root
  staging account.
- The public response retained
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- Staging draft pages contain visible bilingual breadcrumbs but no JSON-LD, as
  enforced by the artifact validator.

## External validation boundary

Google's Rich Results Test and Schema Markup Validator require a published
article URL for meaningful live validation. No reviewed production article
exists yet, and production remains on the legacy release. Testing a draft URL
or claiming a rich-result outcome would be misleading. External URL validation
is therefore an explicit first-article production release check; the current
graph shape and generated artifacts are validated in CI.

## Production isolation

The protected `main` branch remained at
`9b6b41f5f33dac420f4a4b389f13f7ab586b636d`. No production deployment was
triggered, and the production site remains unchanged.
