import { npubEncode } from 'nostr-tools/nip19';
type Row={reference:string;startsAt:string|null;bookingState:string|null;paymentId:string|null;provider:string|null;settledRail:string|null;currency:string|null;minorUnits:number|null;settledSats:number|null;mentorPubkey:string|null;status:string;reviewReason:string|null;reviewInvoiceId:string|null;reviewSlotReleased:number|null;reviewPaymentStatus:string|null;reviewLastSeen:number|null};
type Ledger={rows:Row[];total:number;needsReview:number;page:number;pageSize:number;hasNext:boolean;canReview:boolean;basis:string;refundOrigin?:string|null};
type Context={api:(body:unknown)=>Promise<any>;signed:(purpose:string,request:Record<string,any>)=>Promise<any>;access:()=>{staff:boolean;networkEnabled:boolean};notify:(text:string)=>void;isBusy:()=>boolean;setBusy:(value:boolean)=>void};
const reviewLabels:Record<string,string>={'late-payment':'Payment received after expiry','partial-payment':'Partial payment','overpayment':'Overpayment','invalid-payment':'Invalid payment','manually-marked':'Manually marked invoice','payment-check':'Payment needs checking'};
const statusLabels:Record<string,string>={review:'Needs review',confirmed:'Confirmed',pending:'Awaiting payment',closed:'Closed'};
export function createSalesWorkspace(context:Context){
 const $=(id:string)=>document.getElementById(id)!;
 if(!$('sales-rows'))return;
 const rows=$('sales-rows'),table=$('sales-table'),refresh=$('load-sales') as HTMLButtonElement,previous=$('sales-previous') as HTMLButtonElement,next=$('sales-next') as HTMLButtonElement,search=$('sales-search') as HTMLInputElement,filter=$('sales-filter') as HTMLSelectElement;
 let page=1,working=false,last:Ledger|undefined;
 function message(text:string){$('sales-message').textContent=text;$('sales-message').hidden=!text;}
 function text(tag:string,value:string,className?:string){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
 function paragraph(parent:HTMLElement,value:string){parent.append(text('p',value));}
 function date(value:string|number|null){if(value==null)return 'Not recorded';const d=new Date(value);return Number.isNaN(d.getTime())?'Not recorded':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
 function amount(row:Row){if(row.minorUnits==null||!row.currency)return 'Not recorded';try{const format=new Intl.NumberFormat(undefined,{style:'currency',currency:row.currency});const digits=format.resolvedOptions().maximumFractionDigits;return format.format(row.minorUnits/10**digits);}catch{return `${row.minorUnits} minor units · ${row.currency}`;}}
 function method(row:Row){if(row.provider==='stripe')return 'Stripe';if(row.settledRail==='lightning')return 'Lightning';if(row.settledRail==='onchain')return 'Bitcoin on-chain';return row.provider==='btcpay'?'Bitcoin':row.provider||'Not recorded';}
 function button(label:string,action:()=>void){const el=text('button',label,'sales-button') as HTMLButtonElement;el.type='button';el.addEventListener('click',action);return el;}
 function controls(){for(const button of $('sales-filters').querySelectorAll<HTMLButtonElement>('button'))button.disabled=working;refresh.disabled=working;search.disabled=working;filter.disabled=working;previous.disabled=working||page<=1;next.disabled=working||!last?.hasNext;table.setAttribute('aria-busy',String(working));}
 async function read():Promise<Ledger>{
  const request={page,status:filter.value,query:search.value.trim()};
  if(context.access().networkEnabled)return context.api({action:'mentor-network-read',purpose:'sales-ledger',request});
  const event=await context.signed('sales-ledger',request);return context.api({action:'admin-sales-ledger',locale:'en',event});
 }
 async function refreshRows(){
  if(working||context.isBusy())return;
  working=true;context.setBusy(true);message('Loading sales…');controls();
  try{
   last=await read();if(page>1&&!last.rows.length&&last.total){page=1;last=await read();}
   rows.replaceChildren();
   $('sales-review-option').hidden=!last.canReview;
   $('sales-count').textContent=`${last.total} ${last.total===1?'booking':'bookings'}${last.canReview?` · ${last.needsReview} need review`:''}`;
   $('sales-basis').textContent=last.basis;
   $('sales-page-label').textContent=`Page ${page} of ${Math.max(1,Math.ceil(last.total/last.pageSize))}`;
   if(!last.rows.length){const row=document.createElement('tr');const cell=text('td',search.value||filter.value!=='all'?'No sales match these filters.':'No sales yet. Bookings will appear here when a checkout is created.','sales-empty') as HTMLTableCellElement;cell.colSpan=6;row.append(cell);rows.append(row);}
   for(const [index,sale] of last.rows.entries())renderRow(sale,index,last);
   message('');context.notify('');
  }catch(error){last=undefined;rows.replaceChildren();const row=document.createElement('tr');const cell=text('td','Sales could not load. Use Refresh sales to try again.','sales-empty') as HTMLTableCellElement;cell.colSpan=6;row.append(cell);rows.append(row);$('sales-count').textContent='Sales unavailable';message(error instanceof Error?error.message:'Could not load sales.');}
  finally{working=false;context.setBusy(false);controls();}
 }
 function renderRow(sale:Row,index:number,ledger:Ledger){
  const row=document.createElement('tr');row.className='sale-row';
  const ref=document.createElement('td');ref.append(text('span',sale.reference,'sale-reference'));
  let mentor='Unassigned';if(sale.mentorPubkey){try{mentor=npubEncode(sale.mentorPubkey);}catch{mentor='Unknown identity';}}
  const attribution=text('span',mentor==='Unassigned'?'Mentor: unassigned':`Mentor: ${mentor.slice(0,12)}…${mentor.slice(-6)}`,'sale-secondary');attribution.title=mentor;ref.append(attribution);
  const money=text('td',amount(sale),'amount-column');if(sale.settledSats!=null)money.append(text('span',`${sale.settledSats.toLocaleString()} sats settled`,'sale-secondary'));
  const state=document.createElement('td');state.append(text('span',statusLabels[sale.status]||'Unknown',`sale-status sale-status-${sale.status}`));
  const details=document.createElement('tr');details.hidden=true;details.id=`sale-detail-${index}`;const detailCell=document.createElement('td');detailCell.colSpan=6;detailCell.className='sale-detail-cell';details.append(detailCell);
  const action=document.createElement('td');action.className='sale-action';const actionLabel=sale.status==='review'&&ledger.canReview?'Review payment':'View details';const toggle=button(actionLabel,()=>{details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden));toggle.textContent=details.hidden?actionLabel:'Hide details';});toggle.setAttribute('aria-controls',details.id);toggle.setAttribute('aria-expanded','false');action.append(toggle);
  row.append(ref,text('td',date(sale.startsAt)),money,text('td',method(sale)),state,action);rows.append(row,details);
  detailCell.append(text('h3',sale.reviewReason&&ledger.canReview?(reviewLabels[sale.reviewReason]||'Payment needs checking'):'Booking details'));
  paragraph(detailCell,'Booking: '+sale.reference);paragraph(detailCell,'Payment: '+(sale.paymentId||'Not recorded'));paragraph(detailCell,'Appointment state: '+(sale.bookingState||'Not recorded'));
  if(sale.mentorPubkey)paragraph(detailCell,'Referring mentor: '+mentor);
  if(ledger.canReview&&sale.reviewReason){
   paragraph(detailCell,'Invoice: '+(sale.reviewInvoiceId||'Not recorded'));
   paragraph(detailCell,sale.reviewSlotReleased?'Original slot was released. Check availability before resolving.':'Check the original appointment before resolving.');
   paragraph(detailCell,'Provider status: '+(sale.reviewPaymentStatus||'Not recorded'));paragraph(detailCell,'Last checked: '+date(sale.reviewLastSeen));
   if(sale.reviewReason==='late-payment')resolution(detailCell,sale);
   else paragraph(detailCell,'Check this payment in the payment provider and original booking in Cal.');
  }
  if(ledger.canReview&&ledger.refundOrigin&&sale.provider==='btcpay')refundLink(detailCell,ledger.refundOrigin);
 }
 function resolution(parent:HTMLElement,sale:Row){
  const label=text('label',`Agreed appointment time (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);const input=document.createElement('input');input.type='datetime-local';if(sale.startsAt){const d=new Date(sale.startsAt);if(!Number.isNaN(d.getTime()))input.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}label.append(input);parent.append(label);const previewArea=document.createElement('div');input.addEventListener('input',()=>previewArea.replaceChildren());
  const preview=button('Preview paid booking',()=>void act(async()=>{
   previewArea.replaceChildren();const start=new Date(input.value).toISOString();const request={reference:sale.reference,start};
   const event=await context.signed('resolve-preview',request);const result=await context.api({action:'admin-resolve-preview',locale:'en',event});
   paragraph(previewArea,`Confirm ${result.attendee.name} (${result.attendee.email}) for ${date(result.start)}. Email language: ${result.attendee.language}. The existing payment will be used; Cal will send the confirmation email.`);
   const confirm=button('Confirm appointment using existing payment',()=>void act(async()=>{
    const event=await context.signed('resolve-confirm',{reference:sale.reference,start:result.start,previewHash:result.previewHash});
    await context.api({action:'admin-resolve-confirm',locale:'en',event});
    previewArea.replaceChildren(text('p','Appointment confirmed. Cal handles the confirmation email. Refresh sales to update this row.'));preview.disabled=true;input.disabled=true;
   },confirm));previewArea.append(confirm);
  },preview));parent.append(preview,previewArea);
 }
 async function act(action:()=>Promise<void>,control:HTMLButtonElement){
  if(working||context.isBusy()||!context.access().staff)return;
  working=true;context.setBusy(true);control.disabled=true;controls();message('Approve this payment action in your signer…');
  try{await action();message('');}catch(error){message(error instanceof Error?error.message:'Payment action could not finish.');}
  finally{working=false;context.setBusy(false);control.disabled=false;controls();}
 }
 function refundLink(parent:HTMLElement,origin:string){
  const details=document.createElement('details');details.append(text('summary','Share an existing refund claim link'));
  const label=text('label','Existing BTCPay claim URL');const input=document.createElement('input');input.type='url';input.autocomplete='off';label.append(input);details.append(label);
  const copy=button('Copy public claim link',()=>void(async()=>{try{if(!context.access().staff)return;const claim=new URL(input.value.trim());if(!['http:','https:'].includes(claim.protocol)||claim.username||claim.password||!/^\/pull-payments\/[A-Za-z0-9]{1,100}\/?$/.test(claim.pathname))throw new Error('Paste an existing BTCPay refund claim URL.');input.value=new URL(claim.pathname,origin).href;await navigator.clipboard.writeText(input.value);message('Public refund claim link copied.');}catch(error){message(error instanceof Error?error.message:'Copy the link from the field.');}})());details.append(copy,text('p','Share privately with the intended recipient. Approve payouts in BTCPay.'));parent.append(details);
 }
 refresh.addEventListener('click',()=>void refreshRows());$('sales-filters').addEventListener('submit',event=>{event.preventDefault();page=1;void refreshRows();});previous.addEventListener('click',()=>{if(page>1){page--;void refreshRows();}});next.addEventListener('click',()=>{if(last?.hasNext){page++;void refreshRows();}});
}
