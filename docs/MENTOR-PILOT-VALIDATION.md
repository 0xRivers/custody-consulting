# Private staging validation — mentor and article workspace

Status: prepared locally; staging installation and real signer validation pending.
GitHub authentication returns 401 from this session and VPS SSH is unreachable.
No production release or live permission change was performed.

## Review and install boundary

Use branch feat/simpler-publishing for review into staging, not main. Keep the
network off in production. The release-assistant workflow changes and application
prototype are both in this branch; review the complete diff before merging.

The content-workspace archive is an overlay upgrade package, not a complete service
installation. Retain existing environment, database and all other backend modules.
Inspect SHA256SUMS and revision.txt, preserve the existing service entry-point name,
install runtime dependencies and use the established code rollback process. Confirm
custody can restart the staging service; do not change user or sudo policy silently.
Back up the staging database before additive schema installation. Rollback code
without replacing a live payments database with an earlier snapshot.

Before enabling the private staging build/service, configure public values:

```
MENTOR_NETWORK_ENABLED=true
CONTENT_NOSTR_ENABLED=true
CONTENT_CMS_ENABLED=true
CUSTODY_SUPER_ADMIN_NPUB=npub1efvt8cchugdmxahxawp64z7awkxrq5mm9mjwzwpf68urrc4rsf7s9lhewa
```

The network switch must match in the static build and staging backend. Preserve
staging noindex controls. The root's private key stays in its signer. Existing
GitHub App credentials remain protected server configuration. Check configured
origin and staff-root/proxy routes before installation. Open /admin/network/ on
staging. Use test identities and disposable draft changes only. Real mentor
onboarding remains gated by root recovery and operating-policy decisions in CC-49.

## Owner and editor journeys

1. Owner connects via a desktop extension; confirm the displayed npub matches the
   business identity. Session reads should not repeatedly request signatures.
2. Create two test branches. A separate test identity signs in once, proving control
   without receiving privileges. Owner grants editor access to the first branch.
3. Owner selects an existing article and assigns it to that branch. Verify the
   signer request corresponds to the exact article/branch change.
4. Editor reconnects, signs the content-session request and opens Articles. Verify
   only assigned articles appear. Switch EN/PL, retain edits, preview, then save a
   disposable draft; inspect the PR's exact two-file scope. No merge or publish.
5. Guess another branch's article ID and try the older editor endpoints. Expect
   denial and no repository writes. Test with a test identity, never another client.
6. Owner reassigns the article to the other branch while editor keeps the tab open.
   Refresh/save must deny access while retaining unsaved text.
7. Revoke editor access. Both mentor/content sessions and pending requests must fail.
   Regrant access and verify the old cookie does not revive; reconnect deliberately.
8. Choose Owner only for the article. Check its assignment audit and restore the
   original test configuration. Close disposable draft PRs after inspection.
9. Repeat connect/cancel/timeout/reconnect on Android Amber. Verify the signer user's
   npub, not a relay transport key. Record desktop/mobile browser versions.
10. Sign out. Back navigation or API requests must not expose private cached data.

## Additional gates

- Run the local browser fixture on a host that can launch Chromium:
  node ops/booking/content-cms/workspace-browser-check.mjs
- Check widths 320/375/390/768/1440px, enlarged text, keyboard focus, form errors,
  retained edits and assignment confirmation text.
- Confirm staging API cookies are Secure, HttpOnly, SameSite=Strict and path-scoped;
  tokens must not appear in JSON, logs or localStorage.
- Confirm the network remains disabled in production and language homepages retain
  zero client JavaScript. Do not treat a build as a completed device test.
- Record evidence and failures here before real onboarding; none are pre-marked done.
- Resolve root recovery, approval/onboarding separation and payment/delivery policy
  before inviting real mentors. The current prototype is not a production franchise.

## First staging attempt — restored

The first archive omitted matching scheduler helpers and hit a missing named export
(currentCalAppointment). The directory rollback restored the original code, but the
systemd start limit required reset-failed before restart. Owner confirmed staging
active after restoration on 12 November 2026 at 18:34 UTC. Mentor network stays off.

The revised package includes the complete statically imported dependency chain and
literal dynamic imports. Its build parses and links imports without evaluating the
service. Regression tests reject the exact missing-export failure. Dependencies
are packaged from one source revision instead of mixing new entrypoints with old
server helpers. The packaged package-service.mjs allows the same check against the
prepared candidate after npm ci, before stopping staging:

```
cd /opt/CANDIDATE_DIRECTORY
/opt/custody-node24/bin/node --experimental-vm-modules ops/booking/package-service.mjs /tmp/custody-candidate-link-check
```

The link check verifies exports and presence, not environment/provider readiness.
Inspect the full backend helper diff before replacing the running version. Any
failed start must restore the previous directory, run systemctl reset-failed, then
start and verify the restored staging service. Never restore an old database as
part of code rollback. Preserve the failed candidate for diagnosis.

## Backend staging installation confirmed

Owner confirmed the v2 staging backend active at 18:42:23 UTC on 12 November 2026.
Candidate dependency linking passed as custody-booking on Node 24.22.2.
Previous code: /opt/custody-booking-staging-before-v2-20261112T184222Z.
Database backup: /root/custody-staging-backup-20261112T182524Z.
MENTOR_NETWORK_ENABLED=false remains enforced by 96-mentor-pilot.conf.
Frontend installation, content proxy routing and real signer checks remain pending.

## Dashboard readability correction

The initial page inherited white foreground text and a dark color-scheme from the
public site while drawing white dashboard cards. Its btn classes lacked a usable
base style; scoped rules did not reach dynamically created controls. The update
sets an explicit light body, ink text, navy actions, readable labels/options,
compact headings, global-in-dashboard control rules, keyboard focus and responsive
single-column forms. Hidden account panels retain display:none.

Enabled staging build, interactive-ID preservation and shell syntax checks pass.
Seven explicit text/control palette pairs measure at least 5.04:1. Browser visual
QA remains pending: local ChromeDriver cannot create a Chrome session. No rendered
screenshot or full accessibility pass is claimed. Static-only archive installation
atomically switches the separate private-page symlink, retains prior pages and
rolls back if the served new page cannot be verified. No backend restart is used.

## Unified admin sidebar

The staging /admin shell now embeds the shared MentorWorkspace component. Articles
(including owner assignments), Mentor applications, Local branches, Roles and
access, Mentor sales and Mentor invitations are sidebar sections. The existing
booking Invitations, Sales and Payment review remain separately allowlisted.

Admin sign-in creates a signed mentor session and shares the active signer with
the embedded network UI; it does not create a second signer connection. Network
roles determine which sidebar items appear. A failed legacy booking allowlist check
does not block an approved mentor; a mentor role never exposes payment operations.
Content sessions are created deliberately when entering Articles. Errors appear in
the admin status area, and disconnect awaits session logout before reloading.

Enabled staging build and 22 static contract tests pass. Built-page audit checks
six gated entries, unique IDs and valid aria-controls targets. Real desktop/Amber
and visual browser checks remain pending. The static-only installer adds exact
/admin and /admin/ paths to the existing staging private-page matcher, validates
Caddy before reload, and preserves code and routes for rollback. It does not restart
the backend or change production routes.
