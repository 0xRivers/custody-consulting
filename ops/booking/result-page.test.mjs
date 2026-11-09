import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../../astro/src/pages/payment/result.astro', import.meta.url), 'utf8')
  .match(/<script is:inline>([\s\S]*?)<\/script>/)[1];

async function visit(state, locale = 'en', sessionId = 'cs_test_fixture', bitcoin = false, paymentDetails, overrides={}) {
  const nodes = new Map();
  const requests = [], timers = [];
  const node=()=>({children:[],setAttribute(){},replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},addEventListener(){}});
  const document = {documentElement:{},createElement:node, getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, {...node(),hidden:id === 'appointment-row'||id === 'bitcoin-progress'});
    return nodes.get(id);
  }};
  runInNewContext(script, {
    document, URL, Intl, Date, AbortSignal,
    location:{href:`https://staging.custody.consulting/payment/result/?lang=${locale}&${bitcoin?'checkout='+('a'.repeat(43)):'session_id='+sessionId}`, pathname:'/payment/result/'},
    history:{replaceState(){}}, sessionStorage:{getItem(){return null;}, setItem(){}},
    setTimeout(callback){timers.push(callback);},
    fetch:async (url, options) => {requests.push(JSON.parse(options.body)); return {ok:true, json:async () => ({state, ...(paymentDetails?{paymentDetails}:{}), ...(bitcoin?{phase:'processing'}:{}),startsAt:'2026-11-11T11:00:00Z',...overrides})};},
  });
  await new Promise(resolve => setImmediate(resolve));
  return {nodes, requests, timers};
}

test('redirect alone cannot display a confirmed booking; pending status polls', async () => {
  const pending = await visit('pending');
  assert.equal(pending.nodes.get('result-title').textContent, 'Checking your booking');
  assert.equal(pending.nodes.get('appointment-row')?.hidden ?? true, true);
  assert.equal(pending.timers.length, 1);
  assert.equal(pending.requests[0].action, 'status');
  const missing = await visit('confirmed', 'en', '');
  assert.equal(missing.requests.length, 0);
  assert.equal(missing.nodes.get('result-title').textContent, 'We couldn’t check your booking');
});

test('confirmed server status displays the appointment in English or Polish and stops polling', async () => {
  for (const locale of ['en','pl']) {
    const result = await visit('confirmed', locale);
    assert.equal(result.nodes.get('result-title').textContent, locale === 'pl' ? 'Dziękujemy!' : 'Thank you!');
    assert.equal(result.nodes.get('appointment-row').hidden, false);
    assert.equal(result.timers.length, 0);
  }
});

test('released and reconciliation states never claim confirmation', async () => {
  for (const state of ['released','reconcile']) {
    const result = await visit(state);
    assert.notEqual(result.nodes.get('result-title').textContent, 'Your call is confirmed');
    assert.equal(result.timers.length, 0);
  }
});

test('BTC result uses its opaque token and waits for network settlement rather than claiming success',async()=> {
  const pending=await visit('pending','pl','',true);
  assert.equal(pending.requests[0].checkoutToken,'a'.repeat(43));
  assert.equal(pending.nodes.get('result-title').textContent,'Dziękujemy!');
  assert.equal(pending.timers.length,1);
  const settled=await visit('confirmed','pl','',true);
  assert.equal(settled.nodes.get('result-title').textContent,'Dziękujemy!');
});

const txid='b'.repeat(64);
test('Bitcoin panel displays verified transaction and exact confirmation count without claiming appointment confirmation',async()=> {
  const details={invoiceStatus:'Processing',additionalStatus:'None',transactions:[{txid,confirmations:0}]};
  const result=await visit('pending','pl','',true,details);
  assert.equal(result.nodes.get('bitcoin-progress').hidden,false);
  assert.equal(result.nodes.get('confirmation-count').textContent,'Czekamy na potwierdzenie w sieci');
  assert.equal(result.nodes.get('step-booking').className,'');
  assert.equal(result.nodes.get('transaction-list').children[0].children[0].textContent,txid);
  assert.equal(result.timers.length,1);
});
test('missing wallet permission shows unknown count; settled policy gives a lower bound, never a made-up exact count',async()=> {
  const details={invoiceStatus:'Processing',additionalStatus:'None',transactions:[{txid,confirmations:null}]};
  const pending=await visit('pending','en','',true,details);
  assert.equal(pending.nodes.get('confirmation-count').textContent,'Checking network confirmation');
  const confirmed=await visit('confirmed','en','',true,{...details,invoiceStatus:'Settled'});
  assert.equal(confirmed.nodes.get('confirmation-count').textContent,'Network confirmation received');
  assert.equal(confirmed.nodes.get('step-booking').className,'complete');
});

