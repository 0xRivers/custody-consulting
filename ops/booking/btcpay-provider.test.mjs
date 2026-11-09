import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createBTCPay,decimalUnits} from './btcpay-provider.mjs';
import {paymentDecision} from './payment-decision.mjs';

const token='a'.repeat(43),secret='fixture-webhook-secret',reference='booking1',storeId='Store123';
const now=()=>Date.parse('2026-11-05T12:10:00Z'),expiry=Date.parse('2026-11-05T12:00:00Z')/1000;
const baseInvoice={id:'Invoice123',storeId,currency:'PLN',amount:'420.00',paidAmount:'420.00',
  createdTime:expiry-35*60,expirationTime:expiry,status:'Settled',additionalStatus:'None',
  metadata:{integration:'custody-foundation-staging',orderId:reference,resultToken:token}};
const baseMethods=[{paymentMethodId:'BTC-CHAIN',currency:'BTC',paymentMethodPaid:'0.001',totalPaid:'0.001',due:'0',
  payments:[{id:'tx',status:'Settled',value:'0.001',receivedDate:expiry-30}]}];

function fixture({invoice=baseInvoice,methods=baseMethods,old=false,create,list,clock=now,network='mainnet',publicOrigin,wallet,explorerApi,explorer}={}) {
  const calls=[];
  const provider=createBTCPay({baseUrl:'http://100.66.128.124:3003',storeId,apiKey:'fixture-key',signingSecret:secret,now:clock,network,publicOrigin,explorerApi,
    request:async(url,options)=>{
      calls.push({url,options});
      if(new URL(url).hostname==='mempool.space') {assert.equal(options.headers.Authorization,undefined);return explorer(url);}
      assert.equal(options.headers.Authorization,'token fixture-key');assert.equal(options.redirect,'error');
      const path=new URL(url).pathname;
      if(path==='/swagger/v1/swagger.json')return Response.json({paths:{'/api/v1/stores/{storeId}/invoices':{},
        ...(!old?{'/api/v1/invoices/{invoiceId}':{}}:{})},components:{schemas:{PaymentMethodId:{description:old?'BTC':'BTC-CHAIN'}}}});
      if(options.method==='POST')return create?create():Response.json(invoice);
      if(path.includes('/wallet/transactions/'))return wallet?wallet(path):Response.json({}, {status:403});
      if(path.endsWith('/payment-methods'))return Response.json(methods);
      if(path.endsWith('/invoices'))return Response.json(list||[invoice]);
      return Response.json(invoice);
    }});
  return {provider,calls};
}

test('invoice creation pins 420 PLN, one on-chain method, a confirmation policy and the selected language',async()=> {
  for(const locale of ['en','pl']) {
    const creationTime=Date.parse('2026-11-05T11:25:00Z');
    const {provider,calls}=fixture({clock:()=>creationTime,invoice:{...baseInvoice,status:'New',paidAmount:'0'}});
    const checkout=await provider.createCheckout({reference,locale,resultToken:token});
    assert.equal(checkout.url,'https://pay.custody.consulting/i/Invoice123');
    assert.equal(checkout.deadline,expiry*1000);
    const body=JSON.parse(calls.find(call=>call.options.method==='POST').options.body);
    assert.equal(body.amount,'420.00');assert.equal(body.currency,'PLN');
    assert.deepEqual(body.checkout.paymentMethods,['BTC-CHAIN']);
    assert.equal(body.checkout.paymentTolerance,0);assert.equal(body.checkout.speedPolicy,'MediumSpeed');
    assert.equal(body.checkout.defaultLanguage,locale);
    assert.equal(new URL(body.checkout.redirectURL).searchParams.get('checkout'),token);
    assert.equal(body.metadata.orderId,reference);
  }
});

test('older store-scoped invoice reads remain supported',async()=> {
  const {provider,calls}=fixture({old:true});
  assert.equal((await provider.readInvoice('Invoice123')).state,'settled');
  assert.ok(calls.some(call=>new URL(call.url).pathname==='/api/v1/stores/Store123/invoices/Invoice123'));
});

