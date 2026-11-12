import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createArticleAccess } from './article-access.mjs';
import { createIdentityStore } from '../../mentors/identity-store.mjs';

test('ownership follows stable identity and current branch grants without role inheritance', t => {
  const db = new DatabaseSync(':memory:'); t.after(()=>db.close());
  const owner='a'.repeat(64), editor='b'.repeat(64), replacement='c'.repeat(64);
  const identities=createIdentityStore({db}); identities.registerVerifiedKey(owner);
  const personId=identities.registerVerifiedKey(editor);
  const access=createArticleAccess({db,isGlobalEditor:key=>key===owner});
  db.prepare('INSERT INTO content_article_ownership VALUES (?,?)').run('madeira-guide','madeira');
  db.prepare('INSERT INTO content_article_ownership VALUES (?,?)').run('warsaw-guide','warsaw');
  assert.throws(()=>access(undefined),error=>error.status===403);
  assert.equal(access(owner).global,true);
  identities.grant({signingKey:owner,personId,role:'mentor',branchId:'madeira'});
  assert.deepEqual(access(editor).articleIds,[]);
  const grantId=identities.grant({signingKey:owner,personId,role:'editor',branchId:'madeira'});
  assert.deepEqual(access(editor).articleIds,['madeira-guide']);
  identities.replaceVerifiedKey({signingKey:editor,personId,oldKey:editor,newKey:replacement});
  assert.deepEqual(access(editor).articleIds,[]);
  assert.deepEqual(access(replacement).articleIds,['madeira-guide']);
  identities.revoke({signingKey:owner,grantId});
  assert.deepEqual(access(replacement).articleIds,[]);
});
