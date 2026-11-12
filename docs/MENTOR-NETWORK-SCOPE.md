# Custody Consulting: publishing and mentor network scope

Prepared by Astra at the owner's request, 11 November 2026.
Status: captured in backlog on 12 November 2026; local prototypes remain unshipped. Business policy decisions are still pending.

## Recommendation

Build one Nostr-authenticated operating workspace with two connected areas:
Publishing and Mentor Network. Begin with a centrally governed mentor pilot.
Design for a future franchise business, while keeping contracts, commissions,
territorial rights and payment distribution as explicit subsequent decisions.

Existing prototypes demonstrate useful mechanics. They do not establish the
business model or operational readiness. No network has been activated, no real
mentor has been approved and no production permissions were changed by this review.

Keep Astro static, the EN/PL homepages free of client JavaScript, and the existing
Node/SQLite service and deployment pipeline. Preserve desktop NIP-07 and Android
Amber NIP-46 sign-in. Publishing can ship independently of the franchise expansion
once its authorization boundary is agreed.

## 1. Product and authority

The explicitly configured business npub is the initial super-admin and trust
authority. Candidates prove control of their own npub, apply privately and request
an existing branch or propose a location. Only the super-admin initially approves
mentors, activates branches and grants capabilities.

An approval must answer four separate questions:

1. Is this person trusted to represent Custody Consulting?
2. Which services are they approved to deliver?
3. Which branches can they operate within?
4. What may they do or see in the application?

Trust approval does not automatically grant editing, management, payment operations
or publication. For the first pilot, retain central payment collection and existing
payment providers. Track who originates a booking separately from who delivers it.
Provide confirmed booking reports before introducing commission calculations or payouts.

## 2. Capability model

Roles are convenient presets over server-enforced capabilities, scope and effective
dates. Version the role definitions in code initially; manage assignments in the UI.
An arbitrary permission-builder interface is unnecessary for the pilot.

| Capability | Candidate | Approved mentor | Branch manager | Content editor | Business super-admin |
| --- | --- | --- | --- | --- | --- |
| Application submission/status | Own | Own history | Own | Own | All |
| Referral invitations | No | Own active branches | Separate mentor grant | No | All branches |
| Attributed booking amounts | No | Own | Assigned branches | No | All, including unassigned |
| Client details | No | Assigned delivery only | Separate operational grant | No | Operational access |
| Own availability | No | Approved services | Separate scheduling grant | No | All |
| Branch/profile change proposals | Application | Own scope | Assigned branches | Assigned content | All |
| Content drafts | No | Separate editor grant | Separate editor grant | Assigned scope | All |
| Public content publication | No | No | No | No | Yes |
| Mentor approval/branch activation | No | No | No in MVP | No | Yes |
| Role grant/revocation | No | No | No in MVP | No | Yes |
| Refund/payment resolution | No | No | No by default | No | Separate payment authority |
| Business root rotation | No | No | No | No | Controlled recovery process |

An individual may hold multiple roles. Branch managers do not inherit mentor or
editor permissions. Authorization is rechecked when an action executes, including
actions prepared before a role was revoked. UI filtering alone is insufficient.

## 3. Identity, trust and key lifecycle

Use stable internal person IDs. A person can have verified npubs with activation,
retirement and rotation history. Sales, membership and drafts belong to that stable
identity. Audit records also preserve the exact signing key used for each action.
A lost or rotated key must not disconnect a mentor from their history.

The exact public Custody Consulting business npub is required. A current personal
booking allowlist is not evidence of business-root authority. There is no fallback
to a personal account. Missing root configuration keeps the network disabled.

- The business private key stays in its signer, never in the application, Git or server configuration.
- Use short-lived secure sessions for ordinary navigation and reads.
- Require fresh, clearly described signing for approvals, role changes, suspension and owner publication.
- Recheck current authorization at execution time.
- With remote signers, identify the user key returned by the signer, not its transport identity.
- Ordinary key rotation can require old/new key proofs when both are available.
- Lost mentor keys require a deliberate super-admin recovery process.
- Root replacement requires an audited operational runbook, not a generic role-update control.
- Define root-loss/compromise recovery before onboarding real mentors, including session and pending-operation invalidation.

Nostr signatures establish control of a key. They do not independently establish
professional competence or trustworthiness. Approval remains a business decision.

Keep authoritative permissions and private applications in the service database
for the MVP. Preserve approval decisions and their signed intent. Public root-signed
rosters or attestations are later features requiring a schema, expiry and revocation
model. A stale relay event must never restore access that was revoked locally.

The prototype uses an application-specific JSON challenge protocol. Do not describe
it as standard NIP-98 HTTP authorization unless its header transport and request-bound
validation are revised and tested accordingly.

## 4. Branches and geography

A branch has a stable ID, separate from its display name, geographic label and URL.
Recommended fields: localized name/description, country, city/region, timezone,
languages, service area, remote/in-person availability, approved services and state.

Lifecycle: Proposed → Preparing → Active; an active branch may become Suspended or Closed.

