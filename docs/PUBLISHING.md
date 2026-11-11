# Publishing with fewer GitHub steps

## After this change reaches main

1. Save and review the bilingual changes on staging.
2. Open the production-review PR prepared by **Prepare production review**.
3. Review its complete scope and merge when required checks pass.
4. Open the automatically started **Check and deploy website** run and approve
   the protected production environment. Wait for public verification to pass.

No manual `gh workflow run` command is needed. Merging main starts the deployment
for that exact commit. Production approval remains required. A deployment that is
already obsolete when its deploy job starts is rejected instead of publishing an
older main revision.

During this first rollout there are still two owner actions: merge and production
approval. Approving from the Nostr admin is a separate implementation step, pending
a test that its acting identity is eligible under GitHub environment policy. This
change does not weaken branch protections or grant the content editor a bypass.

## One-time setup for automatic production reviews

The production workflow starts automatically without extra credentials. Automatic
PR creation and main-to-staging synchronization additionally need a dedicated GitHub
App. With no App credentials the assistant produces a setup message and direct
manual review links; it does not pretend a review was created.

Use a GitHub App installed on **only 0xRivers/custody-consulting** with repository
Contents: read/write and Pull requests: read/write. Do not grant administration,
secrets, deployment approval or branch-protection bypass privileges. Configure the
App's private key locally; never paste it into chat or commit it. An existing App
may be reused if its scope is appropriate, but do not change the deployed editor's
credential setup just for this workflow.

From an authenticated terminal:

```bash
bash ops/publishing/configure-release-app.sh APP_ID /absolute/path/to/private-key.pem
```

This stores `CONTENT_RELEASE_APP_ID` as a repository Actions variable and
`CONTENT_RELEASE_APP_PRIVATE_KEY` as an Actions secret. GitHub tokens are minted
only for the selected repository, used by the trusted main workflow, then revoked.
The workflow never runs PR/staging source with its private key. Changes to workflow
files remain subject to GitHub App permissions; if a merge is refused, resolve it
through the owner review flow rather than adding a protection bypass.

The workflow must be on main before `workflow_run` events can trigger it. Setup
must also be available before the next successful staging push. There is no timer
or unsolicited recurring job. The next successful staging push prepares its PR.

## What the assistant does

- A successful current staging deployment prepares or updates one staging→main PR.
- A stale staging result is ignored. If branches change while preparing its
  summary, preparation stops until another staging success.
- Main history is normally merged into staging automatically when needed. That
  push rebuilds and verifies staging before another production review is prepared.
- Branch conflicts or protection rejections are surfaced. No force push, required
  check bypass or production auto-merge is performed.
- An owner-created open promotion PR is preserved, including its notes/title.
- Content-only releases are distinguished from code/configuration/URL migrations.
  The complete staged diff is listed. The owner must approve its entire scope;
  there is no per-article isolation claim in this first iteration.
- Code changes still use the same required checks and protected deployment.
- Saved-draft status and public publication are not treated as equivalent.

GitHub checks must actually run for automated branch events. The assistant uses a
GitHub App token instead of relying on recursive GITHUB_TOKEN push events.

## Topics

The editor offers shared choices **Foundations / Podstawy**, **Recovery /
Odzyskiwanie**, and **Continuity / Ciągłość**. The choices live in the topic registry
and are checked against the editor configuration during tests. Source articles
store stable IDs. The build resolves each language's existing public slug and
label; legacy localized values are accepted during migration. Unknown topics fail
with an actionable validation error. Add future topics to the registry and editor
options together.

The editor is a separate deployed service. Merging a config change into the static
site does not update that editor. Repackage its configuration using the existing
content deployment procedure. For the currently deployed Nostr pilot, preserve its
proxy/session integration and install only the regenerated config. Do not replace
the deployed Nostr editor with the repository's older GitHub OAuth build.

## Next delivery: the admin workspace

The current repository lacks the deployed Nostr editor's content API and session
integration. Those local files must first be reconciled as a scoped content-only
change, preserving the booking service's behavior and deployed credentials. Then:

- Replace ambiguous statuses with Saved draft, Checking, Ready, Publishing and Live.
- Add editable English/Polski tabs, exact-revision previews and a review summary.
- Persist release operations and retries, including actor and approved revision.
- Isolate a publication from unrelated staged changes before enabling one-click Publish.
- Verify owner approval via GitHub's pending-deployment API before removing the
  remaining GitHub approval visit.

No endpoint for publication or environment approval is enabled by this first change.

## Verification

Run `bash ops/publishing/verify-builds.sh` after `npm ci`. It runs the shared contract,
release-assistant and output checks. The production and editorial workflow job
names stay stable so existing required-check rules still work. The Foundation
workflow retains its baseline/audit evidence responsibilities.

After merging this rollout, check one trial article update: the current staging
run should pass, the assistant should prepare a scoped PR, the merged revision
should automatically start its protected production run, and production should
match `version.txt` after approval. Also test a stale result and an existing PR.
