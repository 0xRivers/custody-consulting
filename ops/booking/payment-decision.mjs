// Change this one anchor to adjust all prices; any supported currency can anchor it.
export const foundationPriceAnchor = Object.freeze({currency:'PLN',minorUnits:42000});
export const foundationPricingVersion = 'foundation-fx-v1';
const approvedRatios = Object.freeze({PLN:42000,EUR:9500,GBP:8000});
export function deriveFoundationPrices({currency,minorUnits}) {
  if(!Object.hasOwn(approvedRatios,currency)||!Number.isSafeInteger(minorUnits)||minorUnits<=0)throw new Error('Invalid price anchor');
  return Object.freeze(Object.fromEntries(Object.entries(approvedRatios).map(([code,ratio])=>{
    const amount=Math.round(minorUnits*ratio/approvedRatios[currency]);
    if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Invalid derived price');
    return [code,Object.freeze({currency:code,minorUnits:amount})];
  })));
}
export const foundationPrices = deriveFoundationPrices(foundationPriceAnchor);
export const foundationPrice = foundationPrices.PLN;
export const bitcoinPrice = Object.freeze({currency:'PLN',minorUnits:Math.round(foundationPrice.minorUnits*90/100)});
export const priceForCurrency = currency => Object.hasOwn(foundationPrices,currency) ? foundationPrices[currency] : null;

// Call only with a payment retrieved from the provider after webhook verification.
// The caller persists the resulting action before contacting Cal.com.
export function paymentDecision(booking, payment) {
  if (!booking.paymentId || booking.paymentId !== payment.id || booking.provider !== payment.provider) {
    return 'ignore';
  }
  if (payment.state === 'review') return 'reconcile';
  if (payment.state === 'expired-unpaid') {
    return booking.state === 'pending' &&
      Number.isFinite(booking.deadline) && payment.expiresAt === booking.deadline &&
      Number.isFinite(payment.receivedAt) && payment.receivedAt >= booking.deadline
      ? 'release' : 'ignore';
  }
  if (payment.state !== 'settled') return 'wait';
  const expected = bookingPrice(booking);
  if (!expected || payment.currency !== expected.currency || payment.minorUnits !== expected.minorUnits) {
    return 'reconcile';
  }
  if (booking.state === 'confirmed') return 'ignore';
  if (booking.state !== 'pending') return 'reconcile';
  if (!Number.isFinite(payment.receivedAt) || !Number.isFinite(booking.deadline) ||
      payment.receivedAt > booking.deadline) return 'reconcile';
  return 'confirm';
}

// Missing columns are supported only for legacy callers; partially present snapshots fail closed.
export function bookingPrice(booking) {
  if (booking.priceMinorUnits === undefined && booking.priceCurrency === undefined && booking.priceVersion === undefined) return foundationPrice;
  if (!Number.isSafeInteger(booking.priceMinorUnits) || booking.priceMinorUnits <= 0 ||
      !/^[A-Z]{3}$/.test(booking.priceCurrency || '') || typeof booking.priceVersion !== 'string' || !booking.priceVersion) return null;
  return {minorUnits:booking.priceMinorUnits,currency:booking.priceCurrency};
}