test('signed webhook uses exact raw bytes and only the configured store',()=> {
  const {provider}=fixture();
  const raw=Buffer.from(JSON.stringify({storeId,invoiceId:'Invoice123',type:'InvoiceSettled'}));
  const sign=body=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
  assert.equal(provider.readWebhook(raw,sign(raw)),'Invoice123');
  assert.throws(()=>provider.readWebhook(Buffer.concat([raw,Buffer.from(' ')]),sign(raw)),error=>error.badSignature===true);
  assert.throws(()=>provider.readWebhook(raw,''),error=>error.badSignature===true);
  const other=Buffer.from(JSON.stringify({storeId:'OtherStore',invoiceId:'Invoice123',type:'InvoiceSettled'}));
  assert.equal(provider.readWebhook(other,sign(other)),null);
});

test('BTC received before expiry can settle after expiry; receipt time controls confirmation',async()=> {
  const payment=await fixture().provider.readInvoice('Invoice123');
  assert.equal(payment.receivedAt,(expiry-30)*1000);
  assert.equal(paymentDecision({state:'pending',provider:'btcpay',paymentId:'Invoice123',deadline:expiry*1000},payment),'confirm');
});

test('fully paid but unconfirmed BTC waits; partial payments only require review at expiry',async()=> {
  const processing=await fixture({invoice:{...baseInvoice,status:'Processing'},methods:[{...baseMethods[0],payments:[{...baseMethods[0].payments[0],status:'Processing'}]}]}).provider.readInvoice('Invoice123');
  assert.equal(processing.state,'processing');
  assert.equal((await fixture({invoice:{...baseInvoice,status:'New',additionalStatus:'PaidPartial'}}).provider.readInvoice('Invoice123')).phase,'partial');
  assert.equal((await fixture({invoice:{...baseInvoice,status:'Expired',additionalStatus:'PaidPartial'}}).provider.readInvoice('Invoice123')).state,'review');
});

test('only definitely empty expired invoices release an unpaid booking',async()=> {
  const invoice={...baseInvoice,status:'Expired',paidAmount:'0'};
  const empty=[{...baseMethods[0],paymentMethodPaid:'0',totalPaid:'0',payments:[]}];
  const payment=await fixture({invoice,methods:empty}).provider.readInvoice('Invoice123');
  assert.equal(payment.state,'expired-unpaid');
  assert.equal(paymentDecision({state:'pending',provider:'btcpay',paymentId:'Invoice123',deadline:expiry*1000},payment),'release');
  assert.equal((await fixture({invoice,methods:baseMethods}).provider.readInvoice('Invoice123')).state,'review');
});

test('manual marks, overpayments, late payments and bad identity cannot confirm automatically',async()=> {
  for(const additionalStatus of ['Marked','PaidOver','PaidLate'])assert.equal(
    (await fixture({invoice:{...baseInvoice,additionalStatus}}).provider.readInvoice('Invoice123')).state,'review');
  const mismatch=await fixture({invoice:{...baseInvoice,amount:'4.20'}}).provider.readInvoice('Invoice123');
  assert.equal(paymentDecision({state:'pending',provider:'btcpay',paymentId:'Invoice123',deadline:expiry*1000},mismatch),'reconcile');
  const late=await fixture({methods:[{...baseMethods[0],payments:[{...baseMethods[0].payments[0],receivedDate:expiry+1}]}]}).provider.readInvoice('Invoice123');
  assert.equal(paymentDecision({state:'pending',provider:'btcpay',paymentId:'Invoice123',deadline:expiry*1000},late),'reconcile');
  for(const invoice of [{...baseInvoice,currency:'USD'},{...baseInvoice,storeId:'WrongStore'}])
    await assert.rejects(()=>fixture({invoice}).provider.readInvoice('Invoice123'));
});

test('uncertain creation recovers the unique original invoice without another POST',async()=> {
  const {provider,calls}=fixture();
  assert.equal((await provider.recoverCheckout({reference,resultToken:token})).id,'Invoice123');
  assert.equal(calls.some(call=>call.options.method==='POST'),false);
  await assert.rejects(()=>fixture({list:[]}).provider.recoverCheckout({reference,resultToken:token}),{code:'BTC_CHECKOUT_NEEDS_REVIEW'});
  await assert.rejects(()=>fixture({list:[baseInvoice,baseInvoice]}).provider.recoverCheckout({reference,resultToken:token}),{code:'BTC_CHECKOUT_NEEDS_REVIEW'});
  assert.equal(decimalUnits('420.000',2),42000n);assert.equal(decimalUnits('420.001',2),null);
});

