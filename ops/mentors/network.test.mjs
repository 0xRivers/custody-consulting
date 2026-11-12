import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { npubEncode } from 'nostr-tools/nip19';
import { createHash } from 'node:crypto';
import { createMentorNetwork } from './network.mjs';
import { createArticleAccess } from '../booking/content-cms/article-access.mjs';
import { createIdentityStore } from './identity-store.mjs';
const identity = () => { const secret = generateSecretKey(), pubkey = getPublicKey(secret); return { secret, pubkey, npub: npubEncode(pubkey) }; };
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE invitations(tokenHash TEXT PRIMARY KEY,expiresAt INTEGER NOT NULL,reference TEXT UNIQUE);
  CREATE TABLE bookings(reference TEXT PRIMARY KEY,provider TEXT,state TEXT,paymentId TEXT,settledRail TEXT,priceCurrency TEXT,priceMinorUnits INTEGER,settledSats INTEGER);`);
  const root = identity(), alice = identity(), bob = identity(), outsider = identity(); let now = 1800000000000;
  const network = createMentorNetwork({ db, superAdminNpub: root.npub, origin: 'https://staging.custody.consulting', now: () => now });
  const sign = (user, purpose, request = {}) => finalizeEvent(network.challenge({ npub: user.npub, purpose, request }).event, user.secret);
  const run = (user, purpose, request = {}) => network.execute({ event: sign(user, purpose, request) });
  const branch = id => run(root, 'create-branch', { id, name: `Custody Consulting ${id}`, city: id, countryCode: 'PT', timezone: 'Atlantic/Madeira' });
  const apply = user => run(user, 'apply', { displayName: 'A mentor candidate', city: 'Funchal', countryCode: 'PT', timezone: 'Atlantic/Madeira', languages: ['en', 'pl'], experience: 'Experience teaching Bitcoin wallet backups and safe recovery procedures.', consent: true });
  const approve = (user, branchId) => run(root, 'approve', { applicationId: apply(user).id, branchId });
  const invite = (user, branchId) => {
    const result = run(user, 'issue-invite', { branchId, locale: 'en' });
    return createHash('sha256').update(result.url.split('#invite=')[1]).digest('hex');
  };
  const booking = (id, token, currency = 'PLN', amount = 42000) => {
    db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?)').run(id, 'stripe', 'confirmed', `pay-${id}`, null, currency, amount, null);
    if (token) network.attributeBooking(id, token);
  };
  return { db, root, alice, bob, outsider, network, run, sign, branch, apply, approve, invite, booking, advance: () => { now += 61000; } };
}

test('business npub is explicit and cannot fall back to a personal owner', () => {
  const db = new DatabaseSync(':memory:');
  assert.throws(() => createMentorNetwork({ db, origin: 'https://custody.consulting' }), /public npub/);
  const secret = generateSecretKey();
  assert.throws(() => createMentorNetwork({ db, superAdminNpub: 'nsec1private', origin: 'https://custody.consulting' }), /public npub/);
  const f = fixture();
  assert.equal(f.network.capabilities(f.root.pubkey).superAdmin, true);
  assert.equal(f.network.capabilities(getPublicKey(secret)).superAdmin, false);
});

test('signed application is pending only, duplicate pending applications do not create access', () => {
  const f = fixture(); const application = f.apply(f.alice);
  assert.equal(application.state, 'pending'); assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles, []);
  assert.throws(() => f.run(f.alice, 'sales'), /does not have network access/);
  assert.throws(() => f.apply(f.alice), /already have an application/);
  assert.equal(f.run(f.alice, 'my-status').applications.length, 1);
  assert.equal(f.run(f.bob, 'my-status').applications.length, 0);
});

test('approval and branch creation require the exact super-admin key', () => {
  const f = fixture(); f.branch('madeira'); const application = f.apply(f.alice);
  assert.throws(() => f.run(f.outsider, 'approve', { applicationId: application.id, branchId: 'madeira' }), /network access/);
  f.run(f.root, 'approve', { applicationId: application.id, branchId: 'madeira' });
  assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles.map(role => role.role), ['mentor']);
  assert.throws(() => f.run(f.alice, 'create-branch', { id: 'stolen' }), /Only the Custody/);
  assert.throws(() => f.run(f.alice, 'applications'), /Only the Custody/);
  assert.throws(() => f.run(f.alice, 'approve', { applicationId: application.id, branchId: 'madeira' }), /Only the Custody/);
});

test('signatures are action-bound, cannot be replayed, and expire', () => {
  const f = fixture(); const signed = f.sign(f.root, 'my-status');
  const forged = { ...signed, tags: signed.tags.map(tag => tag[0] === 'u' ? ['u', 'https://attacker.example'] : tag) };
  assert.throws(() => f.network.execute({ event: forged }), /does not match/);
  assert.equal(f.network.execute({ event: signed }).superAdmin, true);
  assert.throws(() => f.network.execute({ event: signed }), /already used/);
  const expired = f.sign(f.root, 'my-status'); f.advance();
  assert.throws(() => f.network.execute({ event: expired }), /expired/);
  const wrong = f.sign(f.root, 'my-status');
  assert.throws(() => f.network.execute({ event: { ...wrong, sig: '0'.repeat(128) } }), /signature/);
});

test('mentors see only their own attributed sales; root sees all and unassigned', () => {
  const f = fixture(); f.branch('madeira'); f.branch('lisbon'); f.approve(f.alice, 'madeira'); f.approve(f.bob, 'lisbon');
  f.booking('alice-sale', f.invite(f.alice, 'madeira')); f.booking('bob-sale', f.invite(f.bob, 'lisbon')); f.booking('legacy-sale', null);
  const own = f.run(f.alice, 'sales'); assert.equal(own.totals.length, 1); assert.equal(own.totals[0].mentorPubkey, f.alice.pubkey); assert.equal(own.unassignedIncluded, false);
  assert.throws(() => f.run(f.alice, 'sales', { branchId: 'lisbon' }), /outside your sales scope/);
  const all = f.run(f.root, 'sales'); assert.equal(all.totals.length, 3); assert.equal(all.unassignedIncluded, true);
  assert.ok(all.totals.some(total => total.branchId === null)); assert.match(all.basis, /not net revenue/);
});

test('branch manager has only branch sales and cannot delegate roles or publish', () => {
  const f = fixture(); f.branch('madeira'); f.branch('lisbon'); f.approve(f.alice, 'madeira'); f.approve(f.bob, 'lisbon');
  f.booking('a', f.invite(f.alice, 'madeira')); f.booking('b', f.invite(f.bob, 'lisbon'));
  f.run(f.outsider, 'my-status');
  f.run(f.root, 'role-update', { npub: f.outsider.npub, role: 'branch_manager', branchId: 'madeira', active: true });
  const sales = f.run(f.outsider, 'sales'); assert.equal(sales.totals.length, 1); assert.equal(sales.totals[0].branchId, 'madeira');
  assert.throws(() => f.run(f.outsider, 'role-update', { npub: f.bob.npub, role: 'mentor', branchId: 'madeira', active: true }), /Only the Custody/);
  assert.throws(() => f.run(f.outsider, 'issue-invite', { branchId: 'madeira', locale: 'en' }), /cannot create/);
  assert.throws(() => f.run(f.root, 'role-update', { npub: f.bob.npub, role: 'super_admin', branchId: 'madeira', active: true }), /cannot be delegated/);
  assert.throws(() => f.run(f.alice, 'publish'), /Unknown network action/);
});

test('revocation takes effect on a pending signed action and does not rewrite sales', () => {
  const f = fixture(); f.branch('madeira'); f.approve(f.alice, 'madeira');
  const token = f.invite(f.alice, 'madeira'); f.booking('a', token);
  const pending = f.sign(f.alice, 'sales');
  f.run(f.root, 'role-update', { npub: f.alice.npub, role: 'mentor', branchId: 'madeira', active: false });
  assert.throws(() => f.network.execute({ event: pending }), /Sales access|expired/);
  assert.equal(f.run(f.root, 'sales').totals[0].mentorPubkey, f.alice.pubkey);
  assert.throws(() => f.db.prepare("UPDATE mentor_booking_attribution SET branchId='elsewhere'").run(), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM mentor_booking_attribution').run(), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM custody_role_audit').run(), /immutable/);
});

test('currencies remain separate and pending payments never count as confirmed sales', () => {
  const f = fixture(); f.branch('madeira'); f.approve(f.alice, 'madeira');
  f.booking('pln', f.invite(f.alice, 'madeira'), 'PLN', 42000); f.booking('eur', f.invite(f.alice, 'madeira'), 'EUR', 10000);
  f.booking('pending', f.invite(f.alice, 'madeira')); f.db.prepare("UPDATE bookings SET state='pending' WHERE reference='pending'").run();
  const totals = f.run(f.alice, 'sales').totals; assert.equal(totals.length, 2);
  assert.deepEqual(totals.map(total => total.currency).sort(), ['EUR', 'PLN']); assert.equal(totals.reduce((n, total) => n + total.count, 0), 2);
});

test('attribution comes from server-issued invitation and cannot be reassigned', () => {
  const f = fixture(); f.branch('madeira'); f.approve(f.alice, 'madeira'); f.approve(f.bob, 'madeira');
  const token = f.invite(f.alice, 'madeira'); f.booking('a', token); f.network.attributeBooking('a', token);
  assert.throws(() => f.network.attributeBooking('a', f.invite(f.bob, 'madeira')), /conflicts/);
  f.network.attributeBooking('legacy', 'unknown');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM mentor_booking_attribution').get().n, 1);
});


test('rotation keeps sales and application history; old pending signatures cannot execute', () => {
  const f = fixture(); f.branch('madeira'); f.approve(f.alice, 'madeira');
  f.booking('before-rotation', f.invite(f.alice, 'madeira'));
  const pending = f.sign(f.alice, 'sales');
  const keys = createIdentityStore({ db: f.db, now: () => 1800000000000 });
  const personId = keys.resolve(f.alice.pubkey);
  const replacement = identity();
  keys.replaceVerifiedKey({ signingKey: f.alice.pubkey, personId, oldKey: f.alice.pubkey, newKey: replacement.pubkey });
  assert.throws(() => f.network.execute({ event: pending }), /retired/);
  const sales = f.run(replacement, 'sales');
  assert.equal(sales.totals.length, 1); assert.equal(sales.totals[0].count, 1);
  assert.equal(f.run(replacement, 'my-status').applications[0].state, 'approved');
  f.run(f.root, 'role-update', { npub: replacement.npub, role: 'mentor', branchId: 'madeira', active: false });
  assert.throws(() => f.run(replacement, 'sales'), /does not have network access/);
});

test('requesting a challenge does not enroll an unverified key or allow grants', () => {
  const f = fixture(); f.branch('madeira');
  f.network.challenge({ npub: f.alice.npub, purpose: 'my-status' });
  assert.equal(f.db.prepare('SELECT personId FROM network_identity_keys WHERE pubkey=?').get(f.alice.pubkey), undefined);
  assert.throws(() => f.run(f.root, 'role-update', { npub: f.alice.npub, role: 'mentor', branchId: 'madeira', active: true }), /first connect/);
});

test('sessions allow current scoped reads, forbid mutations, rotate and expire', () => {
  const f = fixture(); f.branch('madeira'); f.approve(f.alice, 'madeira');
  const token = f.run(f.alice, 'session-start').sessionToken;
  const read = purpose => f.network.readSession({ token, purpose });
  assert.equal(read('my-status').roles[0].branchId, 'madeira');
  assert.equal(read('sales').totals.length, 0);
  assert.throws(() => read('approve'), /fresh signature/);
  assert.throws(() => read('applications'), /Only the Custody/);
  f.run(f.root, 'role-update', { npub: f.alice.npub, role: 'mentor', branchId: 'madeira', active: false });
  assert.throws(() => read('sales'), /expired/);
  const next = f.run(f.alice, 'session-start').sessionToken;
  assert.throws(() => read('my-status'), /expired/);
  f.network.endSession(next);
  assert.throws(() => f.network.readSession({ token: next, purpose: 'my-status' }), /expired/);
  const expired = f.run(f.alice, 'session-start').sessionToken;
  for (let i = 0; i < 30; i++) f.advance();
  assert.throws(() => f.network.readSession({ token: expired, purpose: 'my-status' }), /expired/);
});

test('retiring a key immediately invalidates its sessions', () => {
  const f = fixture(); const token = f.run(f.alice, 'session-start').sessionToken;
  const keys = createIdentityStore({ db: f.db, now: () => 1800000000000 });
  keys.replaceVerifiedKey({ signingKey: f.alice.pubkey, personId: keys.resolve(f.alice.pubkey), oldKey: f.alice.pubkey, newKey: identity().pubkey });
  assert.throws(() => f.network.readSession({ token, purpose: 'my-status' }), /retired/);
  assert.equal(f.db.prepare('SELECT tokenHash FROM mentor_sessions').get().tokenHash.includes(token), false);
});


test('signed editor enrollment and owner assignments enforce live branch access', () => {
  const f = fixture(); f.branch('madeira'); f.branch('warsaw');
  f.run(f.alice, 'session-start');
  assert.throws(()=>f.run(f.alice,'content-session-start'),/network access/);
  f.run(f.root,'role-update',{npub:f.alice.npub,role:'editor',branchId:'madeira',active:true});
  f.run(f.root,'content-assign',{articleId:'foundations',branchId:'madeira'});
  const token=f.run(f.alice,'content-session-start').contentSessionToken;
  const access=createArticleAccess({db:f.db,isGlobalEditor:key=>f.network.isSuperAdmin(key),editorBranches:key=>f.network.contentBranches(key)});
  assert.deepEqual(access(f.network.requireContentSession(token)).articleIds,['foundations']);
  assert.throws(()=>f.run(f.alice,'content-assign',{articleId:'foundations',branchId:'warsaw'}),/Only the Custody/);
  f.run(f.root,'content-assign',{articleId:'foundations',branchId:'warsaw'});
  assert.deepEqual(access(f.network.requireContentSession(token)).articleIds,[]);
  f.run(f.root,'content-assign',{articleId:'foundations',branchId:null});
  assert.deepEqual(f.run(f.root,'content-assignments').assignments,[]);
  assert.throws(()=>f.run(f.root,'content-assign',{articleId:'../secrets',branchId:'madeira'}),/valid article/);
  f.run(f.root,'role-update',{npub:f.alice.npub,role:'editor',branchId:'madeira',active:false});
  assert.throws(()=>f.network.requireContentSession(token),/ended/);
  f.run(f.root,'role-update',{npub:f.alice.npub,role:'editor',branchId:'madeira',active:true});
  assert.throws(()=>f.network.requireContentSession(token),/ended/);
  assert.ok(f.db.prepare("SELECT id FROM custody_role_audit WHERE action='content.assigned'").all().length>=3);
});

test('content sessions expire, sign out and reject retired keys', () => {
  const f=fixture();f.branch('madeira');f.run(f.alice,'session-start');
  f.run(f.root,'role-update',{npub:f.alice.npub,role:'editor',branchId:'madeira',active:true});
  const token=f.run(f.alice,'content-session-start').contentSessionToken;
  f.network.endContentSession(token);assert.throws(()=>f.network.requireContentSession(token),/ended/);
  const second=f.run(f.alice,'content-session-start').contentSessionToken;
  const keys=createIdentityStore({db:f.db,now:()=>1800000000000});
  keys.replaceVerifiedKey({signingKey:f.alice.pubkey,personId:keys.resolve(f.alice.pubkey),oldKey:f.alice.pubkey,newKey:identity().pubkey});
  assert.throws(()=>f.network.requireContentSession(second),/ended/);
  const owner=f.run(f.root,'content-session-start').contentSessionToken;
  for(let i=0;i<30;i++)f.advance();
  assert.throws(()=>f.network.requireContentSession(owner),/ended/);
});
