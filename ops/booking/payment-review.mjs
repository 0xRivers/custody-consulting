export function recordPaymentReview({db,row,payment,now=Date.now}) {
  const extra=payment.paymentDetails?.additionalStatus;
  const reason=extra==='PaidLate'||(payment.state==='settled'&&payment.receivedAt>row.deadline)?'late-payment':
    extra==='PaidPartial'?'partial-payment':extra==='PaidOver'?'overpayment':
    payment.paymentDetails?.invoiceStatus==='Invalid'?'invalid-payment':
    extra==='Marked'?'manually-marked':'payment-check';
  const time=now();
  db.prepare(`INSERT INTO payment_reviews (reference,invoiceId,startsAt,reason,slotReleased,invoiceStatus,firstSeen,lastSeen)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(reference) DO UPDATE SET
    reason=excluded.reason, slotReleased=MAX(payment_reviews.slotReleased,excluded.slotReleased),
    invoiceStatus=excluded.invoiceStatus,lastSeen=excluded.lastSeen`).run(
      row.reference,payment.id,row.startsAt,reason,row.state==='released'?1:0,
      payment.paymentDetails?.invoiceStatus||payment.state,time,time);
  // A released slot stays released in Cal; reconciliation never recreates a booking.
  db.prepare("UPDATE bookings SET state = 'reconcile' WHERE reference = ? AND state IN ('pending', 'released')").run(row.reference);
  return reason;
}
