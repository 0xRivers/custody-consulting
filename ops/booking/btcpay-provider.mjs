import {createHmac,timingSafeEqual} from 'node:crypto';
import {foundationPrice,priceForCurrency} from './payment-decision.mjs';

export class BTCPayError extends Error {
  constructor(code, uncertain=false) {super(code);this.code=code;this.uncertain=uncertain;}
}
export function decimalUnits(value,places) {
  if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');
  if(fraction.slice(places).replaceAll('0','')!=='')return null;
  return BigInt(whole)*10n**BigInt(places)+BigInt(fraction.slice(0,places).padEnd(places,'0')||'0');
}
export function createBTCPay({baseUrl,storeId,apiKey,signingSecret,publicOrigin='https://pay.custody.consulting',network='mainnet',origin='https://staging.custody.consulting',pathPrefix='',integration='custody-foundation-staging',explorerApi,request=fetch,now=Date.now}) {
  const base=new URL(baseUrl),publicUrl=new URL(publicOrigin);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||base.pathname!=='/'||
    publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password||publicUrl.pathname!=='/'||publicUrl.search||publicUrl.hash||
    !/^[A-Za-z0-9]{1,100}$/.test(storeId||'')||!apiKey||!signingSecret||!['mainnet','testnet','regtest'].includes(network)||
    (network!=='mainnet'&&publicUrl.origin==='https://pay.custody.consulting'))throw new BTCPayError('BTC_CONFIGURATION');
  // Pin the known demo to Testnet3; other deployments must select a network explicitly.
  explorerApi=explorerApi||(network==='testnet'&&publicUrl.origin==='https://testnet.demo.btcpayserver.org'?'https://mempool.space/testnet/api':null);
  const allowedExplorers=network==='mainnet'?['https://mempool.space/api']:network==='testnet'?['https://mempool.space/testnet/api','https://mempool.space/testnet4/api']:[];
  if(explorerApi&&!allowedExplorers.includes(explorerApi))throw new BTCPayError('BTC_EXPLORER_CONFIGURATION');
  async function explorerTransaction(txid) {
    if(!explorerApi)return null;
    // Never forward the BTCPay API key, invoice ID or result token to an explorer.
    const options={method:'GET',headers:{},redirect:'error',signal:AbortSignal.timeout(3000)};
    try {
      const [response,tipResponse]=await Promise.all([request(explorerApi+'/tx/'+txid,options),request(explorerApi+'/blocks/tip/height',options)]);
      if(!response.ok)return null;
      const tx=await response.json();
      if(tx.txid!==txid||typeof tx.status?.confirmed!=='boolean')return null;
      if(!tx.status.confirmed)return {confirmations:0,blockHeight:null};
      const blockHeight=tx.status.block_height;
      if(!Number.isSafeInteger(blockHeight)||blockHeight<=0||!/^[a-f0-9]{64}$/.test(tx.status.block_hash||''))return null;
      const tipText=tipResponse.ok?await tipResponse.text():'';
      const tip=/^\d+$/.test(tipText.trim())?Number(tipText):null;
      return {blockHeight,confirmations:Number.isSafeInteger(tip)&&tip>=blockHeight?tip-blockHeight+1:null};
    } catch {return null;}
  }
  const root='/api/v1/stores/'+encodeURIComponent(storeId);
  let contract;
  async function api(path,body) {
    let response;
    try {response=await request(new URL(path,base).href,{method:body?'POST':'GET',
      headers:{Authorization:'token '+apiKey,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});}
    catch {throw new BTCPayError('BTC_UNAVAILABLE',!!body);}
    if(!response.ok) {
      const error=new BTCPayError('BTC_UNAVAILABLE',!!body&&response.status>=500);error.httpStatus=response.status;throw error;
    }
    try {return await response.json();}catch {throw new BTCPayError('BTC_UNAVAILABLE',!!body);}
  }
  async function profile() {
    if(contract)return contract;
    const spec=await api('/swagger/v1/swagger.json');
    if(!spec.paths?.[root.replace(storeId,'{storeId}')+'/invoices']&&!spec.paths?.['/api/v1/stores/{storeId}/invoices'])throw new BTCPayError('BTC_CONFIGURATION');
    contract={globalReads:!!spec.paths['/api/v1/invoices/{invoiceId}'],
      paymentMethod:JSON.stringify(spec.components?.schemas?.PaymentMethodId||{}).includes('BTC-CHAIN')?'BTC-CHAIN':'BTC'};
    return contract;
  }
  async function invoicePath(id,suffix='') {
    if(!/^[A-Za-z0-9]{1,100}$/.test(id||''))throw new BTCPayError('BTC_INVOICE_INVALID');
    const schema=await profile();
    return (schema.globalReads?'/api/v1':root)+'/invoices/'+encodeURIComponent(id)+suffix;
  }
  function validateInvoice(invoice,expected={}) {
    if(!invoice||!/^[A-Za-z0-9]{1,100}$/.test(invoice.id||'')||
      (invoice.storeId!==undefined&&invoice.storeId!==storeId)||
      invoice.metadata?.integration!==integration||
      !/^[A-Za-z0-9_-]{1,100}$/.test(invoice.metadata?.orderId||'')||
      !/^[A-Za-z0-9_-]{43}$/.test(invoice.metadata?.resultToken||'')||
      !priceForCurrency(invoice.currency)||decimalUnits(invoice.amount,2)===null||decimalUnits(invoice.amount,2)<=0n||
      (expected.price&&(invoice.currency!==expected.price.currency||decimalUnits(invoice.amount,2)!==BigInt(expected.price.minorUnits)))||
      !Number.isSafeInteger(invoice.expirationTime)||!Number.isSafeInteger(invoice.createdTime)||
      invoice.expirationTime<=invoice.createdTime||
      (expected.rail&&(invoice.metadata.paymentRail??'onchain')!==expected.rail)||
      (expected.reference&&invoice.metadata.orderId!==expected.reference)||
      (expected.resultToken&&invoice.metadata.resultToken!==expected.resultToken))throw new BTCPayError('BTC_INVOICE_INVALID',true);
    return {id:invoice.id,url:new URL('/i/'+encodeURIComponent(invoice.id),publicUrl).href,deadline:invoice.expirationTime*1000};
  }
  function verifyNetwork(methods) {
    if(network==='mainnet')return;
    const prefix=network==='testnet'?/^(tb1|[mn2])/:/^(bcrt1|[mn2])/;
    if(!Array.isArray(methods)||methods.length!==1||!['BTC','BTC-CHAIN'].includes(methods[0].paymentMethodId)||
      typeof methods[0].destination!=='string'||!prefix.test(methods[0].destination))throw new BTCPayError('BTC_NETWORK_MISMATCH',true);
  }
  async function createCheckout({reference,locale,resultToken,price=foundationPrice,rail='onchain',buyerEmail}) {
    if(!['onchain','lightning','either'].includes(rail)||(rail!=='onchain'&&network!=='mainnet'))throw new BTCPayError('BTC_CONFIGURATION');
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(reference||'')||!['en','pl'].includes(locale)||!/^[-_A-Za-z0-9]{43}$/.test(resultToken||''))throw new BTCPayError('BTC_CONFIGURATION');
    const schema=await profile();
    const paymentMethod=rail==='lightning'?'BTC-LN':schema.paymentMethod;
    const receiptEmail = typeof buyerEmail === 'string' ? buyerEmail.trim() : '';
    const invoice=await api(root+'/invoices',{
      amount:(price.minorUnits/100).toFixed(2),currency:price.currency,
      metadata:{orderId:reference,resultToken,integration,
        ...(receiptEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail) ? {buyerEmail:receiptEmail} : {}),
        ...(rail!=='onchain'?{paymentRail:rail}:{}),
        itemDesc:locale==='pl'?'Konsultacja Foundation (60 min)':'Foundation consultation (60 min)'},
      checkout:{paymentMethods:rail==='either'?[paymentMethod,'BTC-LN']:[paymentMethod],defaultPaymentMethod:paymentMethod,
        expirationMinutes:35,paymentTolerance:0,speedPolicy:'MediumSpeed',defaultLanguage:locale,lazyPaymentMethods:false,
        redirectURL:`${origin}${pathPrefix}/payment/result/?lang=${locale}&checkout=${resultToken}`,
        redirectAutomatically:true},
    });
    const result=validateInvoice(invoice,{reference,resultToken,price,rail});
    if(invoice.status!=='New'||result.deadline<=now()||result.deadline>now()+36*60_000)throw new BTCPayError('BTC_INVOICE_INVALID',true);
    if(network!=='mainnet') {
      const methods=await api(await invoicePath(invoice.id,'/payment-methods')+'?includeSensitive=false');
      verifyNetwork(methods);
    }
    return result;
  }
  async function recoverCheckout({reference,resultToken,price=foundationPrice,rail='onchain'}) {
    const list=await api(root+'/invoices?'+new URLSearchParams({orderId:reference,take:'100'}));
    if(!Array.isArray(list))throw new BTCPayError('BTC_UNAVAILABLE');
    if(list.length>=100)throw new BTCPayError('BTC_CHECKOUT_NEEDS_REVIEW',true);
    const matches=list.filter(invoice=>invoice.metadata?.orderId===reference&&invoice.metadata?.resultToken===resultToken&&invoice.metadata?.integration===integration);
    if(matches.length!==1)throw new BTCPayError('BTC_CHECKOUT_NEEDS_REVIEW',true);
    const invoice=validateInvoice(matches[0],{reference,resultToken,price,rail});
    if(network!=='mainnet')verifyNetwork(await api(await invoicePath(invoice.id,'/payment-methods')+'?includeSensitive=false'));
    return invoice;
  }
  let walletReadable=true;
  async function transactionDetails(payments, methodId, includeWallet) {
    const ids=[...new Set(payments.map(payment=>/^([a-f0-9]{64})(?:[-:]\d+)?$/i.exec(payment.id||'')?.[1]?.toLowerCase()).filter(Boolean))];
    return Promise.all(ids.map(async txid=> {
      let confirmations=null, blockHeight=null;
      if(walletReadable&&includeWallet)try {
        const tx=await api(root+'/payment-methods/'+encodeURIComponent(methodId)+'/wallet/transactions/'+txid);
        const count=typeof tx.confirmations==='string'&&/^\d+$/.test(tx.confirmations)?Number(tx.confirmations):tx.confirmations;
        if(tx.transactionHash===txid&&Number.isSafeInteger(count)&&count>=0) {
          confirmations=count;
          const height=typeof tx.blockHeight==='string'&&/^\d+$/.test(tx.blockHeight)?Number(tx.blockHeight):tx.blockHeight;
          if(count>0&&Number.isSafeInteger(height)&&height>0)blockHeight=height;
        }
      } catch(error) {if(error.httpStatus===403)walletReadable=false;}
      if(includeWallet&&explorerApi&&(confirmations===null||(confirmations>0&&blockHeight===null))) {
        const verified=await explorerTransaction(txid);
        if(verified) {confirmations=verified.confirmations;blockHeight=verified.blockHeight;}
      }
      return {txid,confirmations,blockHeight};
    }));
  }
  async function readInvoice(id, {includeWallet=false, rail} = {}) {
    const invoice=await api(await invoicePath(id));
    rail=rail??invoice.metadata?.paymentRail??'onchain';
    if(!['onchain','lightning','either'].includes(rail)||(rail!=='onchain'&&network!=='mainnet'))throw new BTCPayError('BTC_CONFIGURATION');
    const validated=validateInvoice(invoice);
    if(invoice.id!==id)throw new BTCPayError('BTC_INVOICE_INVALID');
    const methods=await api(await invoicePath(id,'/payment-methods')+'?includeSensitive=false&onlyAccountedPayments=true');
    if(!Array.isArray(methods)||!methods.length)throw new BTCPayError('BTC_INVOICE_INVALID');
    if(rail==='onchain')verifyNetwork(methods);
    const payments=methods.flatMap(method=>Array.isArray(method.payments)?method.payments:[]);
    const extra=invoice.additionalStatus;
    const paidMethods=methods.filter(method=>Array.isArray(method.payments)&&method.payments.length);
    const paidMethod=paidMethods.length===1?paidMethods[0]:null;
    const lightningMethod=methods.find(method=>method.paymentMethodId==='BTC-LN');
    const lightning=rail==='lightning'||(rail==='either'&&paidMethod?.paymentMethodId==='BTC-LN');
    const method=rail==='either'?paidMethod:lightning?lightningMethod:methods.length===1?methods[0]:null;
    const validMethods=rail==='onchain'||(
      (rail!=='lightning'||!!lightningMethod)&&paidMethods.length<=1&&
      new Set(methods.map(entry=>entry.paymentMethodId)).size===methods.length&&
      methods.every(entry=>{
        const allowed=['BTC','BTC-CHAIN','BTC-LN','BTC-LNURL'].includes(entry.paymentMethodId);
        const payable=rail==='lightning'?entry===lightningMethod:entry.paymentMethodId!=='BTC-LNURL';
        return allowed&&entry.currency==='BTC'&&Array.isArray(entry.payments)&&
          ((payable&&entry===paidMethod)||(!entry.payments.length&&decimalUnits(entry.paymentMethodPaid,8)===0n));
      })
    );
    const transactions=lightning||!validMethods||!method?[]:await transactionDetails(payments,method.paymentMethodId,includeWallet);
    const paymentDetails={invoiceStatus:invoice.status,additionalStatus:extra,requiredConfirmations:lightning?0:1,transactions,...(lightning?{rail:'lightning'}:{})};
    const basePayment={provider:'btcpay',id,reference:invoice.metadata.orderId,resultToken:invoice.metadata.resultToken,
      currency:invoice.currency,minorUnits:Number(decimalUnits(invoice.amount,2)),expiresAt:validated.deadline,paymentDetails,...(rail!=='onchain'?{rail}:{})};
    const review=()=>({...basePayment,state:'review',receivedAt:now()});
    if(!validMethods)return review();
    if(extra==='PaidPartial'&&['New','Processing'].includes(invoice.status))return {...basePayment,state:'processing',phase:'partial'};
    if(extra!=='None'||invoice.status==='Invalid')return review();
    if(invoice.status==='Expired') {
      const empty=payments.length===0&&methods.every(method=>decimalUnits(method.paymentMethodPaid,8)===0n&&decimalUnits(method.totalPaid,8)===0n)&&
        (invoice.paidAmount===undefined||decimalUnits(invoice.paidAmount,2)===0n);
      return empty?{...basePayment,state:'expired-unpaid',receivedAt:now()}:review();
    }
    if(invoice.status!=='Settled')return {...basePayment,state:'processing'};
    if(!method||(!lightning&&!['BTC','BTC-CHAIN'].includes(method.paymentMethodId))||method.currency!=='BTC'||
      decimalUnits(method.due,8)!==0n||!payments.length||payments.some(payment=>
        payment.status!=='Settled'||!Number.isSafeInteger(payment.receivedDate)||
        decimalUnits(payment.value,8)===null||decimalUnits(payment.value,8)<=0n))return review();
    if(lightning||rail==='either') {
      const amount=decimalUnits(method.amount,8),fee=decimalUnits(method.paymentMethodFee,8);
      const received=payments.reduce((total,receipt)=>total+decimalUnits(receipt.value,8),0n);
      if(amount===null||amount<=0n||fee===null||received!==amount+fee||
        decimalUnits(method.paymentMethodPaid,8)!==received||payments.some(receipt=>receipt.receivedDate<invoice.createdTime))return review();
      if(lightning&&(payments.length!==1||!/^[0-9a-f]{64}$/i.test(payments[0].id||'')))return review();
    }
    const receivedAt=Math.max(...payments.map(payment=>payment.receivedDate*1000));
    const settledSats=Number(payments.reduce((sum,payment)=>sum+decimalUnits(payment.value,8),0n));
    return {...basePayment,state:'settled',receivedAt,settledSats};
  }
  function readWebhook(rawBody,signature) {
    const expected=createHmac('sha256',signingSecret).update(rawBody).digest();
    const hex=typeof signature==='string'?signature.replace(/^sha256=/,''):'';
    if(!/^[A-Fa-f0-9]{64}$/.test(hex)||!timingSafeEqual(expected,Buffer.from(hex,'hex'))) {
      const error=new BTCPayError('BTC_SIGNATURE_INVALID');error.badSignature=true;throw error;
    }
    const event=JSON.parse(rawBody.toString('utf8'));
    if(event.storeId!==storeId||!['InvoiceSettled','InvoiceExpired','InvoiceInvalid','InvoiceProcessing','InvoiceReceivedPayment','InvoicePaymentSettled'].includes(event.type))return null;
    if(!/^[A-Za-z0-9]{1,100}$/.test(event.invoiceId||''))throw new BTCPayError('BTC_INVOICE_INVALID');
    return event.invoiceId;
  }
  async function resolutionPayment(id) {
    const payment=await readInvoice(id);
    if(!['Expired','Settled'].includes(payment.paymentDetails.invoiceStatus)||!['PaidLate','None'].includes(payment.paymentDetails.additionalStatus))throw new BTCPayError('PAYMENT_NOT_READY');
    const methods=await api(await invoicePath(id,'/payment-methods')+'?includeSensitive=false&onlyAccountedPayments=true');
    if(methods.length!==1||!['BTC','BTC-CHAIN'].includes(methods[0].paymentMethodId)||methods[0].currency!=='BTC')throw new BTCPayError('PAYMENT_NOT_READY');
    const method=methods[0],receipts=method.payments;
    const amount=decimalUnits(method.amount,8),fee=decimalUnits(method.paymentMethodFee||'0',8);
    if(amount===null||amount<=0n||fee===null||!Array.isArray(receipts)||!receipts.length||receipts.some(p=>p.status!=='Settled'||decimalUnits(p.value,8)===null))throw new BTCPayError('PAYMENT_NOT_READY');
    const received=receipts.reduce((sum,p)=>sum+decimalUnits(p.value,8),0n);
    if(received!==amount+fee)throw new BTCPayError('PAYMENT_NOT_READY');
    return payment;
  }
  let estimateCache;
  async function estimatePrice(price=foundationPrice) {
    const key=price.currency+':'+price.minorUnits;
    if(estimateCache?.key===key&&estimateCache.expires>now())return estimateCache.promise;
    const promise=(async()=>{
      try {
        let fiat,usd;
        try {
          const rates=await api(root+'/rates?'+new URLSearchParams([['currencyPair','BTC_'+price.currency],['currencyPair','BTC_USD']]));
          const rate=pair=>{const entry=Array.isArray(rates)?rates.find(r=>r.currencyPair===pair):null;const n=Number(entry?.rate);return entry&&(!entry.errors||!entry.errors.length)&&Number.isFinite(n)&&n>0?n:null;};
          fiat=rate('BTC_'+price.currency);usd=rate('BTC_USD');
        }catch{}
        if(!fiat||!usd) {
          // Public rate lookup: never send BTCPay credentials or booking identifiers.
          const response=await request('https://api.coinbase.com/v2/exchange-rates?currency=BTC',{redirect:'error',signal:AbortSignal.timeout(3000)});
          if(!response.ok)return null;
          const data=(await response.json()).data;
          if(data?.currency!=='BTC')return null;
          fiat=Number(data.rates?.[price.currency]);usd=Number(data.rates?.USD);
          if(!Number.isFinite(fiat)||fiat<=0||!Number.isFinite(usd)||usd<=0)return null;
        }
        const satoshis=Math.ceil(price.minorUnits/100/fiat*100000000);
        const usdMinorUnits=Math.round(satoshis/100000000*usd*100);
        if(!Number.isSafeInteger(satoshis)||satoshis<=0||!Number.isSafeInteger(usdMinorUnits)||usdMinorUnits<=0)return null;
        return {satoshis,usdMinorUnits};
      }catch{return null;}
    })();
    estimateCache={key,expires:now()+60000,promise};return promise;
  }
  async function check() {
    const schema=await profile();
    await api(root+'/invoices?take=1');
    return {storeId,paymentMethod:schema.paymentMethod,network,checkoutOrigin:publicUrl.origin,readInvoices:true,webhookConfigured:!!signingSecret};
  }
  return {estimatePrice,createCheckout,recoverCheckout,readInvoice,readWebhook,resolutionPayment,check,publicOrigin:publicUrl.origin};
}
