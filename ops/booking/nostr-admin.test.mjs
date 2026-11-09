import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateSecretKey, getPublicKey, finalizeEvent} from 'nostr-tools/pure';
import {npubEncode} from 'nostr-tools/nip19';
import {createNostrAdmin} from './nostr-admin.mjs';

function setup() {
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE invitations (tokenHash TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, reference TEXT UNIQUE)');
  const secret=generateSecretKey(),pubkey=getPublicKey(secret);
  let time=1800000000000;
  const admin=createNostrAdmin({db,allowlist:npubEncode(pubkey),now:()=>time});
  return {db,secret,pubkey,admin,advance:()=>{time+=120001;}};
}
test('approved signatures create standard 24-hour invitations and audit their creator; replay fails',()=> {
  const {db,secret,pubkey,admin}=setup();
  const {event}=admin.challenge({pubkey,locale:'pl'});
  const signed=finalizeEvent(event,secret);
  const invite=admin.invite({event:signed,locale:'pl'});
  assert.match(invite.url,/^https:\/\/staging\.custody\.consulting\/payment\/\?lang=pl#invite=[A-Za-z0-9_-]{43}$/);
  assert.equal(invite.expiresAt,1800000000000+86400000);
  assert.equal(db.prepare('SELECT pubkey FROM admin_invite_audit').get().pubkey,pubkey);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invitations').get().n,1);
  assert.throws(()=>admin.invite({event:signed,locale:'pl'}),/ADMIN_CHALLENGE_EXPIRED/);
});
test('unknown accounts and empty allowlists cannot issue challenges or invites',()=> {
  const {db,admin,pubkey}=setup();
  const other=generateSecretKey();
  assert.throws(()=>admin.challenge({pubkey:getPublicKey(other),locale:'en'}),/ADMIN_NOT_ALLOWED/);
  const disabled=createNostrAdmin({db});
  assert.throws(()=>disabled.challenge({pubkey,locale:'en'}),/ADMIN_NOT_ALLOWED/);
  assert.throws(()=>createNostrAdmin({db,allowlist:'nsec-invalid'}));
});
test('forgery, altered locale, wrong destination and expired challenges fail without issuing invitations',()=> {
  const {db,admin,secret,pubkey,advance}=setup();
  const {event}=admin.challenge({pubkey,locale:'en'});
  const signed=finalizeEvent(event,secret);
  assert.throws(()=>admin.invite({event:{...signed,sig:'0'.repeat(128)},locale:'en'}),/ADMIN_INVALID_SIGNATURE/);
  assert.throws(()=>admin.invite({event:signed,locale:'pl'}),/ADMIN_CHALLENGE_EXPIRED/);
  const wrong=finalizeEvent({...event,tags:event.tags.map(tag=>tag[0]==='u'?['u','https://evil.example']:tag)},secret);
  assert.throws(()=>admin.invite({event:wrong,locale:'en'}),/ADMIN_INVALID_SIGNATURE/);
  advance();
  assert.throws(()=>admin.invite({event:signed,locale:'en'}),/ADMIN_CHALLENGE_EXPIRED/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invitations').get().n,0);
});
test('creation rate limit prevents further invites from an approved key',()=> {
  const {db,admin,secret,pubkey}=setup();
  for(let i=0;i<30;i++) {
    const {event}=admin.challenge({pubkey,locale:'en'});
    admin.invite({event:finalizeEvent(event,secret),locale:'en'});
  }
  const {event}=admin.challenge({pubkey,locale:'en'});
  assert.throws(()=>admin.invite({event:finalizeEvent(event,secret),locale:'en'}),/ADMIN_RATE_LIMIT/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invitations').get().n,30);
});

test('review queue requires its own signed purpose; invite signatures cannot read it and signatures cannot be replayed',()=> {
  const {db,secret,pubkey,admin}=setup();
  db.prepare('INSERT INTO payment_reviews VALUES (?,?,?,?,?,?,?,?)').run('booking','Invoice1','2026-12-01T10:00:00Z','late-payment',1,'Expired',1,2);
  const invite=admin.challenge({pubkey,locale:'en'});
  const signedInvite=finalizeEvent(invite.event,secret);
  assert.throws(()=>admin.reviews({event:signedInvite,locale:'en'}),/ADMIN_CHALLENGE_EXPIRED/);
  const review=admin.challenge({pubkey,locale:'en',purpose:'reviews'});
  const signedReview=finalizeEvent(review.event,secret);
  assert.throws(()=>admin.invite({event:signedReview,locale:'en'}),/ADMIN_CHALLENGE_EXPIRED/);
  assert.equal(admin.reviews({event:signedReview,locale:'en'}).reviews[0].reason,'late-payment');
  assert.throws(()=>admin.reviews({event:signedReview,locale:'en'}),/ADMIN_CHALLENGE_EXPIRED/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invitations').get().n,0);
});
test('sales totals require a single-use sales signature and separate payment methods and currencies',()=> {
  const {db,secret,pubkey,admin}=setup();
  db.exec(`CREATE TABLE bookings (
    reference TEXT, paymentId TEXT, provider TEXT, settledRail TEXT,
    priceCurrency TEXT, priceMinorUnits INTEGER, settledSats INTEGER, state TEXT
  );
  INSERT INTO bookings VALUES
    ('a','cs_a','stripe',NULL,'PLN',42000,NULL,'confirmed'),
    ('b','cs_b','stripe',NULL,'EUR',9500,NULL,'confirmed'),
    ('c','btc_c','btcpay','lightning','PLN',500,1000,'confirmed'),
    ('d','btc_d','btcpay','lightning','PLN',500,NULL,'confirmed'),
    ('e','btc_e','btcpay','lightning','PLN',500,NULL,'pending');`);
  const sign=purpose=>finalizeEvent(admin.challenge({pubkey,locale:'en',purpose}).event,secret);
  assert.throws(()=>admin.sales({event:sign('reviews'),locale:'en'}),/ADMIN_CHALLENGE_EXPIRED/);
  const event=sign('sales');
  const {totals,recent}=admin.sales({event,locale:'en'});
  assert.deepEqual(totals.map(row=>[row.provider,row.currency,row.minorUnits,row.sats,row.satsCount]),[
    ['btcpay','PLN',1000,1000,1],['stripe','EUR',9500,null,0],['stripe','PLN',42000,null,0],
  ]);
  assert.deepEqual(recent.map(row=>row.reference),['d','c','b','a']);
  assert.throws(()=>admin.sales({event,locale:'en'}),/ADMIN_CHALLENGE_EXPIRED/);
});

test('resolution signatures bind the appointment and preview hash and cannot authorize another action',()=> {
  const {admin,secret,pubkey}=setup();
  const request={reference:'original',start:'2030-01-01T10:00:00Z',previewHash:'a'.repeat(64)};
  const {event}=admin.challenge({pubkey,locale:'en',purpose:'resolve-confirm',request});
  const signed=finalizeEvent(event,secret);
  assert.throws(()=>admin.resolution({event:signed,locale:'en'},'resolve-preview'),/ADMIN_CHALLENGE_EXPIRED/);
  assert.deepEqual(admin.resolution({event:signed,locale:'en'},'resolve-confirm').request,request);
  assert.throws(()=>admin.resolution({event:signed,locale:'en'},'resolve-confirm'),/ADMIN_CHALLENGE_EXPIRED/);
});
