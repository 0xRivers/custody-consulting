import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readSalesLedger } from './sales-ledger.mjs';
function fixture(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(`
CREATE TABLE bookings(reference TEXT PRIMARY KEY,startsAt TEXT,state TEXT,paymentId TEXT,provider TEXT,settledRail TEXT,priceCurrency TEXT,priceMinorUnits INTEGER,settledSats INTEGER,resultToken TEXT);
CREATE TABLE mentor_booking_attribution(reference TEXT PRIMARY KEY,mentorPubkey TEXT);
CREATE TABLE payment_reviews(reference TEXT PRIMARY KEY,invoiceId TEXT,startsAt TEXT,reason TEXT,slotReleased INTEGER,invoiceStatus TEXT,firstSeen INTEGER,lastSeen INTEGER);
CREATE TABLE payment_resolutions(reference TEXT PRIMARY KEY,state TEXT);
`);const booking=(reference,mentor=null,state='confirmed',currency='PLN',amount=42000)=>{db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?)').run(reference,'2026-11-20T10:00:00Z',state,'pay-'+reference,'stripe',null,currency,amount,null,'PRIVATE_RESULT_TOKEN');if(mentor)db.prepare('INSERT INTO mentor_booking_attribution VALUES (?,?)').run(reference,mentor);};const review=reference=>db.prepare('INSERT INTO payment_reviews VALUES (?,?,?,?,?,?,?,?)').run(reference,'invoice-'+reference,'2026-11-20T10:00:00Z','late-payment',1,'Expired',1,2);return {db,booking,review};}
test('one row per booking combines review state; orphan review remains actionable with unknown amount',t=>{
 const f=fixture(t);f.booking('a');f.review('a');f.review('orphan');
 const ledger=readSalesLedger({db:f.db,includeReviews:true});assert.equal(ledger.total,2);assert.equal(ledger.needsReview,2);
 const a=ledger.rows.find(r=>r.reference==='a');assert.equal(a.status,'review');assert.equal(a.reviewReason,'late-payment');assert.equal(a.bookingState,'confirmed');assert.equal(a.reviewPaymentStatus,'Expired');
 assert.equal(ledger.rows.find(r=>r.reference==='orphan').minorUnits,null);
 f.db.prepare('INSERT INTO payment_resolutions VALUES (?,?)').run('a','confirmed');
 const resolved=readSalesLedger({db:f.db,includeReviews:true});assert.equal(resolved.rows.find(r=>r.reference==='a').status,'confirmed');assert.equal(resolved.needsReview,1);
});
test('mentor scope includes historical keys only and omits staff review details and result tokens',t=>{
 const f=fixture(t);f.booking('old','old-key');f.booking('new','new-key');f.booking('other','other-key');f.booking('direct');f.review('old');f.review('orphan');
 const ledger=readSalesLedger({db:f.db,mentorKeys:['old-key','new-key']});assert.equal(ledger.total,2);assert.equal(ledger.canReview,false);assert.equal(ledger.needsReview,0);
 assert.ok(ledger.rows.every(r=>['old-key','new-key'].includes(r.mentorPubkey)&&r.reviewInvoiceId===null));assert.ok(!JSON.stringify(ledger).includes('PRIVATE_RESULT_TOKEN'));
 assert.equal(readSalesLedger({db:f.db}).total,4);
});
test('pagination reaches all bookings without duplicated references and status filters apply server-side',t=>{
 const f=fixture(t);for(let i=0;i<61;i++)f.booking('booking-'+String(i).padStart(3,'0'),null,i%2?'pending':'confirmed');
 const refs=[];for(let page=1;page<=3;page++){const result=readSalesLedger({db:f.db,request:{page}});assert.equal(result.total,61);refs.push(...result.rows.map(r=>r.reference));assert.equal(result.hasNext,page<3);}
 assert.equal(new Set(refs).size,61);assert.equal(readSalesLedger({db:f.db,request:{status:'pending'}}).total,30);
});
test('search is literal and bound; clients cannot supply authorization or review flags',t=>{
 const f=fixture(t);f.booking('literal_%');f.booking('other');
 assert.equal(readSalesLedger({db:f.db,request:{query:'_%'}}).total,1);
 assert.equal(readSalesLedger({db:f.db,request:{query:"' OR 1=1 --"}}).total,0);
 for(const request of [{includeReviews:true},{mentorKeys:['other']},{page:-1},{status:'refund-everything'},{query:'x'.repeat(121)}])assert.throws(()=>readSalesLedger({db:f.db,request}),e=>e.status===400);
 assert.throws(()=>readSalesLedger({db:f.db,mentorKeys:[]}),e=>e.status===403);
});
test('amounts and currencies stay raw and independent; unissued checkouts are not sales rows',t=>{
 const f=fixture(t);f.booking('yen',null,'confirmed','JPY',500);f.booking('dinar',null,'confirmed','KWD',1234);f.booking('unissued');f.db.prepare('UPDATE bookings SET paymentId=NULL WHERE reference=?').run('unissued');
 const result=readSalesLedger({db:f.db});assert.equal(result.total,2);assert.equal(result.rows.find(r=>r.currency==='JPY').minorUnits,500);assert.equal(result.rows.find(r=>r.currency==='KWD').minorUnits,1234);
});
