# A simpler publishing experience

Status: proposal; no workflow, protection, permissions or production changes applied.
Prepared: 11 November 2026.

## Outcome

Routine article changes happen entirely in /admin/content. The owner edits, previews
both languages and approves the reviewed release once. The service handles branches,
checks, promotion, deployment and verification. GitHub remains the audit trail and
an advanced troubleshooting link, rather than a required part of every edit.

Code, authentication, payments, server configuration and workflow changes retain
the engineering review and production approval process.

## Findings from the existing implementation

- The content API creates bilingual draft PRs but deliberately rejects publication
  with “Review and merge article changes in the GitHub pull request.”
- The editor uses Decap editorial statuses plus a separate draft toggle. Those
  controls do not explain whether something is saved, previewed or actually live.
- deploy.yml deploys only after workflow_dispatch on main, followed by an environment
  approval. Merging a promotion is insufficient to publish.
- Editorial review, Astro verification, staging and production repeat overlapping
  build suites. Stale copy assertions and install ordering have caused failures.
- Topics are free-text lists per language, allowing Foundations and Podstawy to
  become separate topics on the Polish site.
- The current GitHub App token requests contents/write and pull_requests/write;
  it cannot yet orchestrate the whole release or prove deployment approval authority.
- AUTHORING.md includes obsolete descriptions of automatic deployment and cutover.
  Update documentation as part of implementation, not as an afterthought.
- Main-to-staging synchronization currently requires user intervention. Promotion
  also risks including unrelated changes staged for a different purpose.

## Owner journey

| Screen | Owner action | System result |
| --- | --- | --- |
| Articles | Select an article pair | Show draft changes separately from the live version |
| Editor | Edit English or Polski; Save draft | Save both translations atomically; preserve live content |
| Preview | Generate preview | Validate and build the exact revision; show EN and PL preview links |
| Review | Read both previews and inspect changes | Record review against the exact revision |
| Ready to publish | Publish both languages | Display a concise confirmation of affected pages and languages |
| Publishing | Wait on the same screen | Promote approved content, deploy, verify and update progress |
| Live | Open English or Polish page | Show verified live revision, time and any indexing notification warning |

For an existing published article the main action reads “Publish changes”; for a
new pair it reads “Publish both languages”. “Save draft” never changes the live site.
An unpublished article may be previewed without toggling publication fields.
New content or edits after review invalidate the previous review automatically.

## Interface

Reuse the existing Custody navy, warm neutral background, amber accent and system
fonts. Use clear panels and typography; avoid a redesign of the public site.
The external design search returned marketing-led layouts that do not fit this
internal task; use its verified status-feedback and accessible-interaction guidance
with the existing brand instead of adopting those layouts wholesale.

Article list: title, EN status, PL status, saved changes, last published time and
one next action. Search and filters: All, Drafts, Ready, Live, Needs attention.

Editor: explicit English / Polski tabs, each independently editable; optional
side-by-side view on desktop. Preserve unsaved edits when switching tabs. Show
“Saved at …”, “Unsaved changes” or a specific save error. Keep the live version
available for comparison. Shared fields are presented once and clearly labelled.
Do not expose YAML, translation keys, branches or workflow names in the normal flow.

Review panel: changed text, both preview links, check results and any unrelated
changes excluded from this release. Show the reviewed content date and a clear
list of newly published/updated/unpublished pages. Do not use a percentage that
suggests a predictable deploy duration.

Progress: Preparing → Checking → Ready → Publishing → Verifying → Live. Display
one current stage and a short explanation. Errors stay visible with a meaningful
next step: “Polish topic is missing. Choose a topic.” or “Deployment failed; the
previous release is still live.” Raw logs are behind Details.

Accessibility: minimum 44px controls, visible labels and keyboard focus, adequate
text contrast, status announced through a polite live region, errors associated
with fields, no colour-only states, reduced-motion support. Test 320/375/390px
mobile widths, 768px tablet and desktop; no horizontal page overflow. On mobile,
stack preview/review controls and keep the main action visible without obscuring
content or keyboard focus.

## Prevent recurring content errors

- A canonical topic registry owns stable IDs and localized labels/slugs. The owner
  chooses one shared topic; the UI resolves Foundations/Podstawy automatically.
- Migrate existing free-text topics without changing existing public topic URLs.
  Unknown values must fail with an actionable error, rather than creating a new topic.
- Pair English and Polish behind one article record, keeping both translations editable.
- Require both translations and synchronized publication state before a new pair can go live.
- Keep publishing controls out of Markdown editing; the release service applies
  publication flags and genuine first-publication dates atomically to the pair.
- Lock published slugs by default; a URL change requires a redirect-aware operation.
- Leave existing publication dates unchanged during ordinary wording updates.

## Release orchestration

Use the existing authenticated Nostr admin session and backend as the starting
point. Keep GitHub App credentials on the server. This is an extension of the
current admin, not another CMS account or public-site JavaScript dependency.

