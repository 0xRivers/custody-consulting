import { createIdentityStore } from '../../mentors/identity-store.mjs';

// Ownership belongs to the bilingual article ID, never to client-supplied paths.
// Assignment is an internal owner operation; no public assignment endpoint exists.
export function createArticleAccess({ db, isGlobalEditor, editorBranches, now = Date.now }) {
  const identities = createIdentityStore({ db, now });
  db.exec(`CREATE TABLE IF NOT EXISTS content_article_ownership (
    articleId TEXT PRIMARY KEY, branchId TEXT NOT NULL);`);
  return actor => {
    if (typeof actor !== 'string' || !/^[a-f0-9]{64}$/.test(actor)) throw Object.assign(new Error('Content access denied.'), { status: 403 });
    if (isGlobalEditor(actor)) return { global: true, articleIds: [] };
    // Service readiness and session enrollment are separate gates. A role grants
    // no public publication authority. Unassigned articles remain global-only.
    const articleIds = db.prepare('SELECT articleId,branchId FROM content_article_ownership').all()
      .filter(row => editorBranches ? editorBranches(actor).includes(row.branchId) : identities.permits({ pubkey: actor, permission: 'content.draft.branch', branchId: row.branchId }))
      .map(row => row.articleId);
    return { global: false, articleIds };
  };
}
