# Identity foundation — CC-50

12 November 2026. Local implementation only, network disabled.

`ops/mentors/identity-store.mjs` provides additive SQLite persistence for stable
people, active/retired keys, effective branch role grants and append-only audit.
It is an internal repository boundary, not an authenticated service or HTTP API.
Its mutation methods require a trusted application caller that has already checked
signatures and authority. They must never be mapped directly to client actions.

Six tests cover identity continuity through rotation, rejection of previously
assigned keys, branch isolation, no implicit role inheritance, grant expiry and
revocation, atomic failure and audit immutability. Nine existing network tests
also pass. Run `npm run test:mentor-network`.

## Next integration gates

- Migrate prototype application, membership, invitation and sales references from
  npub to stable person IDs; preserve original signing-key snapshots.
- Enroll only after verified proof of key control; bind replacement to old/new
  proofs or an explicit recovery ceremony. No generic root replacement endpoint.
- Authorize every mutation using the current grantor, branch and service readiness.
  Role grants alone do not establish operational readiness.
- Resolve session identity at every action, invalidate sessions and pending actions
  on retirement or suspension, and test revocation between preparation/execution.
- Pass actor identity into the content API and enforce article ownership there.
- Add separately audited business-root bootstrap/recovery, using the public npub
  recorded in MENTOR-NETWORK-SCOPE.md. No private key belongs in configuration.
- Rehearse migration and recovery against an isolated database before activation.

The signed mentor service now enrolls keys after verified signatures and resolves
roles, application history and original sales through stable identities. Retired
keys cannot execute pending signatures. Role revocation covers historical keys.
Legacy records retain original signing keys; these are resolved through the key
history rather than rewritten. Existing users must sign my-status to enroll
before their legacy roles can be used. New role recipients must do the same.
Seventeen mentor/identity tests and the content-workspace suite pass.

Session integration, expiring grants in the service, root recovery and public
rotation remain incomplete. The internal rotation method is deliberately not
exposed as an HTTP action. Neither test suite establishes production readiness. Public
routes, booking behavior and production permissions remain unchanged.

## Session integration

Mentor session-start requires a fresh signed action. The service stores a token
hash with a 30-minute expiry and returns the token only to its HTTP adapter, which
sets a Secure, HttpOnly, SameSite=Strict cookie scoped to /booking-api/. Ordinary
my-status, applications, branches and sales reads use this session; mutations
continue through fresh signatures. Each read resolves the active signing key and
current roles. Logout revokes the hash; reconnect replaces that key's session.
The dashboard provides explicit sign-out. Private data is not cached.

Nineteen identity/network and twenty-five content tests pass. Tests cover session
expiry, replacement, logout, key retirement, role revocation and mutation denial.
The content handler now passes the verified session actor separately from JSON
and supports an authorization check before API execution. Its legacy content
allowlist is still the production boundary; branch content ownership and a unified
mentor/content session are not implemented. Do not enable branch editors yet.

Both disabled and enabled staging builds pass; actual browser, signer, cookie and
VPS integration still require staging validation before activation. No deployment
has occurred.

## Article ownership enforcement

The article API now requires an explicit authorization policy and fails closed
when none is configured. Service policy preserves the existing global content
allowlist and introduces private ownership of bilingual article IDs by branch.
Scoped access uses stable identities and current editor grants. Ordinary mentor
and branch-manager roles do not inherit content permissions. Unassigned articles
remain global-only. The API filters workspace lists before fetching bodies, checks
individual reads and saves, blocks legacy endpoints for scoped editors, and
rechecks queued writes before execution. Request JSON cannot select its actor.

Ownership is currently internal database configuration. There is no client-facing
assignment endpoint or branch-editor session enrollment yet. The mentor service's
legacy role presets are not automatically mirrored into content grants. Do not
enable branch editors until reviewed assignment, enrollment and branch-readiness
checks are connected. No production permissions or public pages changed.

Verification: 30 content-workspace tests and 19 mentor/identity tests pass. New tests
exercise cross-branch guessed IDs, legacy endpoint bypass, filtered article lists,
queued revocation, key retirement and fail-closed configuration. Service JavaScript,
package shell syntax and whitespace checks pass. No browser or VPS validation ran
for this backend change.

## Branch-editor login and assignment controls

The mentor dashboard now creates a separately signed content session for the
business root or an editor with an active branch role, then links to the bilingual
workspace. The HTTP adapter issues the existing secure content cookie; token
values are removed from JSON responses. Content authentication rechecks key status
and current editor roles on each request. The service's content ownership policy
now uses the mentor network's active branch assignments, preserving legacy global
content editors separately.

Business-root users can select an existing article and an active editing branch
in Article assignments, or choose Owner only. The change requires a fresh signature
and creates an immutable audit event containing previous and new branch IDs.
Reassignment changes an open editor's allowed article set immediately. Article
assignment grants no ability to publish. Mentors and managers require an explicit
editor role. Role revocation deletes mentor/content sessions and pending challenges
across the person's keys, preventing old sessions from reviving after a regrant.

Local verification now includes 21 mentor/identity tests and 30 content tests.
Additional cases cover signed enrollment, assignment authorization, reassignment,
owner-only removal, audit records, session revocation/regrant and retired keys.
An enabled staging build passes. No real signer or browser validation has occurred.
The feature stays disabled pending the supervised staging pilot and root recovery.
