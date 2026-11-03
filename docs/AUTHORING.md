# Editorial workflow and author guide

Git is the publishing source of truth. Articles are Markdown or MDX files in
`astro/src/content/blog/<locale>/`; no external CMS is currently connected.
Every change is reviewed as code and content before it can reach production.

## 1. Start a draft

Work on the `staging` branch or a short-lived branch based on `staging`. Copy an
existing article only as a structural example; do not copy its claims.

Create one file per language:

```text
astro/src/content/blog/en/<editorial-file-name>.md
astro/src/content/blog/pl/<editorial-file-name>.md
```

Use locale-specific `slug` values and one shared `translationKey`. Keep
`draft: true` until both versions have passed technical, editorial and language
review. The schema and field limits are documented in
[`astro/CONTENT.md`](../astro/CONTENT.md).

The opening `keyAnswer` must answer the title directly. Follow it with context,
limitations and actionable reasoning. Link primary sources whenever they exist.
Never include seed phrases, wallet descriptors, private keys, real recovery
material, client details or screenshots containing sensitive wallet data.

Use a real, approved public byline. `Custody Consulting` is a temporary
organizational byline until CC-1 records the consultant identity and business
details. Do not invent credentials, review dates or regulatory claims.

## 2. Preview safely

Install and test the exact dependency graph:

```bash
npm ci
npm run test:astro:contract
npm run build:astro:staging
npm run build:astro:production
```

Push the draft to `staging`. GitHub Actions deploys the staging artifact through
the dedicated non-root account. Review it at:

- `https://staging.custody.consulting/en/blog/`
- `https://staging.custody.consulting/pl/blog/`

Staging is public and must contain no secrets. Its HTML robots metadata and
`X-Robots-Tag` header request `noindex, nofollow, noarchive`; those controls are
not authentication.

## 3. Review the pair

Review both language versions together. The reviewer checks:

- the title and key answer agree and do not overstate the article;
- technical claims are supported by primary sources and include limitations;
- English and Polish communicate the same meaning naturally;
- headings, link text, lists, tables and image alternative text are useful;
- examples use invented, non-sensitive data;
- author attribution and dates are genuine;
- the staging language switch reaches the paired translation;
- mobile reading order, table of contents and topic links are usable;
- the production build contains no draft URLs or draft metadata.

Record material technical or translation feedback in the pull request. Do not
resolve a comment until the relevant language version is corrected.

## 4. Approve and publish

Only after review, change both paired entries to `draft: false`, add a genuine
`updatedAt` when an already published article changes materially, and push the
result to `staging` for one final preview.

Open a pull request from `staging` to `main`. Complete the repository pull
request checklist and complete the owner sign-off. The `Editorial production
gate` workflow builds both environments and confirms that draft material cannot
leak into the production artifact. Never bypass a failed gate by deleting a
fixture, weakening noindex checks or deploying manually.

Merging into `main` starts a production deployment, but the protected
`production` environment pauses it for a separate manual owner approval. This
second action is a deliberate solo-operator release checkpoint, not an
independent peer review. During the current rollout, `main` still deploys the
legacy production artifact; the Astro production cutover is a separate release
item and must not be inferred from an article merge.

### Repository protection required

The repository administrator must protect `main` with these settings before
the first editorial production merge:

- require a pull request before merging;
- require resolution of review conversations;
- require the `check` and `Editorial review` status checks to pass;
- block force pushes and branch deletion.

The repository currently has one maintainer, and pull-request authors cannot
approve their own work. The branch therefore requires zero peer approvals. The
production environment instead requires a manual approval from the owner with
self-review permitted. When a trusted collaborator is added, upgrade `main` to
require one approval, code-owner review and stale-approval dismissal, then turn
on prevention of self-review for the production environment.

Keep direct pushes available on `staging` because that branch is the preview
deployment target. These settings intentionally change repository governance;
verify them in GitHub after configuration rather than assuming this file
enforces them by itself.

For urgent corrections, use the same pull-request and review flow. A factual
correction is not a reason to bypass source verification or translation review.

## CMS decision

No CMS is selected. Markdown in Git keeps drafts, translations, review history
and releases in one auditable workflow, so no webhook or additional privileged
preview service is needed today.

If a CMS is adopted later, it must preserve this contract:

- authenticated author and reviewer access with least privilege;
- previews rendered only by the staging environment and still marked noindex;
- signed webhooks stored as GitHub environment secrets, with replay protection;
- immutable content revisions mapped to a Git commit or deployment identifier;
- separate staging and production webhooks—never one credential for both;
- publication only after the same schema, draft-leak and production-build gates;
- documented rollback, secret rotation and webhook failure recovery.

Do not connect a CMS directly to the VPS or give it a root deployment key.
