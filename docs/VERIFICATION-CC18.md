# CC-18 verification — answer-focused editorial patterns

Implementation commit: `5cc0c7b7e572a12c593c58b4df550c1d8f7a1704`

## Editorial contract

- English and Polish articles lead with the visible `keyAnswer`, followed by
  context, limitations and actionable reasoning.
- The paired draft uses the same five-question decision flow in both languages.
- A neutral comparison table explains operational trade-offs without prescribing
  one universal custody setup.
- Technical context links to the Bitcoin white paper plus the primary BIP 32
  and BIP 39 specifications.
- Locale-specific service links appear only as a relevant next step and state
  that a legitimate review must not require seeds, private keys or live backups.
- Source checks require concise answers, multiple sources, useful question-led
  structure, bilingual parity and the absence of ranking, featured-snippet or
  AI-citation promises.

The complete policy is documented in `docs/ANSWER-FOCUSED-CONTENT.md` and is
linked from the authoring workflow.

## Automated evidence

- Verify Astro static builds run `41723290467` completed successfully.
- Sixteen contract tests passed with zero failures.
- Both staging and production static builds completed successfully.
- The rendered-output validator reported: `Verified answer-first rendering,
  question headings, comparisons and contextual service links.`
- The editorial boundary validator confirmed two bilingual entries and that
  both drafts were absent from production HTML.
- Metadata, syndication and structured-data validators also passed.
- The dependency audit reported zero vulnerabilities.
- Editorial run `41723290399`, foundation run `41723290267`, board run
  `41723290303` and staging deployment run `41723290286` all completed
  successfully.

## Public staging evidence

- Deployment run `41723290286` activated and publicly verified release
  `5cc0c7b7e572a12c593c58b4df550c1d8f7a1704` through the dedicated non-root
  staging account.
- The public response retained
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- The revised English and Polish drafts remain preview-only and are excluded
  from the production artifact.

## Production isolation

The protected `main` branch remained at
`9b6b41f5f33dac420f4a4b389f13f7ab586b636d`. No production deployment was
triggered, and the production site remains unchanged.
