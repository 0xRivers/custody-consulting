# CC-15 verification — production metadata and canonical URLs

Implementation commit: `6422eb78dece65abe097bd1ba8004300317ae5f2`

## Metadata contract

- Every indexable production page receives one self-canonical under
  `https://custody.consulting`.
- Staging and explicit noindex pages emit no canonical or hreflang links.
- English and Polish homepages plus blog indexes use reciprocal language links.
- Published paired articles receive reciprocal links only when both translations
  exist in the production query.
- Localized topic pages intentionally omit hreflang because topic translations
  do not yet have an explicit equivalence mapping.
- The neutral root language chooser is x-default for root and blog-index pairs.
  Article and topic pages intentionally omit x-default.
- Paginated and topic pages derive unique titles and descriptions from locale,
  topic and page number.

The complete policy is documented in `docs/METADATA.md`.

## Automated evidence

- Astro run `41716790015` completed successfully.
- Eight contract tests passed with zero failures.
- The artifact validator reported: `Verified metadata for 5 indexable
  production pages and all staging HTML.`
- Both staging and production Astro builds completed successfully.
- The dependency audit reported zero known vulnerabilities.
- Editorial run `41716789792`, foundation run `41716789827` and board run
  `41716789882` also completed successfully.

## Public staging evidence

- Deployment run `41716789930` activated and publicly verified release
  `6422eb78dece65abe097bd1ba8004300317ae5f2` through the non-root staging
  account.
- The public response retained
  `X-Robots-Tag: noindex, nofollow, noarchive`.

## Production isolation

The protected `main` branch remained at
`9b6b41f5f33dac420f4a4b389f13f7ab586b636d`. Production content, workflow and
deployed artifact were unchanged.