test('testnet creation, recovery and settlement reject mainnet addresses',async()=> {
  const settings={network:'testnet',publicOrigin:'https://testnet.example',methods:[{...baseMethods[0],destination:'bc1qMainnetFixture'}]};
  const provider=fixture(settings).provider;
  await assert.rejects(()=>provider.readInvoice('Invoice123'),{code:'BTC_NETWORK_MISMATCH'});
  await assert.rejects(()=>provider.recoverCheckout({reference,resultToken:token}),{code:'BTC_NETWORK_MISMATCH'});
  const created=fixture({...settings,clock:()=>Date.parse('2026-11-05T11:25:00Z'),invoice:{...baseInvoice,status:'New'}}).provider;
  await assert.rejects(()=>created.createCheckout({reference,locale:'pl',resultToken:token}),{code:'BTC_NETWORK_MISMATCH'});
  const valid=fixture({...settings,methods:[{...baseMethods[0],destination:'tb1qTestnetFixture'}]}).provider;
  assert.equal((await valid.readInvoice('Invoice123')).state,'settled');
});

test('transaction details expose only a validated TXID and verified wallet confirmation count',async()=> {
  const txid='a'.repeat(64);
  const methods=[{...baseMethods[0],payments:[{...baseMethods[0].payments[0],id:txid+'-0'}]}];
  const payment=await fixture({methods,wallet:()=>Response.json({transactionHash:txid,confirmations:'7',labels:['private'],accountDerivation:'secret'})}).provider.readInvoice('Invoice123',{includeWallet:true});
  assert.deepEqual(payment.paymentDetails.transactions,[{txid,confirmations:7,blockHeight:null}]);
  assert.equal(payment.state,'settled');
  const unavailable=await fixture({methods}).provider.readInvoice('Invoice123',{includeWallet:true});
  assert.deepEqual(unavailable.paymentDetails.transactions,[{txid,confirmations:null,blockHeight:null}]);
  assert.equal(unavailable.state,'settled');
  const wrong=await fixture({methods,wallet:()=>Response.json({transactionHash:'wrong',confirmations:'7'})}).provider.readInvoice('Invoice123',{includeWallet:true});
  assert.equal(wrong.paymentDetails.transactions[0].confirmations,null);
});

test('signed late receipt and settlement webhooks re-read the invoice and require review',async()=> {
  const {provider}=fixture({invoice:{...baseInvoice,status:'Expired',additionalStatus:'PaidLate'}});
  for(const type of ['InvoiceReceivedPayment','InvoicePaymentSettled']) {
    const raw=Buffer.from(JSON.stringify({type,storeId,invoiceId:'Invoice123'}));
    const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
    const id=provider.readWebhook(raw,signature);
    const payment=await provider.readInvoice(id);
    assert.equal(payment.state,'review');
    assert.equal(paymentDecision({state:'released',provider:'btcpay',paymentId:id},payment),'reconcile');
  }
});

test('first-confirmation height comes from the matching confirmed wallet transaction only',async()=> {
  const txid='c'.repeat(64);
  const methods=[{...baseMethods[0],payments:[{...baseMethods[0].payments[0],id:txid+'-1'}]}];
  for(const [confirmations,blockHeight,expected] of [['3','123456',123456],['0','123456',null],['1','invalid',null]]) {
    const payment=await fixture({methods,wallet:()=>Response.json({transactionHash:txid,confirmations,blockHeight})}).provider.readInvoice('Invoice123',{includeWallet:true});
    assert.equal(payment.paymentDetails.transactions[0].blockHeight,expected);
  }
});

test('explorer fallback verifies the TXID and block without BTCPay credentials and cannot confirm a released booking',async()=> {
  const txid='9e285d3b59473b7b3d127e9099ddf3886f440e309cde4f3f5580a164937952ba';
  const methods=[{...baseMethods[0],payments:[{...baseMethods[0].payments[0],id:txid+'-0'}]}];
  const settings={methods,invoice:{...baseInvoice,status:'Expired',additionalStatus:'PaidLate'},explorerApi:'https://mempool.space/api',
    explorer:url=>url.endsWith('/height')?new Response('5302380'):Response.json({txid,status:{confirmed:true,block_height:5302375,block_hash:'a'.repeat(64)}})};
  const result=await fixture(settings).provider.readInvoice('Invoice123',{includeWallet:true});
  assert.equal(result.paymentDetails.transactions[0].confirmations,6);
  assert.equal(result.paymentDetails.transactions[0].blockHeight,5302375);
  assert.equal(paymentDecision({state:'released',paymentId:'Invoice123',provider:'btcpay'},result),'reconcile');
  const wrong=await fixture({...settings,explorer:url=>url.endsWith('/height')?new Response('5302380'):Response.json({txid:'wrong',status:{confirmed:true,block_height:5302375,block_hash:'a'.repeat(64)}})}).provider.readInvoice('Invoice123',{includeWallet:true});
  assert.equal(wrong.paymentDetails.transactions[0].blockHeight,null);
  assert.throws(()=>fixture({...settings,network:'testnet',publicOrigin:'https://testnet.example'}),{code:'BTC_EXPLORER_CONFIGURATION'});
});

