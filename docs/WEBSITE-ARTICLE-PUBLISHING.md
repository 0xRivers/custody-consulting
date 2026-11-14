# Website-only article publishing

The owner reviews and signs a saved bilingual article in /admin/articles/. A
durable worker creates normal protected staging and main promotions, then
dispatches the article workflow. Routine article releases need no separate
GitHub environment approval. Editor and Mentor roles cannot authorize release.

## Article and engineering paths

The existing production environment retains its required reviewer. A new
article-production environment is limited to main and has no reviewer. It receives
the existing custody static-publishing SSH identity and verified host keys;
it does not grant additional server permissions. Keep those credentials confined
to this environment. An alternative dedicated custody key can be supplied with
ARTICLE_DEPLOY_KEY.

The workflow retrieves its verifier from ARTICLE_RELEASE_GUARD_SHA, an explicitly
pinned, reviewed engineering commit, rather than trusting executable verifier
code from an article candidate. The business npub is an independently configured
repository variable. Both are maintainer-managed trust settings.

Before any article credentials are used, the verifier checks the owner's actual
Nostr event, endpoint, article-release payload and exact plan digest. It rejects
approvals older than six hours, changed production bases, newer main revisions,
code/dependency changes, renamed or deleted files, executable files and symlinks.
The main merge's first parent must be the signed production base. Source contents
and bilingual metadata must exactly match the signed pair. CI and an independent
complete build/audit must succeed. Validation is repeated immediately before
deployment, and production visibility and version are checked afterwards.

Signed proofs are stored on immutable Git commits under cms/approvals/<operation>
and referenced by the main merge message. They contain the article plan and
public Nostr signature, never tokens, cookies or private keys. Approvals and
GitHub draft branches are public repository data, not private storage.

The standard push workflow routes a cryptographically verified article merge to
the article workflow and skips its normal manual deployment. Missing or invalid
proof retains the normal protected engineering path. Both workflows serialize
using the same main-release concurrency group.

## One-time rollout

1. Review and merge the workflow change to staging. Promote the complete
   engineering change to main, approve its normal production deployment, and
   wait for production to match main.
2. From a local checkout containing the new helper, run:
   bash ops/publishing/enable-website-publishing.sh --check
   bash ops/publishing/enable-website-publishing.sh --apply
   This configures only the article environment and public trust variables.
   It reads the existing local deployment identity without printing it.
   It preserves the existing production reviewer requirement.
3. Install the matching private staging backend/UI package and enable
   CONTENT_ARTICLE_AUTOMATION_ENABLED=true in its systemd drop-in. The package
   installer checks that no release is active before switching modes.
4. Reconnect in Admin. Publish and unpublish a temporary article with the
   business npub. Verify both language URLs, public version, sitemap and feeds.
   No GitHub approval should be required for either article operation.

The feature remains disabled until both the workflow configuration and the
backend flag are installed. Ordinary engineering changes always require normal
review. Do not remove the production environment's reviewer.

## Recovery and limitations

Unexpected staging/main drift stops the operation and requires a fresh owner
review. Do not widen an old approval to cover engineering changes. Environment
setup or workflow failures are reported as deployment failures with optional
technical details; they are not marked live. Existing GitHub and release history
remain available for investigation and rollback.

If a proof expires or a branch changes, prepare and sign a new plan. Re-running an
old signature does not authorize a different release. A newer production revision
cannot be overwritten by an older queued run.

To disable website-only publishing, set CONTENT_ARTICLE_AUTOMATION_ENABLED=false
and restart the staging service when no article operation is active. Keep the
article environment and pinned verifier unchanged until all signed in-flight
operations have ended.

Automated tests cover signature, scope, routing and worker contracts. A real
owner-signed run, environment credential access and VPS activation must be
verified during rollout. Local tests do not establish that those live systems
have been configured.