A branch may have several mentors; a mentor may eventually operate in several
branches. A primary branch can simplify onboarding without creating a permanent
one-to-one ownership constraint.

Geography describes service availability initially. Do not automatically assign
territorial exclusivity, locate applicants by IP or imply each city is a separate
legal business. Branch creation, mentor approval and public location publication
are distinct actions. Approval does not automatically publish a branch page.

Renames and reorganizations preserve IDs and historical memberships. Closing a
branch stops new invitations/bookings while paid appointments require an explicit
fulfillment or resolution decision.

## 5. Candidate and owner journeys

Candidate journey:

1. Connect a signer and inspect the verified npub.
2. Complete a short EN/PL application: name, region, languages, experience, proposed services and existing/proposed branch.
3. Review, consent to the stated handling, sign and submit privately.
4. Receive a durable reference and private status page.
5. Respond to information requests or withdraw.
6. After approval, complete onboarding and service-readiness checks.
7. Become active for specified services and branches.

Application states: Submitted, In review, More information needed, Approved,
Rejected and Withdrawn. Mentor status is separate: Onboarding, Active, Suspended,
Offboarded. Approval is not immediate operational readiness.

The owner sees review evidence, branch/service scope and the exact proposed access.
Record internal rejection/suspension reasons separately from applicant-facing text.
A private status page plus a manually operated contact process is enough initially;
choose the contact channel before promising notifications. Do not broadcast private
applications or client information to public Nostr relays. Explain separately that
remote signing may use relays.

Use country/language selectors, editable timezone detection, field-level errors,
a focusable error summary and retained form values after failure. Rework prototype
free-text country codes, comma-separated languages and repeated read-signing prompts.

## 6. Referral, service delivery and sales

The originating mentor and the mentor delivering the appointment may differ.
For every booking retain:

- Originating mentor and branch, captured from the server-issued invitation.
- Assigned delivery mentor and branch, tracked separately with assignment history.
- The service and price actually agreed.
- Payment lifecycle and appointment lifecycle as separate records.

Example: a Madeira mentor refers a client who receives an online session from a
mentor elsewhere. The referral remains Madeira's; appointment access belongs to
the assigned provider. Future compensation policy can distinguish both contributions.

Recommended first attribution rule: the invitation bound server-side to a booking
defines its original source. Browser URL parameters cannot change it. Legacy/direct
bookings remain Unassigned. Correct attribution through append-only adjustments
with reasons rather than silent historical rewrites.

Recheck mentor/branch eligibility when an outstanding invitation is redeemed.
Suspension stops new business through unused links; existing paid appointments
need a fulfillment/reassignment decision, not silent abandonment.

A local service branch is not operational until scheduling/fulfillment works.
Include a minimal owner-managed delivery assignment and availability workflow
before mentors deliver sessions. Manual operation is acceptable initially if it
prevents conflicts and tells clients who will deliver their appointment. Self-service
calendar integrations can follow later.

First reports need date range, mentor/branch filters, counts, original-currency
amounts and permission-checked drill-down. Payment and appointment states stay
separate. Keep currencies separate and respect their actual minor-unit conventions;
do not universally divide by 100. Record sats separately and never sum them with fiat.

Current confirmed-booking totals are gross booked amounts, not net revenue, earned
commissions or amounts payable. Reconcile refunds/disputes/cancellations before
claiming a net figure, or clearly exclude them from the report's basis.

Pilot exclusions: commission automation, payouts, franchise fees, tax allocation
and multiple merchant accounts. If remuneration is promised at launch, its earning
basis, refund treatment and settlement process become launch requirements.

## 7. Publishing alignment

One workspace shell, permission-filtered navigation: Articles, Applications,
Branches, Bookings/Sales and Access.

Editorial journey: Save draft → Preview both languages → Review exact revision →
Owner approves publication once → Background checks/deployment → Verified live.

Branch editors can draft only content assigned to their branch. Global editors
can draft shared articles. The owner approves all public releases initially.
Enforce scope in backend queries and allowed file paths; changing an article ID
must not reveal or modify another branch's material.

Retain bilingual pairs, canonical topic IDs, stable URLs and original publication
dates. Branch profile changes should eventually use the same reviewed publication
machinery. New article/branch-page creation need explicit workflows beyond editing.

Approval binds the exact revision and complete release scope. Edits, conflicts or
scope changes invalidate it. An unrelated engineering change cannot silently join
an article release. The business npub's authority does not itself establish GitHub
production-reviewer eligibility. Prove that integration before replacing the
remaining GitHub approval handoff.

## 8. Conceptual data model

