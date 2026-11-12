# Article authoring and owner publication

## Routes and roles

The editor is /admin/articles/. Owner publication controls and any setup blockers
are visible above the editor, independently of the optional Review changes panel. The old /admin/content/nostr/workspace/ entry
redirects there. Content API routes remain /admin/content/session and
/admin/content/articles; their Secure, HttpOnly cookie stays scoped to that API
path. Moving the page does not broaden cookie scope.

Editors and the business owner can create and save bilingual drafts. New article
URLs are chosen before the first save and then locked. The server sets draft=true,
byline and translation identity; clients cannot publish through creation metadata.
Saved and pending draft URLs are checked for collisions. Both translations save
atomically on one isolated PR branch, with revision conflict protection.

Only the explicitly configured business npub can publish or unpublish. Legacy
booking/content operators do not inherit owner publication authority. A prepared
plan records both article files, intended visibility, source revision, main/staging
bases, public routes and a digest. Plans are immutable. The owner reviews both
language versions and approves that digest with a fresh one-time Nostr signature.
Plans expire after ten minutes if not approved; source changes invalidate a queued
approval. One article release runs at a time.

Unpublish uses the verified live source, sets both draft flags and retains Markdown
history. It does not push unrelated pending draft edits into the release. Publish
preserves existing first-publication dates; an article absent from main receives
its first publication date when published.

## Protected pipeline

A durable SQLite operation survives page reloads and service restarts. A server
worker advances it through article PR checks, normal protected merge into staging,
verified staging deployment, staging-to-main production PR checks, normal protected
merge, workflow dispatch and production verification. No required check, review or
environment approval is bypassed. Branch or source drift blocks continuation.
Only the selected bilingual pair may differ between staging and main. Other pending
changes must be reviewed separately rather than silently included.

The UI links to a review or workflow run when external approval is required. It
marks completion only after the production workflow succeeds, version.txt matches
the merged revision, source contents match the plan and public routes return the
expected status. The old draft PR closes only if its head is still the reviewed
revision. A newer saved draft is preserved.

## One-time production publishing setup

The live main workflow inspected on 12 November 2026 was manual-only and lacked a
stale-candidate guard. Existing draft saving does not need additional permissions.
Publication does:

1. Grant the existing repository-scoped content GitHub App Actions read/write and
   approve the updated installation. Contents and pull requests remain scoped to
   custody-consulting. The normal draft token requests no Actions permission;
   release tokens explicitly request it. Never put the App private key in the UI.
2. Review and apply delivery/article-publishing-workflow.patch through the normal
   staging-to-main engineering review. It adds only the obsolete-main check to
   the existing manual deploy workflow and retains environment: production.
   Alternatively merge the already prepared deployment update containing that guard.
3. Confirm PR workflows run for article PRs and staging promotions, App merges obey
   branch protection, and the existing staging deploy updates version.txt.
4. Keep production environment approval enabled. The business npub is not itself
   a GitHub environment reviewer. Approve the linked run in GitHub when required.

Until setup is ready, the owner sees the specific blocker and Publish/Unpublish
remain disabled. Do not describe those actions as active in the current live
installation before setup has passed.

## Verification and limits

Tests cover owner-only approval, exact plan digest, expiry/replay, source drift,
unrelated release changes, protected CI sequencing, deployment verification,
owner revocation, immutable plans and draft-only creation/collision checks.
Tests simulate GitHub; no real article was published or unpublished by development.
Desktop/mobile/Amber browser journeys and a real complete production release must
still be verified after setup. Staging package installation is not that proof.