1. Save an article pair on an isolated content branch and create/update its PR.
2. Build an immutable preview for that revision. A shared staging URL must not be
   represented as reviewed if another commit has replaced it. Use revision-specific
   preview paths or verify version.txt against the expected commit.
3. Aggregate required checks into one owner-readable result. Reuse a common test
   definition across workflows; execute it for each distinct candidate revision.
4. Capture owner intent to publish the exact pair and revision. Check the allowed
   changed paths and display the complete release scope.
5. Merge the validated content PR and manage promotion automatically. In the first
   iteration, retain staging→main but block content publishing whenever it would
   also ship unrelated code or unapproved articles. Do not silently promote all staging.
6. Automate branch synchronization. A clean merge restarts checks; conflicts or any
   changed release scope require renewed review. Never force-push shared branches.
7. Start deployment automatically for the approved revision. Verify the workflow
   SHA and artifact digest; reuse an artifact only if its inputs match the release.
   Serialize production activation and reject stale queued publication approvals.
8. Verify version.txt, EN/PL routes, labels, canonical/hreflang, publication state,
   sitemap and RSS before showing Live. Report IndexNow separately from deployment;
   an accepted submission does not mean the article is indexed.
9. Keep a durable release record: actor, approved revision, before/after article
   state, PRs, run IDs, artifact digest, outcome and previous verified release.

A request ID makes Save, Preview, Publish and Retry safe to repeat. Store operations
outside process memory so browser refreshes and backend restarts do not lose them.
Use a signed webhook or bounded polling to update status. Handle delivery retries,
network timeouts and stale browser sessions explicitly.

## Approval and GitHub permissions

Keep one deliberate owner publication approval. Do not merely remove branch
protection or grant the editor a general administrative bypass.

Prototype approval in /admin against the existing protected production environment.
GitHub's pending-deployment API requires an eligible reviewer and deployments/write;
an installation token alone must not be assumed to satisfy reviewer policy.
Verify the intended actor in a staging-only proof of concept. If the existing App
cannot act as an eligible reviewer, evaluate user-authorized GitHub App access for
the owner while retaining the Nostr admin session. Establish this before promising
zero GitHub visits. Until then, show a direct “Approve production” deep link.

Separate read-only status access from release authority. Grant only the repository
permissions actually required by tested API calls (Actions read/write where needed,
checks read, deployments write and existing content/PR permissions). No secrets in
browser storage. Require authenticated POSTs, CSRF protection, path allowlists,
commit-bound authorization and an audit record for all release operations.

App-generated operations must reliably trigger checks. GitHub documents differences
between GITHUB_TOKEN events and App-token events; validate the actual event chain
rather than assuming an automated merge will launch the next workflow.

## Recovery

Retry the failed stage without creating duplicate PRs or deployments. Before
activation failure, keep the previous verified release live. If post-activation
verification fails, show the failure clearly and offer restoration of the previous
verified static release through the existing custody deployment permissions. Verify
that restoration and reconcile Git/content state before another publication. Do
not claim that a rollback succeeded based only on the activation command exit code.
Code and infrastructure rollback remains outside the article-only action.

## Delivery order

1. **Reduce immediate GitHub work.** Shared checks; automatic promotion PR upkeep;
   synchronize branches; automatically start the approved main deployment. Keep
   the current environment approval while this ships. Add a single release summary.
2. **Make the editor reliable.** Fix editable bilingual tabs, introduce localized
   topic selection, distinguish saved/preview/live state, add exact-revision previews.
3. **Publish from admin.** Add durable release orchestration, scope isolation and
   the verified owner-approval integration. Add progress, retry and restore controls.
4. **Exercise and document the full flow.** Trial wording-only updates, then a new
   bilingual pair, then a failed check and a post-activation verification failure.
   Remove superseded owner steps and update AUTHORING.md.

If staging routinely contains mixed engineering and editorial work, separate
content promotion from engineering integration before enabling one-click publishing.
The admin may prepare an isolated content-only candidate based on current main;
any policy change allowing that promotion path must be explicit and tested.

## Acceptance criteria

- A normal bilingual wording edit requires no terminal command and no GitHub navigation.
- The owner can save, preview and publish from one admin workspace.
- Publication requires one explicit owner confirmation after both-language review.
- Every preview, approval and deployment is tied to a specific immutable revision.
- An unrelated code change or unreviewed draft cannot be included silently.
- A stale approval cannot publish a newer revision or roll production back.
- Both-language topic labels are correct; published URLs stay stable.
- Missing translations and validation failures explain what to fix and block publishing.
- Double-click, refresh, timeout and retry do not duplicate releases.
- Live appears only after public verification; indexing notification has its own status.
- Mobile, keyboard and screen-reader operation pass the same complete journey.
- Recovery restores and verifies the prior release, with an audit trail.

## Guidance consulted

- Requested UI/UX guidance: https://www.skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max
- GitHub workflow triggers: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
- GitHub pending deployment review: https://docs.github.com/en/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run
