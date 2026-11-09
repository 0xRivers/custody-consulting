import { createHmac, timingSafeEqual } from 'node:crypto';

export function readCalRequest(rawBody, signature, secret) {
  if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string') return null;
  const hex = signature.replace(/^sha256=/, '');
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  if (!timingSafeEqual(expected, Buffer.from(hex, 'hex'))) return null;
  const event = JSON.parse(rawBody.toString('utf8'));
  if (event.triggerEvent !== 'BOOKING_REQUESTED') return null;
  const reference = event.payload?.uid;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(reference ?? '')) return null;
  return reference;
}
