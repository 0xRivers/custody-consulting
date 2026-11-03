# CC-12 verification — editorial workflow and author guide

Implementation commit: `dc56e99fe8001993b1a0168f75aa60c888004188`

Required-check trigger fix: `44a81cba17f348191ea1ebabee0637dbac89bfaa`

Solo approval documentation: `5f0a71be5a4a1d71c22f6a353144f811c33b8bbe`

## Editorial controls

- `docs/AUTHORING.md` documents drafting, paired translation, staging preview,
  technical and language review, publication, urgent correction and rollback
  expectations.
- The repository pull-request template records owner sign-off, sensitive-data
  checks, bilingual equivalence and production authorization.
- CODEOWNERS identifies the current owner for content and schema changes.
- `Editorial production gate` runs on every pull request to `main` and requires
  promotion from `staging`.
- The derived boundary check requires one English and one Polish entry per
  translation key, matching draft states, and proves every draft slug is absent
  from production HTML.
- No external CMS is selected. The guide records the authentication, signed
  webhook, environment separation, rollback and secret-handling requirements
  for any future CMS.

## Automated evidence

- Editorial run `41712895138` built both environments and reported: `Verified 2
  bilingual entries; 2 drafts are absent from production HTML.`
- Editorial run `41713176959` verified the required check after it was changed
  to run on every production pull request.
- Editorial run `41715415340` verified the final solo-approval documentation.
- Staging run `41715415484` activated and publicly verified release
  `5f0a71be5a4a1d71c22f6a353144f811c33b8bbe` through the non-root deployment
  account.
- The public response retained
  `X-Robots-Tag: noindex, nofollow, noarchive`.

## Repository governance

The `main` branch now:

- requires pull requests and strict `check` plus `Editorial review` statuses;
- requires review conversations to be resolved;
- applies the rules to administrators;
- blocks force pushes and deletion;
- requires zero peer approvals because the sole pull-request author cannot
  approve their own work.

The `production` environment allows only protected branches and requires a
manual approval by `0xRivers`, with self-review permitted. This is explicitly a
two-step solo-operator release checkpoint, not independent peer review. When a
trusted collaborator is available, require one code-owner approval and prevent
self-review.

Production content and the production deployment artifact were unchanged while
these controls were configured.
