import {SchedulingError} from './cal-scheduler.mjs';

// Caller serializes this with booking creation and webhook processing.
export async function switchToBTC({db, reference, stripe, enabled, calBooking, issueCheckout, rail, now=Date.now}) {
  const row=db.prepare('SELECT * FROM bookings WHERE reference = ?').get(reference);
  if(!enabled)throw new SchedulingError('PAYMENT_UNAVAILABLE',503);
  if(row?.provider==='btcpay'&&row.state==='pending')return issueCheckout(reference,row.locale);
  if(!row||row.provider!=='stripe'||!['pending','switching'].includes(row.state)||!row.paymentId||row.deadline<=now())throw new SchedulingError('PAYMENT_SWITCH_BLOCKED');
  const booking=await calBooking(reference);
  if(booking.status!=='pending'||booking.start!==row.startsAt||Date.parse(row.startsAt)<=now()+36*60000)throw new SchedulingError('PAYMENT_SWITCH_BLOCKED');
  // Persist intent before the external request: a crash/retry or Stripe expiry webhook
  // cannot release the slot halfway through a switch. Never roll this back on timeout.
  db.prepare("UPDATE bookings SET state = 'switching' WHERE reference = ?").run(reference);
  await stripe.expireUnpaid({id:row.paymentId,reference});
  const railAssignment=rail?', paymentRail = ?':'';
  db.prepare(`UPDATE bookings SET provider = 'btcpay', paymentId = NULL, checkoutUrl = NULL, resultToken = NULL, paymentPhase = NULL, state = 'pending'${railAssignment} WHERE reference = ? AND state = 'switching'`)
    .run(...(rail?[rail]:[]),reference);
  return issueCheckout(reference,row.locale);
}
