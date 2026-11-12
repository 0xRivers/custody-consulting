import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArticleAccess } from './article-access.mjs';
test('editors can draft all articles without receiving owner or legacy endpoint authority',()=>{
 const owner='a'.repeat(64),editor='b'.repeat(64),mentor='c'.repeat(64);let allowed=true;
 const access=createArticleAccess({isGlobalEditor:key=>key===owner,canDraftAll:key=>key===editor&&allowed});
 assert.throws(()=>access(undefined),error=>error.status===403);
 assert.equal(access(owner).global,true);assert.equal(access(editor).global,false);assert.equal(access(editor).workspaceAll,true);
 assert.equal(access(mentor).workspaceAll,false);allowed=false;assert.equal(access(editor).workspaceAll,false);
});
