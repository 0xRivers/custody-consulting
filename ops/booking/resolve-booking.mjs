import {bookingPrice} from './payment-decision.mjs';
import {createHash} from 'node:crypto';
import {SchedulingError} from './cal-scheduler.mjs';
export function createPaidBookingResolver({db,btcpay,scheduler,calBooking,now=Date.now}) {
  const fail=code=>{throw new SchedulingError(code);};
  async function verifiedPayment(id) {
    try {return await btcpay.resolutionPayment(id);}
    catch(error) {if(error.code==='PAYMENT_NOT_READY')fail('PAYMENT_NOT_READY');throw error;}
  }
  async function context({reference,start}) {
    if(typeof reference!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(reference)||typeof start!=='string'||!Number.isFinite(Date.parse(start)))fail('INVALID_INPUT');
    const row=db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);
    const review=db.prepare('SELECT * FROM payment_reviews WHERE reference=?').get(reference);
    if(!row||!review||row.provider!=='btcpay'||row.paymentId!==review.invoiceId||review.reason!=='late-payment'||row.state!=='reconcile')fail('RESOLUTION_BLOCKED');
    const payment=await verifiedPayment(row.paymentId);
    if(payment.reference!==reference||payment.resultToken!==row.resultToken||payment.currency!==bookingPrice(row)?.currency||payment.minorUnits!==bookingPrice(row)?.minorUnits)fail('RESOLUTION_BLOCKED');
    const original=await calBooking(reference);
    if(!['rejected','cancelled'].includes(original.status)||original.attendees?.length!==1)fail('RESOLUTION_BLOCKED');
    const attendee=original.attendees[0];
    const body=await scheduler.prepare({locale:row.locale,paymentMethod:'BTC',start,timeZone:attendee.timeZone,name:attendee.name,email:attendee.email});
    const previewHash=createHash('sha256').update(JSON.stringify({reference,invoiceId:row.paymentId,body})).digest('hex');
    return {row,body,previewHash};
  }
  return {
    async preview(request) {
      const {row,body,previewHash}=await context(request);
      return {reference:row.reference,invoiceId:row.paymentId,start:body.start,attendee:body.attendee,previewHash};
    },
    async confirm({reference,start,previewHash},operator) {
      const existing=db.prepare('SELECT * FROM payment_resolutions WHERE reference=?').get(reference);
      let replacement;
      if(existing) {
        if(existing.targetStart!==start||existing.previewHash!==previewHash)fail('RESOLUTION_BLOCKED');
        if(existing.state==='confirmed')return {confirmed:true,start:existing.targetStart,replacementUid:existing.replacementUid};
        if(!existing.replacementUid)fail('RESOLUTION_NEEDS_REVIEW');
        // Re-read the payment even on confirmation retries; never depend on browser state.
        const row=db.prepare('SELECT * FROM bookings WHERE reference=?').get(reference);
        const payment=await verifiedPayment(row.paymentId);
        if(payment.reference!==reference||payment.resultToken!==row.resultToken||payment.currency!==bookingPrice(row)?.currency||payment.minorUnits!==bookingPrice(row)?.minorUnits)fail('RESOLUTION_BLOCKED');
        replacement=await calBooking(existing.replacementUid);
      } else {
        const {body,previewHash:currentHash}=await context({reference,start});
        if(currentHash!==previewHash)fail('RESOLUTION_PREVIEW_CHANGED');
        // Persist before Cal creation. An ambiguous response cannot trigger another booking.
        db.prepare("INSERT INTO payment_resolutions VALUES (?,?,?,?,?,?,?)").run(reference,body.start,previewHash,null,'creating',operator,now());
        try {replacement=await scheduler.book({...body,metadata:{custodyPaidResolution:reference}});}
        catch(error) {
          if(error instanceof SchedulingError&&!error.uncertain)db.prepare("DELETE FROM payment_resolutions WHERE reference=? AND state='creating'").run(reference);
          throw error;
        }
        db.prepare("UPDATE payment_resolutions SET replacementUid=?,state='bound' WHERE reference=?").run(replacement.uid,reference);
      }
      if(Date.parse(start)<=now())fail('RESOLUTION_BLOCKED');
      if(Date.parse(replacement.start)!==Date.parse(start)||!['pending','accepted'].includes(replacement.status))fail('RESOLUTION_NEEDS_REVIEW');
      if(replacement.status==='pending')replacement=await calBooking(replacement.uid,'/confirm');
      if(replacement.status!=='accepted'||Date.parse(replacement.start)!==Date.parse(start))fail('RESOLUTION_NEEDS_REVIEW');
      db.exec('BEGIN IMMEDIATE');
      try {
        const updated=db.prepare("UPDATE bookings SET state='confirmed',startsAt=? WHERE reference=? AND state='reconcile'").run(start,reference);
        if(updated.changes!==1)fail('RESOLUTION_NEEDS_REVIEW');
        db.prepare("UPDATE payment_resolutions SET state='confirmed' WHERE reference=?").run(reference);
        db.exec('COMMIT');
      } catch(error) {db.exec('ROLLBACK');throw error;}
      return {confirmed:true,start,replacementUid:replacement.uid};
    },
  };
}