| Record | Purpose |
| --- | --- |
| Person | Stable mentor/staff identity independent of keys |
| Identity key | Verified npub, person and activation/retirement history |
| Business authority | Explicit root identity/key and rotation history |
| Application/review events | Private submission, revisions, decisions and consent version |
| Mentor approval | Services, evidence references, status and review dates |
| Branch | Stable service organization and lifecycle |
| Branch membership | Person, responsibilities and effective interval |
| Capability grant | Person, permission/preset, scope, grantor and effective interval |
| Invitation | Opaque token, issuer, originating branch, expiry and redemption |
| Booking attribution | Original referral identity/branch snapshots and adjustment history |
| Delivery assignment | Booking, delivery mentor/branch, schedule and history |
| Payment events | Provider references and payment/refund/dispute lifecycle |
| Content pair/revision | EN/PL content, ownership scope and immutable revision |
| Release operation | Reviewed revision, approval, artifact, progress and verification |
| Audit event | Actor, signing key, action, object, time and operation ID |

Separate private applicant/client data from durable audit records. Do not copy all
application text into permanent immutable audit JSON.

## 9. Prototype disposition

| Existing work | Retain or change |
| --- | --- |
| NIP-07/Amber support | Retain; verify real-device reconnect, timeout and cancellation |
| Explicit business npub configuration | Retain; no personal allowlist fallback |
| Signed expiring one-time challenges | Retain action binding; review protocol/session integration |
| Server-issued invitation attribution | Retain; add redemption eligibility, delivery assignment and adjustments |
| Separate currencies/unassigned bookings | Retain; add dates, drill-down and precise financial labels |
| Atomic bilingual saves/conflict handling | Retain; complete browser QA |
| Topic registry/shared checks | Retain |
| npub as principal business ID | Replace with stable person IDs/key history |
| Approval immediately activates mentor | Split approval, onboarding and service readiness |
| Global booking allowlist for content | Migrate through explicit scoped capabilities |
| Reserved branch editor role | Keep unavailable until backend ownership checks exist |
| Repeated signing for reads | Use authenticated sessions; retain deliberate privileged signing |
| Public/admin prototype forms | Rework around lifecycle and task-specific UX |

Concrete gap: content-http.mjs authenticates a legacy content session but does not
pass its actor to the article API. Branch editing cannot be safely enabled there
until actor identity and content ownership are checked end-to-end.

The prototype tests cover specific behaviors, not operational readiness. The shared
build passes with the network disabled. Enabled routes, real browser/signer journeys
and production event chaining remain unverified. Local Chromium could not create
its required singleton socket, and no supported browser surface was enabled.

## 10. Delivery order and acceptance gates

| Phase | Deliverable | Gate |
| --- | --- | --- |
| 0 | Operating rules: root, pilot, services, referral/delivery and collection responsibility | Explicit business npub and recorded decisions |
| 1 | Stable identities, scoped grants, root recovery, audits and sessions | Cross-branch/revocation tests and recovery rehearsal |
| 2 | Bilingual publishing workspace, exact previews and durable releases | One approved release, no unrelated changes, verified restore |
| 3 | Private mentor pilot: applications, review, branches, onboarding, suspension | Two branches/test identities and complete desktop/Amber journeys |
| 4 | Sales/operations pilot: referrals, delivery assignment, availability, reports | Booking and cancellation/refund handling with scoped drill-down |
| 5 | Public mentor/branch network and optional trust evidence | Directory accurately reflects suspension and key changes |
| 6 | Franchise operations: agreements, economics, settlement and territorial policy | Business and reconciliation rules settled before automation |

Publishing and mentor-network work can progress as separate deliveries after the
identity boundary is agreed. The simpler editor need not wait for the entire platform.

Additional gates: idempotent submissions, revocation of prepared operations, tested
backup/restore, private data excluded from logs/static output, keyboard/mobile/enlarged
text/error recovery checks, and zero client JS on public language homepages.

## Owner decisions

Business authority supplied by the owner on 12 November 2026: `npub1efvt8cchugdmxahxawp64z7awkxrq5mm9mjwzwpf68urrc4rsf7s9lhewa`. Checksum and public-key decoding validated; signing control has not yet been verified. Recording this public identity does not activate access. Private keys remain in the owner’s signer.

1. Are approved mentors initially referrers, service providers or both? Model both; activate delivery only after onboarding.
2. Which first branches, services and mentors form the pilot? Recommend a small supervised pilot with nonexclusive service areas.
3. Who collects payments and owes any mentor compensation? Recommend central collection/reporting first, with no automatic payout calculation.
4. Who can perform routine administration and publication? Recommend business root initially, explicit delegated personal operators later.
5. What qualifies mentors for approval, renewal and suspension? How are applicants contacted?
6. Is franchise the contractual launch model or the longer-term direction? Software must not decide this silently.

## Protocol references

- NIP-07: https://github.com/nostr-protocol/nips/blob/master/07.md
- NIP-46: https://github.com/nostr-protocol/nips/blob/master/46.md
- NIP-98: https://github.com/nostr-protocol/nips/blob/master/98.md

Business terms and operational policy require their own explicit decisions; this
scope does not constitute a franchise agreement or automated payment commitment.

## Backlog delivery map

CC-49 operating decisions; CC-50 identity and permissions; CC-51 publishing; CC-52 private mentor pilot; CC-53 booking operations; CC-54 reporting; CC-55 public network; CC-56 franchise economics. Dependencies and acceptance gates are maintained in docs/board/backlog.json.