test('manual resolution requires the exact full BTC amount and settled provider receipts, even for PaidLate invoices',async()=> {
  const methods=[{...baseMethods[0],amount:'0.001',paymentMethodFee:'0'}];
  const provider=fixture({methods,invoice:{...baseInvoice,status:'Expired',additionalStatus:'PaidLate'}}).provider;
  assert.equal((await provider.resolutionPayment('Invoice123')).reference,reference);
  for(const changed of [
    {...methods[0],amount:'0.002'},
    {...methods[0],payments:[{...baseMethods[0].payments[0],status:'Processing'}]},
    {...methods[0],amount:'0.0005'},
  ])await assert.rejects(()=>fixture({methods:[changed],invoice:{...baseInvoice,status:'Expired',additionalStatus:'PaidLate'}}).provider.resolutionPayment('Invoice123'),{code:'PAYMENT_NOT_READY'});
});

test('Lightning settlement uses the BTC-LN receipt and excludes invoice-wide totals on other methods',async()=> {
  const receipt={id:'a'.repeat(64),status:'Settled',value:'0.00001',receivedDate:expiry-30};
  const method={paymentMethodId:'BTC-LN',currency:'BTC',amount:'0.00001',due:'0',totalPaid:'0.00001',paymentMethodPaid:'0.00001',paymentMethodFee:'0',payments:[receipt]};
  const alternate={...method,paymentMethodId:'BTC-CHAIN',paymentMethodPaid:'0',payments:[]};
  const {provider,calls}=fixture({methods:[method,alternate,{...alternate,paymentMethodId:'BTC-LNURL'}]});
  const payment=await provider.readInvoice('Invoice123',{rail:'lightning',includeWallet:true});
  assert.equal(payment.state,'settled');
  assert.equal(payment.receivedAt,(expiry-30)*1000);
  assert.deepEqual(payment.paymentDetails.transactions,[]);
  assert.equal(payment.paymentDetails.requiredConfirmations,0);
  assert.ok(!calls.some(call=>call.url.includes('/wallet/transactions/')));
  assert.equal((await provider.readInvoice('Invoice123')).state,'review');
  for(const methods of [[method,{...alternate,payments:[receipt]}],[{...method,payments:[{...receipt,value:'0.00000999'}]}]]) {
    assert.equal((await fixture({methods}).provider.readInvoice('Invoice123',{rail:'lightning'})).state,'review');
  }
  const unpaid={...method,due:'0.00001',totalPaid:'0',paymentMethodPaid:'0',payments:[]};
  const expired=fixture({invoice:{...baseInvoice,status:'Expired',paidAmount:'0'},methods:[unpaid,{...unpaid,paymentMethodId:'BTC-LNURL'}]});
  assert.equal((await expired.provider.readInvoice('Invoice123',{rail:'lightning'})).state,'expired-unpaid');
});


test('a combined invoice settles either method alone and routes mixed receipts to review',async()=> {
  const receipt={id:'a'.repeat(64),status:'Settled',value:'0.00001',receivedDate:expiry-30};
  const chain={paymentMethodId:'BTC-CHAIN',currency:'BTC',amount:'0.00001',due:'0',totalPaid:'0.00001',paymentMethodPaid:'0.00001',paymentMethodFee:'0',payments:[receipt]};
  const lightning={...chain,paymentMethodId:'BTC-LN'};
  const empty=method=>({...method,paymentMethodPaid:'0',payments:[]});
  for(const [paid,other] of [[chain,lightning],[lightning,chain]]) {
    const payment=await fixture({methods:[empty(other),paid]}).provider.readInvoice('Invoice123',{rail:'either'});
    assert.equal(payment.state,'settled');
    assert.equal(payment.rail,'either');
    assert.equal(payment.paymentDetails.rail,paid===lightning?'lightning':undefined);
  }
  const mixed=await fixture({methods:[chain,lightning]}).provider.readInvoice('Invoice123',{rail:'either'});
  assert.equal(mixed.state,'review');
});
