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
