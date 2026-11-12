# Bilingual content workspace

Implementation stage: local, not installed or verified against the live VPS.
Route after installation: `/admin/content/nostr/workspace/`.

The workspace replaces the editing surface for existing article pairs. Both English
and Polski tabs are editable and keep their text while switching. Shared topic
choices are sourced from the same registry as the public build. Saved URLs and
publication metadata are read-only. Reading preview is deliberately labelled as a
reading aid; it does not claim to be the exact Astro rendering.

Draft saves atomically update both article files on an isolated Git branch and
create/reuse a draft PR. They do not merge, publish, unpublish, or alter first-publication
dates. Concurrent edits return a conflict without overwriting the newer draft.
There is no browser token, credential field, Markdown HTML injection or production
approval endpoint in this delivery.

The review panel compares editable fields against the source revision reported by
production version.txt. Unavailable live status is shown explicitly. Staging links
appear only when both saved file hashes match the deployed staging revision.
A response timeout keeps local edits but cannot prove whether a remote save succeeded;
the UI explains how to check instead of claiming rollback.

## Authentication

The repository now includes the deployed Nostr content-session integration, scoped
to content requests. Signed dedicated-purpose challenges issue a 30-minute opaque
session token; only its hash is stored. SameSite=Strict, Secure and HttpOnly cookies
are restricted to `/admin/content/`. POSTs require the configured Origin and JSON.
The booking/invitation/payment API remains separate. Legacy allowlisted booking
operators do not imply future mentor/editor privileges.

`yaml` is a runtime dependency because the backend reads article frontmatter. A
production install using `npm ci --omit=dev` must retain it.

The Admin content link uses the workspace only when both CONTENT_CMS_ENABLED and
CONTENT_NOSTR_ENABLED are enabled. Existing OAuth/Decap assets are preserved as a
fallback. Do not deploy an older static Admin build over the live Nostr login.

## Packaging and installation boundary

Run:

```bash
bash ops/booking/package-content-workspace.sh /tmp/custody-content-workspace.tar.gz
```

The bundle contains only enumerated static/workspace and backend upgrade files, plus
checksums and a revision. It has no database, environment file or private key.
Packaging does not install anything. Follow the existing reviewed application-code
upgrade process to overlay the service files, retain its live configuration and
database, install runtime dependencies, syntax-check and restart it with rollback
available. The deployed service calls staging-service.mjs as production-service.mjs;
that known rename must be preserved in installation.

Install the static folder under the existing staff root and verify its files before
pointing the Admin link to it. Keep the previous editor accessible. The existing
content session/articles proxy routes suffice; no public route widening is required.
Use custody for publishing when its existing ownership and service privileges allow
it. Do not add blanket sudo or use a different account silently to force an upgrade.

## Checks

`npm run test:content-workspace` covers the Nostr session, request boundary, article
metadata preservation, conflicts, safe sources and bilingual saves. The full static
suite includes these tests. The browser fixture command is:

```bash
CHROME_BIN=/path/to/chrome CHROMEDRIVER_BIN=/path/to/chromedriver \
  node ops/booking/content-cms/workspace-browser-check.mjs
```

It uses a local fake API and never sends a save to GitHub or production. It exercises
both editable tabs, reading-preview injection safety, conflict retention and widths
320, 375, 390, 768 and 1440px plus enlarged text. In the current execution environment,
Chromium cannot create its required singleton socket; no enabled browser surface
is available. These browser checks therefore remain pending, and should be required
before installing this UI. Do not describe the browser journey as passed.

## Remaining publication work

The Publish action is intentionally unavailable until the actor allowed to approve
production is verified. Exact-revision approval, isolated release scope, durable
orchestration and recovery belong to the next delivery. New article creation also
remains in the existing editor until a validated creation flow is implemented.

## Mentor network requirement

The new mentor network must use explicit capabilities and branch scopes. A pending
application never obtains a content session or inherits the legacy owner allowlist.
Mentor access to own sales, branch management and global publication are separate
permissions. The Custody Consulting public npub will be configured explicitly as
the sole initial super-admin; it must not be guessed from the current personal login.
