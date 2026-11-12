# Mentor and Editor roles

Owner decision, 12 November 2026: local branches and branch managers are removed
from the active product. This supersedes branch-dependent scope in the earlier
Astra plan and pilot documents.

| Role | Access |
| --- | --- |
| Mentor | Own booking invitations and own attributed sales |
| Editor | Draft and edit bilingual articles; no publishing or sales authority |

The business npub remains the separately configured super-admin. It can assign
either role, both or neither, using independent checkboxes. Role assignments are
signed as one atomic operation. npubs can be assigned before sign-in; their pending
assignment attaches to a stable person only after proof of key control. Existing
accounts can be loaded with Edit roles. Clearing both removes delegated access.

Approval of an application grants Mentor without requiring a location or removing
an existing Editor assignment. Article access is no longer assigned by location;
Editor permits all workspace drafts. Legacy editor endpoints still require global
owner authority. Payment administration remains separately allowlisted.

Removing either role invalidates mentor/content sessions and outstanding signed
challenges. Key rotation preserves roles and sales via stable person IDs. Historical
sale attribution and audit rows are retained unchanged. Existing legacy Mentor and
Editor assignments migrate once on the person's next verified login; previously
inactive branches do not reactivate grants. Branch-manager assignments are ignored.
Legacy grants are deactivated when migrated or explicitly replaced, preventing
old permissions from reviving on code rollback. The migration writes an explicitly
system-attributed audit record rather than claiming a human signature.

Legacy branch columns/tables may remain in an existing database for historical
compatibility and additive rollback. They have no active management endpoints,
sidebar entry or selectors. No legacy history is deleted.

The combined staging update packages matching service dependencies, links exports
as the service account before stopping staging, backs up SQLite, and updates the
private static pages. Failures restore code/pages/configuration without rewinding
the payments database. Production configuration is not changed.

First installation stopped before activation because the npm subshell PATH hid
/usr/sbin/runuser. The corrected installer retains system administration paths.
An exported wrapper calling /usr/sbin/runuser can resume the already uploaded,
checksum-verified package without modifying its contents.

## Unified Sales view

Sales and Mentor sales now share one sidebar item and one refresh control. Booking
operators retain their separately allowlisted payment totals, recent bookings and
refund-link tools. The business root sees all mentor attribution including unassigned
sales, and mentors see only their own attribution. Editors without another applicable
permission see no Sales entry. The existing backend enforces both read boundaries;
this integration adds no payment permissions and does not change booking behavior.
The two read operations are kept separate inside the unified view; figures are not
summed across the payment summary and attribution breakdown.

Enabled staging build, 22 static contract tests and 18 mentor permission/session
tests pass. Built-page inspection confirms one Sales navigation item, unique IDs
and valid panel targets. Browser/signer journey verification remains manual.

## Single-table Sales and unified Invitations

Supersedes the earlier two-report Sales implementation. A shared paginated ledger
now supplies individual booking rows, original amounts, attribution and status.
Staff review cases join their existing booking row; unmatched cases remain visible
without inventing an amount. Search and status filters span all pages. Payment
review has no separate navigation entry. Review/resolve/refund-claim controls sit
inside the relevant row and remain restricted to existing payment operators.
See SALES-UI-REVIEW.md for scope, state inspection and browser verification limits.

Invitations is one native admin form and sidebar item. Nostr role and existing
staff authorization choose the issuer; the user does not choose between duplicate
tools. Mentor-role invitations record referral attribution from the signing actor.
Standard business-root invitations without Mentor, and legacy staff invitations,
remain unassigned. Fresh signatures, rate limits and backend checks remain in place.
