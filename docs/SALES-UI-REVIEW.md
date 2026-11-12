# Sales UI review and implementation

12 November 2026. Guidance: https://www.skills.sh/jakubkrehel/skills/better-ui
Reviewed the existing admin source and its defined states. Read the guidance's
surface and animation recipes. Browser/signer verification: **Not verified**.

## Interaction before polish

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| High, fixed | ops/booking/sales-ledger.mjs:2; astro/src/lib/sales-workspace.ts:28 | Recent bookings stopped at 25; attribution was aggregated elsewhere; review cases were separate. | One paginated, permission-scoped ledger and table. Review state joins onto the booking; unmatched review records remain visible. | A single interaction must reach all records without duplicate bookings. |

## Surfaces and control states

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| Medium, fixed | astro/src/components/SalesWorkspace.astro:1 | Metric cards, a recent list, attribution table and payment-review cards competed for attention. | One light table surface with structural dividers; detail/actions expand within their row. | Borders express structure; a restrained shadow defines the outer surface. |
| Medium, fixed | astro/src/components/SalesWorkspace.astro:14 | Inconsistent interactive-state treatment across report surfaces. | Hover is pointer-gated; row feedback is 100ms; enabled button press is 0.96 over 150ms ease-out under no-preference only. | Frequent interactions stay immediate, disabled controls never scale, reduced motion gets no movement. |

## Implemented behavior

Sales is the only sales/review navigation item. Staff see all payment checkouts and
unresolved review cases; mentors see their own attributed booking rows. Editors
without other authority see neither. Session reads validate the current key and
staff allowlist or Mentor role. Legacy staff-only deployments use a dedicated
request-bound signed ledger read. Resolution preview and confirmation retain their
fresh signatures and backend authorization; no payment authority is delegated.

Status filters and booking/payment-ID search apply server-side across all pages.
Review cases appear first. Confirmed, awaiting-payment and closed states remain
explicit; no pending amount is presented as revenue. Original currencies and sats
stay separate; display respects currency minor units. Unknown amounts are labelled
Not recorded. A review linked to an existing booking is one row, not an extra sale.
Resolved reviews stop being actionable; orphan reviews still appear to staff.

The row disclosure retains booking/payment references, provider review information,
the agreed-time input, preview and confirmation workflow, and existing refund-claim
link sharing. It does not create refunds or automatically resolve any case.

Invitations is also one sidebar section/form. Issuance uses the same connected
signer and locale control. Mentor links retain the actor's referral attribution;
standard owner/staff links remain unassigned. Attribution cannot be supplied by
request JSON. Both issuers retain rate limits and one-time signed operations.

## Verification

- Covered ledger deduplication, orphan/resolved reviews, pagination beyond 25 rows,
  literal bound search, request validation, mentor isolation and private fields.
- Covered dedicated signature purpose/filter binding and session actor/revocation.
- Existing booking-resolution, staff/invitation and role tests remain applicable.
- Inspected source states: default, loading, empty, filtered-empty, error, hover,
  disabled, pressed, expanded detail, preview invalidation and confirmation.
- Browser at desktop/mobile widths, keyboard interaction, actual signer handoff,
  rendered contrast and motion replay at 10% speed: **Not verified**.

No High UI-polish finding remains in the inspected code. Production activation
and uninspected browser/signer coverage are outside this approval.

**Approve — inspected code-level UI polish only.**
