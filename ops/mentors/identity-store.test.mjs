import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createIdentityStore } from './identity-store.mjs';
const root = 'a'.repeat(64), alice = 'b'.repeat(64), rotated = 'c'.repeat(64);
function setup(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  let time = 1000;
  const store = createIdentityStore({ db, now: () => time });
  store.registerVerifiedKey(root);
  const id = store.registerVerifiedKey(alice);
  const grant = (extra = {}) => store.grant({ signingKey: root, personId: id, role: 'mentor', branchId: 'madeira', ...extra });
  const permits = (extra = {}) => store.permits({ pubkey: alice, permission: 'sales.read.own', branchId: 'madeira', ...extra });
  return { db, store, id, grant, permits, advance: value => { time = value; } };
}
test('registration is stable and grants no access', t => {
  const f = setup(t); assert.equal(f.store.registerVerifiedKey(alice), f.id); assert.equal(f.permits(), false);
  assert.throws(() => f.store.registerVerifiedKey('nsec1secret'), /Invalid/);
});
test('rotation preserves person and grants while retired key loses access', t => {
  const f = setup(t); f.grant();
  f.store.replaceVerifiedKey({ signingKey: alice, personId: f.id, oldKey: alice, newKey: rotated });
  assert.equal(f.store.resolve(rotated), f.id); assert.equal(f.store.resolve(alice), null);
  assert.equal(f.permits(), false); assert.equal(f.permits({ pubkey: rotated }), true);
  assert.throws(() => f.store.registerVerifiedKey(alice), /Retired/);
  assert.equal(f.db.prepare("SELECT signingKey FROM network_identity_audit WHERE action='identity.key-replaced'").get().signingKey, alice);
});
test('existing key cannot be reassigned and failed rotation leaves old access intact', t => {
  const f = setup(t); f.grant();
  assert.throws(() => f.store.replaceVerifiedKey({ signingKey: root, personId: f.id, oldKey: alice, newKey: root }));
  assert.equal(f.permits(), true);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM network_identity_audit WHERE action='identity.key-replaced'").get().n, 0);
});
test('branch boundaries and role separation are enforced', t => {
  const f = setup(t); f.grant({ role: 'branch_manager' });
  assert.equal(f.permits(), false);
  assert.equal(f.permits({ permission: 'sales.read.branch' }), true);
  assert.equal(f.permits({ permission: 'sales.read.branch', branchId: 'warsaw' }), false);
  assert.equal(f.permits({ permission: 'content.draft.branch' }), false);
  assert.throws(() => f.grant({ role: 'super_admin' }), /Invalid/);
});
test('effective intervals and immediate revocation are checked on every use', t => {
  const f = setup(t); const id = f.grant({ validFrom: 2000, validUntil: 3000 });
  assert.equal(f.permits(), false); f.advance(2000); assert.equal(f.permits(), true);
  f.store.revoke({ signingKey: root, grantId: id }); assert.equal(f.permits(), false);
  f.grant({ validUntil: 3000 }); assert.equal(f.permits(), true);
  f.advance(3000); assert.equal(f.permits(), false);
});
test('failed mutations are atomic and audit cannot be edited', t => {
  const f = setup(t);
  assert.throws(() => f.grant({ signingKey: rotated }), /inactive/);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM network_grants').get().n, 0);
  assert.throws(() => f.db.exec('DELETE FROM network_identity_audit'), /append-only/);
  assert.throws(() => f.db.exec("UPDATE network_identity_audit SET action='changed'"), /append-only/);
});
