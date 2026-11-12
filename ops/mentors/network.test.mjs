import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { npubEncode } from 'nostr-tools/nip19';
import { createHash } from 'node:crypto';
import { createMentorNetwork } from './network.mjs';
import { createIdentityStore } from './identity-store.mjs';
const identity=()=>{const secret=generateSecretKey(),pubkey=getPublicKey(secret);return {secret,pubkey,npub:npubEncode(pubkey)};};
function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec('CREATE TABLE invitations(tokenHash TEXT PRIMARY KEY,expiresAt INTEGER,reference TEXT); CREATE TABLE bookings(reference TEXT PRIMARY KEY,provider TEXT,state TEXT,paymentId TEXT,settledRail TEXT,priceCurrency TEXT,priceMinorUnits INTEGER,settledSats INTEGER);');
 let time=1800000000000;const root=identity(),alice=identity(),bob=identity();
 const network=createMentorNetwork({db,superAdminNpub:root.npub,origin:'https://staging.custody.consulting',now:()=>time});
 const sign=(user,purpose,request={})=>finalizeEvent(network.challenge({npub:user.npub,purpose,request}).event,user.secret);
 const run=(user,purpose,request={})=>network.execute({event:sign(user,purpose,request)});
 const grant=(user,mentor,editor)=>run(root,'roles-set',{npub:user.npub,mentor,editor});
 const apply=user=>run(user,'apply',{displayName:'Test Mentor',city:'Funchal',countryCode:'PT',timezone:'Atlantic/Madeira',languages:['en','pl'],experience:'Teaching Bitcoin backups and safe recovery procedures for several years.',consent:true});
 const invite=user=>createHash('sha256').update(run(user,'issue-invite',{locale:'en'}).url.split('#invite=')[1]).digest('hex');
 const booking=(reference,token,currency='PLN',amount=42000)=>{db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?)').run(reference,'stripe','confirmed','pay-'+reference,null,currency,amount,null);if(token)network.attributeBooking(reference,token);};
 return {db,network,root,alice,bob,run,sign,grant,apply,invite,booking,now:()=>time,advance:()=>{time+=1800001;}};
}
test('explicit business root has separate authority; registration grants no roles',t=>{
 const f=fixture(t);assert.throws(()=>createMentorNetwork({db:f.db}),/public npub/);
 f.run(f.alice,'session-start');assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles,[]);
 assert.throws(()=>f.run(f.alice,'sales'),/network access/);
});
test('owner assigns mentor/editor independently, both together or neither before first sign-in',t=>{
 const f=fixture(t);f.grant(f.alice,true,true);
 assert.equal(f.run(f.root,'members').members[0].pending,true);
 f.run(f.alice,'session-start');assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles.map(r=>r.role),['editor','mentor']);
 assert.equal(f.network.canEdit(f.alice.pubkey),true);assert.ok(f.invite(f.alice));
 f.grant(f.alice,true,false);assert.equal(f.network.canEdit(f.alice.pubkey),false);
 f.grant(f.alice,false,true);assert.throws(()=>f.run(f.alice,'issue-invite',{locale:'en'}),/Mentor access/);assert.throws(()=>f.run(f.alice,'sales'),/unavailable/);
 f.grant(f.alice,false,false);assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles,[]);
});
test('only owner can assign roles; malformed, extra or retired role fields are rejected atomically',t=>{
 const f=fixture(t);f.grant(f.alice,true,false);f.run(f.alice,'session-start');
 assert.throws(()=>f.run(f.alice,'roles-set',{npub:f.bob.npub,mentor:true,editor:true}),/Only the Custody/);
 for(const input of [{npub:f.bob.npub,mentor:true,editor:'yes'},{npub:f.bob.npub,mentor:true,editor:true,branchId:'x'},{npub:f.bob.npub,mentor:true,editor:true,superAdmin:true}]) assert.throws(()=>f.run(f.root,'roles-set',input));
 assert.equal(f.run(f.root,'members').members.length,1);
 for(const purpose of ['branches','create-branch','role-update','content-assign'])assert.throws(()=>f.sign(f.root,purpose),/Unknown/);
});
test('mentor approval has no branch prerequisite and preserves a separately assigned editor role',t=>{
 const f=fixture(t);const app=f.apply(f.alice);f.grant(f.alice,false,true);
 assert.throws(()=>f.apply(f.alice),/awaiting review/);
 f.run(f.root,'approve',{applicationId:app.id});
 assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles.map(r=>r.role),['editor','mentor']);
 assert.equal(f.run(f.alice,'my-status').applications[0].state,'approved');
 assert.throws(()=>f.run(f.root,'approve',{applicationId:app.id}),/no longer/);
});
test('mentor sales are own-only, currencies separate, legacy/direct bookings remain visible to owner',t=>{
 const f=fixture(t);f.grant(f.alice,true,false);f.grant(f.bob,true,false);f.run(f.alice,'session-start');f.run(f.bob,'session-start');
 f.booking('a',f.invite(f.alice));f.booking('b',f.invite(f.bob));f.booking('e',f.invite(f.alice),'EUR',10000);f.booking('direct');
 f.booking('pending',f.invite(f.alice));f.db.prepare("UPDATE bookings SET state='pending' WHERE reference='pending'").run();
 const own=f.run(f.alice,'sales');assert.equal(own.totals.length,2);assert.ok(own.totals.every(r=>r.mentorPubkey===f.alice.pubkey));assert.equal(own.unassignedIncluded,false);
 assert.equal(f.run(f.root,'sales').totals.reduce((sum,r)=>sum+r.count,0),4);
});
test('revocation removes sessions and prepared requests and regrant cannot revive them',t=>{
 const f=fixture(t);f.grant(f.alice,true,true);const token=f.run(f.alice,'session-start').sessionToken;const content=f.run(f.alice,'content-session-start').contentSessionToken;const event=f.sign(f.alice,'issue-invite',{locale:'en'});
 f.grant(f.alice,false,false);
 assert.throws(()=>f.network.readSession({token,purpose:'my-status'}),/expired/);
 assert.throws(()=>f.network.requireContentSession(content),/ended/);
 assert.throws(()=>f.network.execute({event}),/expired/);
 f.grant(f.alice,true,true);assert.throws(()=>f.network.requireContentSession(content),/ended/);
});
test('signatures are bound to payload and cannot be replayed or used after expiry',t=>{
 const f=fixture(t);const event=f.sign(f.root,'roles-set',{npub:f.alice.npub,mentor:true,editor:false});
 assert.throws(()=>f.network.execute({event:{...event,content:'forged'}}),/does not match/);
 f.network.execute({event});assert.throws(()=>f.network.execute({event}),/expired/);
 const expired=f.sign(f.root,'members');f.advance();assert.throws(()=>f.network.execute({event:expired}),/expired/);
});
test('key rotation preserves both roles, applications and historical attribution',t=>{
 const f=fixture(t);const app=f.apply(f.alice);f.run(f.root,'approve',{applicationId:app.id});f.grant(f.alice,true,true);f.booking('old',f.invite(f.alice));
 const keys=createIdentityStore({db:f.db,now:f.now});const personId=keys.resolve(f.alice.pubkey),replacement=identity();
 keys.replaceVerifiedKey({signingKey:f.alice.pubkey,personId,oldKey:f.alice.pubkey,newKey:replacement.pubkey});
 assert.equal(f.run(replacement,'sales').totals[0].count,1);assert.equal(f.network.canEdit(replacement.pubkey),true);
 assert.equal(f.run(replacement,'my-status').applications[0].id,app.id);
 assert.throws(()=>f.run(f.alice,'session-start'),/retired/);
 assert.throws(()=>f.grant(f.alice,false,false),/retired/);
});
test('legacy mentor/editor roles migrate once while branch managers lose access',t=>{
 const f=fixture(t);f.db.exec("CREATE TABLE custody_branches(id TEXT PRIMARY KEY,active INTEGER); INSERT INTO custody_branches VALUES ('old-location',1),('other-location',1);");f.db.prepare('INSERT INTO custody_roles VALUES (?,?,?,?,?,?)').run(f.alice.pubkey,'mentor','old-location',1,f.now(),f.root.pubkey);
 f.db.prepare('INSERT INTO custody_roles VALUES (?,?,?,?,?,?)').run(f.alice.pubkey,'editor','other-location',1,f.now(),f.root.pubkey);
 f.db.prepare('INSERT INTO custody_roles VALUES (?,?,?,?,?,?)').run(f.bob.pubkey,'branch_manager','old-location',1,f.now(),f.root.pubkey);
 f.run(f.alice,'session-start');f.run(f.bob,'session-start');assert.equal(f.network.capabilities(f.alice.pubkey).roles.length,2);assert.deepEqual(f.network.capabilities(f.bob.pubkey).roles,[]);
 f.grant(f.alice,false,false);f.run(f.alice,'session-start');assert.deepEqual(f.network.capabilities(f.alice.pubkey).roles,[]);
});
test('sessions permit only reads, expire and logout; root stays root with both role boxes clear',t=>{
 const f=fixture(t);f.grant(f.root,false,false);const token=f.run(f.root,'session-start').sessionToken;
 assert.equal(f.network.readSession({token,purpose:'my-status'}).superAdmin,true);
 assert.throws(()=>f.network.readSession({token,purpose:'roles-set'}),/fresh signature/);
 f.network.endSession(token);assert.throws(()=>f.network.readSession({token,purpose:'members'}),/expired/);
 const second=f.run(f.root,'session-start').sessionToken;f.advance();assert.throws(()=>f.network.readSession({token:second,purpose:'members'}),/expired/);
});
test('attribution and audits remain immutable with idempotent booking binding',t=>{
 const f=fixture(t);f.grant(f.alice,true,false);f.run(f.alice,'session-start');const token=f.invite(f.alice);f.booking('a',token);f.network.attributeBooking('a',token);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM mentor_booking_attribution').get().n,1);
 assert.throws(()=>f.db.exec("UPDATE mentor_booking_attribution SET mentorPubkey='x'"),/immutable/);
 assert.throws(()=>f.db.exec('DELETE FROM custody_role_audit'),/immutable/);
});


test('inactive legacy branches cannot reactivate grants during migration',t=>{
 const f=fixture(t);f.db.exec("CREATE TABLE custody_branches(id TEXT PRIMARY KEY,active INTEGER); INSERT INTO custody_branches VALUES ('closed',0);");
 f.db.prepare('INSERT INTO custody_roles VALUES (?,?,?,?,?,?)').run(f.alice.pubkey,'editor','closed',1,f.now(),f.root.pubkey);
 f.run(f.alice,'session-start');assert.equal(f.network.canEdit(f.alice.pubkey),false);
 assert.equal(f.db.prepare('SELECT active FROM custody_roles WHERE pubkey=?').get(f.alice.pubkey).active,0);
});
