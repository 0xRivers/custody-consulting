import Stripe from 'stripe';
import {SchedulingError} from './cal-scheduler.mjs';
import { foundationPrice } from './payment-decision.mjs';

export function createStripeSandbox({ apiKey, signingSecret,live=false,origin='https://staging.custody.consulting' }) {
  if (!(live?/^rk_live_/:/^rk_test_/).test(apiKey ?? '') || !/^whsec_/.test(signingSecret ?? '')) {
    throw new Error('A restricted Stripe key and webhook signing secret are required.');
  }
  const stripe = new Stripe(apiKey, { timeout: 10_000, maxNetworkRetries: 2 });

  async function readEvent(event) {
      if (event.livemode !== live || ![
        'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired',
      ].includes(event.type)) return null;
      const expired = event.type === 'checkout.session.expired';
      const expectedStatus = expired ? 'unpaid' : 'paid';
      if (event.data.object.payment_status !== expectedStatus) return null;

      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      if (session.livemode !== live || session.mode !== 'payment' || session.payment_status !== expectedStatus ||
          (expired && session.status !== 'expired')) return null;
      return {
        reference: session.client_reference_id,
        id: session.id,
        provider: 'stripe',
        state: expired ? 'expired-unpaid' : 'settled',
        expiresAt: session.expires_at * 1000,
        currency: session.currency?.toUpperCase(),
        minorUnits: session.amount_total,
        receivedAt: event.created * 1000,
      };
  }

  return {
    async inspectRecovery({id,reference}) {
      const session=await stripe.checkout.sessions.retrieve(id);
      const events=Number.isSafeInteger(session.created)?await stripe.events.list({types:['checkout.session.completed','checkout.session.async_payment_succeeded'],created:{gte:session.created},limit:100}):{data:[],has_more:false};
      return {sessionStatus:session.status,paymentStatus:session.payment_status,modeMatches:session.livemode===live,
        referenceMatches:session.client_reference_id===reference,currency:session.currency,minorUnits:session.amount_total,
        matchingPaidEvents:events.data.filter(e=>e.data?.object?.id===id&&e.data.object.payment_status==='paid').length,
        moreEventPages:events.has_more};
    },
    async createCheckout({ reference, locale, deadline, returnUrl, price=foundationPrice }) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(reference ?? '') ||
          !Number.isSafeInteger(deadline) || deadline % 1000 !== 0 ||
          !['en', 'pl'].includes(locale)) {
        throw new Error('Invalid booking reference, locale or checkout deadline.');
      }
      const url = new URL(returnUrl);
      if (url.origin !== origin || url.username || url.password) {
        throw new Error('Stripe checkout origin does not match its environment.');
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        locale,
        success_url: `${url.href}${url.search ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/?lang=${locale}`,
        expires_at: deadline / 1000,
        client_reference_id: reference,
        integration_identifier: 'custody-foundation-qxnvrtka',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: price.currency.toLowerCase(),
            unit_amount: price.minorUnits,
            product_data: { name: locale === 'pl' ? 'Konsultacja Foundation (60 min)' : 'Foundation consultation (60 min)' },
          },
        }],
      }, { idempotencyKey: `foundation-checkout-${reference}` });

      if (session.livemode !== live || !session.url) throw new Error('Stripe checkout mode or URL is invalid.');
      return { id: session.id, url: session.url };
    },

    async expireUnpaid({id,reference}) {
      const valid=session=>session.id===id&&session.livemode===live&&session.mode==='payment'&&
        session.client_reference_id===reference&&session.payment_status==='unpaid';
      let session=await stripe.checkout.sessions.retrieve(id);
      if(!valid(session)||!['open','expired'].includes(session.status))throw new SchedulingError('PAYMENT_SWITCH_BLOCKED');
      if(session.status==='open') {
        try {await stripe.checkout.sessions.expire(id);}
        catch { // A timeout or simultaneous payment must be resolved by reading Stripe again.
          session=await stripe.checkout.sessions.retrieve(id);
          if(!valid(session)||session.status!=='expired')throw new SchedulingError('PAYMENT_SWITCH_BLOCKED');
        }
      }
      session=await stripe.checkout.sessions.retrieve(id);
      if(!valid(session)||session.status!=='expired')throw new SchedulingError('PAYMENT_SWITCH_BLOCKED');
    },

    async recoverPayment({id,reference}) {
      const session=await stripe.checkout.sessions.retrieve(id);
      if(session.id!==id||session.livemode!==live||session.mode!=='payment'||session.client_reference_id!==reference)return null;
      if(session.status==='expired'&&session.payment_status==='unpaid')return {
        reference,id,provider:'stripe',state:'expired-unpaid',expiresAt:session.expires_at*1000,
        receivedAt:Date.now(),currency:session.currency?.toUpperCase(),minorUnits:session.amount_total,
      };
      if(session.payment_status!=='paid'||!Number.isSafeInteger(session.created))return null;
      // Recover the provider event's receipt time, never substitute poll time.
      let after;
      for(let page=0;page<5;page++) {
        const events=await stripe.events.list({types:['checkout.session.completed','checkout.session.async_payment_succeeded'],created:{gte:session.created},limit:100,...(after?{starting_after:after}:{})});
        for(const event of events.data) {
          if(event.data?.object?.id===id&&event.data.object.payment_status==='paid'&&event.livemode===live&&Number.isSafeInteger(event.created)) {
            const payment=await readEvent(event);
            if(payment?.reference===reference&&payment.id===id)return payment;
          }
        }
        if(!events.has_more)return null;
        after=events.data.at(-1)?.id;
        if(!after)return null;
      }
      throw new Error('Stripe event recovery limit reached; operator review required.');
    },

    async readPaymentEvent(rawBody, signature) {
      const event = stripe.webhooks.constructEvent(rawBody, signature, signingSecret);
      return readEvent(event);
    },
  };
}
