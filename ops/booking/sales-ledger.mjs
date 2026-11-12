// Read-only projection. Authentication supplies scope; request JSON cannot choose it.
export function readSalesLedger({db,mentorKeys=null,includeReviews=false,request={}}){
  const invalid=()=>{throw Object.assign(new Error('Invalid sales filters.'),{status:400});};
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(k=>!['page','status','query'].includes(k)))invalid();
  const {page=1,status='all',query=''}=request,limit=25;
  if(!Number.isSafeInteger(page)||page<1||page>1000000||!['all','review','confirmed','pending','closed'].includes(status)||typeof query!=='string'||query.length>120)invalid();
  if(mentorKeys!==null&&(!Array.isArray(mentorKeys)||!mentorKeys.length))throw Object.assign(new Error('Sales access denied.'),{status:403});
  const attribution=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mentor_booking_attribution'").get();
  if(mentorKeys&&!attribution)throw Object.assign(new Error('Sales access denied.'),{status:403});
  const joinAttribution=attribution?'LEFT JOIN mentor_booking_attribution a ON a.reference=b.reference':'';
  const mentor=attribution?'a.mentorPubkey':'NULL';
  const unresolved="NOT EXISTS (SELECT 1 FROM payment_resolutions pr WHERE pr.reference=r.reference AND pr.state='confirmed')";
  const reviewJoin=includeReviews?`LEFT JOIN payment_reviews r ON r.reference=b.reference AND ${unresolved}`:'';
  const reviewFields=includeReviews?'r.reason AS reviewReason,r.invoiceId AS reviewInvoiceId,r.slotReleased AS reviewSlotReleased,r.invoiceStatus AS reviewPaymentStatus,r.lastSeen AS reviewLastSeen':'NULL AS reviewReason,NULL AS reviewInvoiceId,NULL AS reviewSlotReleased,NULL AS reviewPaymentStatus,NULL AS reviewLastSeen';
  const scope=mentorKeys?`AND ${mentor} IN (${mentorKeys.map(()=>'?').join(',')})`:'';
  const reviewState=includeReviews?"WHEN r.reference IS NOT NULL THEN 'review'":'';
  let cte=`WITH ledger AS (SELECT b.reference,b.startsAt,b.state AS bookingState,b.paymentId,b.provider,b.settledRail,b.priceCurrency AS currency,b.priceMinorUnits AS minorUnits,b.settledSats,${mentor} AS mentorPubkey,${reviewFields},CASE ${reviewState} WHEN b.state='confirmed' THEN 'confirmed' WHEN b.state IN ('cancelled','expired','failed') THEN 'closed' ELSE 'pending' END AS status FROM bookings b ${joinAttribution} ${reviewJoin} WHERE (b.paymentId IS NOT NULL ${includeReviews?'OR r.reference IS NOT NULL':''}) ${scope}`;
  if(includeReviews&&!mentorKeys)cte+=` UNION ALL SELECT r.reference,r.startsAt,NULL,r.invoiceId,'btcpay',NULL,NULL,NULL,NULL,NULL,r.reason,r.invoiceId,r.slotReleased,r.invoiceStatus,r.lastSeen,'review' FROM payment_reviews r WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.reference=r.reference) AND ${unresolved}`;
  cte+=')';
  const params=mentorKeys?[...mentorKeys]:[],filters=[];
  if(status!=='all'){filters.push('status=?');params.push(status);}
  if(query.trim()){
    const escaped=query.trim().replace(/[\\%_]/g,'\\$&');
    filters.push("(reference LIKE ? ESCAPE '\\' OR paymentId LIKE ? ESCAPE '\\' OR mentorPubkey LIKE ? ESCAPE '\\')");
    params.push(...Array(3).fill('%'+escaped+'%'));
  }
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  const counts=db.prepare(cte+` SELECT COUNT(*) AS total,SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) AS needsReview FROM ledger`+where).get(...params);
  const rows=db.prepare(cte+` SELECT * FROM ledger`+where+` ORDER BY CASE WHEN status='review' THEN 0 ELSE 1 END,startsAt DESC,reference ASC LIMIT ? OFFSET ?`).all(...params,limit,(page-1)*limit);
  return {rows,total:counts.total,needsReview:counts.needsReview||0,page,pageSize:limit,hasNext:page*limit<counts.total,canReview:includeReviews,basis:'Booking amounts in original currencies. Confirmed amounts are gross, before refunds and provider fees.'};
}
