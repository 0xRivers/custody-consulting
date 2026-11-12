import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createIdentityStore, presets } from './identity-store.mjs';
const root='a'.repeat(64),alice='b'.repeat(64),replacement='c'.repeat(64);
function setup(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());const store=createIdentityStore({db});store.registerVerifiedKey(root);const id=store.registerVerifiedKey(alice);return {db,store,id};}
test('stable registration contains only mentor/editor role presets',t=>{
 const f=setup(t);assert.equal(f.store.registerVerifiedKey(alice),f.id);assert.deepEqual(Object.keys(presets),['mentor','editor']);assert.throws(()=>f.store.registerVerifiedKey('nsec1secret'),/Invalid/);
});
test('key replacement retains stable identity and exact signer audit',t=>{
 const f=setup(t);f.store.replaceVerifiedKey({signingKey:alice,personId:f.id,oldKey:alice,newKey:replacement});
 assert.equal(f.store.resolve(alice),null);assert.equal(f.store.resolve(replacement),f.id);assert.throws(()=>f.store.registerVerifiedKey(alice),/Retired/);
 assert.equal(f.db.prepare("SELECT signingKey FROM network_identity_audit WHERE action='identity.key-replaced'").get().signingKey,alice);
});
test('failed replacement cannot reassign an existing key or retire the original',t=>{
 const f=setup(t);assert.throws(()=>f.store.replaceVerifiedKey({signingKey:root,personId:f.id,oldKey:alice,newKey:root}));assert.equal(f.store.resolve(alice),f.id);
 assert.equal(f.db.prepare("SELECT count(*) AS n FROM network_identity_audit WHERE action='identity.key-replaced'").get().n,0);
});
test('audit is append-only and unknown signing key rolls back replacement',t=>{
 const f=setup(t);assert.throws(()=>f.store.replaceVerifiedKey({signingKey:replacement,personId:f.id,oldKey:alice,newKey:replacement}),/inactive/);
 assert.equal(f.store.resolve(alice),f.id);assert.throws(()=>f.db.exec('DELETE FROM network_identity_audit'),/append-only/);
});