test('late payment review explains slot availability without claiming the appointment is confirmed',async()=> {
  for(const locale of ['en','pl']) {
    const details={invoiceStatus:'Expired',additionalStatus:'PaidLate',transactions:[{txid,confirmations:1}]};
    const result=await visit('reconcile',locale,'',true,details,{reviewReason:'late-payment',slotReleased:true});
    assert.match(result.nodes.get('result-message').textContent,locale==='pl'?/termin mógł już zostać zwolniony/:/slot may already have been released/);
    assert.equal(result.nodes.get('appointment-row')?.hidden??true,true);
    assert.notEqual(result.nodes.get('step-booking').className,'complete');
    assert.equal(result.timers.length,1);
  }
});

test('late confirmed transaction updates network step while appointment stays under review',async()=> {
  const result=await visit('reconcile','en','',true,{invoiceStatus:'Expired',additionalStatus:'PaidLate',transactions:[{txid,confirmations:2}]},{reviewReason:'late-payment'});
  assert.equal(result.nodes.get('confirmation-count').textContent,'Network confirmation received');
  assert.equal(result.nodes.get('confirmation-icon').className,'confirmation-icon complete');
  assert.equal(result.nodes.get('confirmation-detail').textContent,'Confirmations: 2');
  assert.equal(result.nodes.get('step-network').className,'complete');
  assert.notEqual(result.nodes.get('step-booking').className,'complete');
  assert.equal(result.timers.length,1);
});

test('confirmed payment displays its verified first block height and completes block animation',async()=> {
  const result=await visit('confirmed','pl','',true,{invoiceStatus:'Settled',additionalStatus:'None',transactions:[{txid,confirmations:3,blockHeight:123456}]});
  assert.equal(result.nodes.get('confirmation-block').hidden,false);
  assert.equal(result.nodes.get('confirmation-block').textContent,'Blok pierwszego potwierdzenia: #123456');
  assert.equal(result.nodes.get('confirmation-icon').className,'confirmation-icon complete');
  const unknown=await visit('pending','en','',true,{invoiceStatus:'Processing',additionalStatus:'None',transactions:[{txid,confirmations:0,blockHeight:null}]});
  assert.equal(unknown.nodes.get('confirmation-block').hidden,true);
  assert.equal(unknown.nodes.get('confirmation-icon').className,'confirmation-icon loading');
});

test('resolved late payment shows appointment confirmed instead of a review badge',async()=> {
  const result=await visit('confirmed','en','',true,{invoiceStatus:'Expired',additionalStatus:'PaidLate',transactions:[{txid,confirmations:10,blockHeight:123456}]});
  assert.equal(result.nodes.get('transaction-status').textContent,'Payment confirmed');
  assert.equal(result.nodes.get('step-booking').className,'complete');
  assert.equal(result.nodes.get('appointment-row').hidden,false);
});


test('Lightning confirmation displays the appointment without on-chain progress',async()=> {
  const {nodes}=await visit('confirmed','en','',true,{invoiceStatus:'Settled',additionalStatus:'None'},{rail:'lightning'});
  assert.equal(nodes.get('payment-heading').textContent,'Lightning payment');
  assert.equal(nodes.get('step-network').hidden,true);
  assert.equal(nodes.get('confirmation-state').hidden,true);
  assert.equal(nodes.get('transaction-details').hidden,true);
  assert.equal(nodes.get('step-booking').className,'complete');
  assert.equal(nodes.get('appointment-row').hidden,false);
});
