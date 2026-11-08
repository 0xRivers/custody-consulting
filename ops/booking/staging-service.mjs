import {bookingConfig} from './booking-config.mjs';
import {createPaidBookingResolver} from './resolve-booking.mjs';
import {recordPaymentReview} from './payment-review.mjs';
import {switchToBTC} from './switch-payment.mjs';
import {createNostrAdmin, AdminError} from './nostr-admin.mjs';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStripeSandbox } from './stripe-sandbox.mjs';
import { paymentDecision, bookingPrice, bitcoinPrice as foundationBitcoinPrice, priceForCurrency, foundationPrices, foundationPricingVersion } from './payment-decision.mjs';
import { readCalRequest } from './cal-webhook.mjs';
import { createCalScheduler, currentCalAppointment, SchedulingError } from './cal-scheduler.mjs';
import {createBTCPay,BTCPayError} from './btcpay-provider.mjs';

const {
  CAL_API_KEY, CAL_STAGING_EVENT_ID, STRIPE_RESTRICTED_KEY,
  STRIPE_WEBHOOK_SECRET, BOOKING_DB, CAL_FOUNDATION_TEST_BOOKING_UID,
  CAL_WEBHOOK_SECRET,
  BTCPAY_URL,BTCPAY_STORE_ID,BTCPAY_API_KEY,BTCPAY_WEBHOOK_SECRET,BTCPAY_ENABLED,BTCPAY_CHECKOUT_ORIGIN,BTCPAY_NETWORK,
} = process.env;
const config=bookingConfig(process.env);
const bitcoinPrice=config.pilot?{currency:'PLN',minorUnits:config.pilotMinorUnits}:foundationBitcoinPrice;
const siteRoot=config.origin+config.pathPrefix;
const eventId = Number(process.env.CAL_EVENT_ID||CAL_STAGING_EVENT_ID);
if (!CAL_API_KEY || !Number.isSafeInteger(eventId) || eventId <= 0 ||
    eventId === 7772427 || !BOOKING_DB?.startsWith('/')) {
  throw new Error('Configure CAL_API_KEY, CAL_STAGING_EVENT_ID and an absolute BOOKING_DB path. Discovery is excluded.');
}
if (eventId === 7783830 &&
    !/^[a-zA-Z0-9_-]{1,100}$/.test(CAL_FOUNDATION_TEST_BOOKING_UID ?? '')) {
  throw new Error('Using Foundation requires one explicit CAL_FOUNDATION_TEST_BOOKING_UID.');
}
const stripe = config.pilot?null:createStripeSandbox({ apiKey: STRIPE_RESTRICTED_KEY, signingSecret: STRIPE_WEBHOOK_SECRET,live:config.live,origin:config.origin });
const scheduler = createCalScheduler({apiKey:CAL_API_KEY, eventId});
let btcpay;
if(BTCPAY_URL&&BTCPAY_STORE_ID&&BTCPAY_API_KEY&&BTCPAY_WEBHOOK_SECRET) {
  try {btcpay=createBTCPay({baseUrl:BTCPAY_URL,storeId:BTCPAY_STORE_ID,apiKey:BTCPAY_API_KEY,signingSecret:BTCPAY_WEBHOOK_SECRET,
    publicOrigin:BTCPAY_CHECKOUT_ORIGIN||'https://pay.custody.consulting',network:BTCPAY_NETWORK||'mainnet',explorerApi:process.env.BTCPAY_EXPLORER_API,origin:config.origin,pathPrefix:config.pathPrefix,integration:config.integration});}
  catch {console.error('BTCPay configuration is invalid. PLN remains available.');}
}
const btcEnabled=!!btcpay&&BTCPAY_ENABLED==='true'&&['mainnet','testnet','regtest'].includes(BTCPAY_NETWORK);
const lightningEnabled=btcEnabled&&BTCPAY_NETWORK==='mainnet'&&process.env.BTCPAY_LIGHTNING_ENABLED==='true';
if(config.pilot&&!lightningEnabled)throw new Error('Lightning pilot requires a configured BTCPay store');
const defaultBitcoinRail=lightningEnabled?'either':'onchain';
const paymentMethods=()=>config.pilot?['BTC']:btcEnabled?['BTC','PLN']:['PLN'];
process.umask(0o077);
const db = new DatabaseSync(BOOKING_DB);
db.exec(`
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS bookings (
    reference TEXT PRIMARY KEY,
    startsAt TEXT NOT NULL,
    locale TEXT NOT NULL,
    deadline INTEGER NOT NULL,
    paymentId TEXT UNIQUE,
    checkoutUrl TEXT,
    state TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS invitations (
    tokenHash TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    reference TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS booking_attempts (
    tokenHash TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    reference TEXT
  );
  CREATE TABLE IF NOT EXISTS checkout_attempts (
    reference TEXT PRIMARY KEY,
    provider TEXT NOT NULL
  );
`);
// Additive migration preserves previously issued Stripe checkouts and existing bookings.
const columns=new Set(db.prepare('PRAGMA table_info(bookings)').all().map(column=>column.name));
for(const [name,definition] of [['provider',"TEXT NOT NULL DEFAULT 'stripe'"],['resultToken','TEXT'],['paymentPhase','TEXT'],['paymentRail',"TEXT NOT NULL DEFAULT 'onchain'"],['settledRail','TEXT'],['settledSats','INTEGER'],['priceMinorUnits','INTEGER NOT NULL DEFAULT 42000'],['priceCurrency',"TEXT NOT NULL DEFAULT 'PLN'"],['priceVersion',"TEXT NOT NULL DEFAULT 'foundation-v1'"]]) {
  if(!columns.has(name))db.exec(`ALTER TABLE bookings ADD COLUMN ${name} ${definition}`);
}
if (!db.prepare('PRAGMA table_info(invitations)').all().some(column => column.name === 'retryReference')) {
  db.exec('ALTER TABLE invitations ADD COLUMN retryReference TEXT');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS bookings_result_token ON bookings (resultToken)');
// The accepted price survives catalogue changes, provider switching and retries.
db.exec(`CREATE TRIGGER IF NOT EXISTS bookings_price_immutable
  BEFORE UPDATE OF priceMinorUnits, priceCurrency, priceVersion ON bookings
  WHEN NEW.priceMinorUnits IS NOT OLD.priceMinorUnits OR NEW.priceCurrency IS NOT OLD.priceCurrency OR NEW.priceVersion IS NOT OLD.priceVersion
  BEGIN SELECT RAISE(ABORT, 'Booking price is immutable'); END`);

const admin = createNostrAdmin({db, allowlist:process.env.BOOKING_ADMIN_NPUBS || '',origin:config.origin,pathPrefix:config.pathPrefix});

const findInvitationForBooking = db.prepare('SELECT reference FROM invitations WHERE reference = ?');
const hashToken = token => createHash('sha256').update(token).digest('hex');
async function calBooking(reference, action = '', invitationRead = false, signal = AbortSignal.timeout(10_000)) {
  if (eventId === 7783830 && reference !== CAL_FOUNDATION_TEST_BOOKING_UID &&
      !findInvitationForBooking.get(reference) && !db.prepare('SELECT reference FROM payment_resolutions WHERE replacementUid=?').get(reference) && !(invitationRead && !action)) {
    throw new Error('This service can only access an explicitly authorized Foundation test booking.');
  }
  const bookingLocale = action === '/decline' ? db.prepare('SELECT locale FROM bookings WHERE reference = ?').get(reference)?.locale : 'en';
  const expiryReason = bookingLocale === 'pl'
    ? 'Nie otrzymaliśmy płatności w wyznaczonym czasie, dlatego termin został zwolniony. Możesz wybrać nowy termin, korzystając z nowego zaproszenia. Jeśli płatność została już wysłana, nie płać ponownie — skontaktuj się z nami: info@custody.consulting.'
    : 'We didn’t receive payment within the payment window, so the time slot has been released. You can choose another time using a new invitation. If you have already sent payment, please don’t pay again — contact us at info@custody.consulting.';
  const response = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(reference)}${action}`, {
    method: action ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${CAL_API_KEY}`,
      'cal-api-version': '2026-02-25',
      ...(action === '/decline' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: action === '/decline' ? JSON.stringify({ reason: expiryReason }) : undefined,
    signal,
  });
  if (!response.ok) throw new Error(`Cal.com request failed (HTTP ${response.status}).`);
  const result = await response.json();
  if (result.status !== 'success' || result.data?.uid !== reference ||
      result.data.eventTypeId !== eventId) throw new Error('Cal.com returned an unexpected staging booking.');
  return result.data;
}

const resolver=createPaidBookingResolver({db,btcpay,scheduler,calBooking});

const findBooking = db.prepare('SELECT * FROM bookings WHERE reference = ?');

async function issueCheckout(reference, locale, paymentMethod='PLN') {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(reference ?? '') || !['en', 'pl'].includes(locale)) {
    throw new Error('Use issue-checkout BOOKING_UID en|pl.');
  }
  const booking = await calBooking(reference);
  if (booking.status !== 'pending' || booking.duration !== 60) {
    throw new Error('The booking must be a pending 60-minute request on the staging event.');
  }
  const deadline = Math.floor(Date.now() / 1000) * 1000 + 35 * 60_000;
  if (Date.parse(booking.start) <= deadline) throw new Error('The appointment starts too soon for checkout.');
  db.prepare('INSERT OR IGNORE INTO bookings (reference, startsAt, locale, deadline, provider) VALUES (?, ?, ?, ?, ?)')
    .run(reference, booking.start, locale, deadline,paymentMethod==='BTC'?'btcpay':'stripe');
  const row = findBooking.get(reference);
  if (row.state !== 'pending' || row.deadline <= Date.now() || row.startsAt !== booking.start) {
    throw new Error('The booking changed or checkout expired. Review it before issuing another payment request.');
  }
  if (row.checkoutUrl) return row.checkoutUrl;
  if(row.provider==='btcpay') {
    if(!btcEnabled)throw new SchedulingError('PAYMENT_UNAVAILABLE',503);
    const resultToken=row.resultToken||randomBytes(32).toString('base64url');
    db.prepare('UPDATE bookings SET resultToken = ? WHERE reference = ?').run(resultToken,reference);
    const attempt=db.prepare('SELECT reference FROM checkout_attempts WHERE reference = ?').get(reference);
    let invoice;
    if(attempt)invoice=await btcpay.recoverCheckout({reference,resultToken,price:bookingPrice(row),rail:row.paymentRail});
    else {
      db.prepare("INSERT INTO checkout_attempts (reference,provider) VALUES (?, 'btcpay')").run(reference);
      const buyerEmail = config.live ? booking.attendees?.[0]?.email : undefined;
      try {invoice=await btcpay.createCheckout({reference,locale:row.locale,resultToken,price:bookingPrice(row),rail:row.paymentRail,buyerEmail});}
      catch(error) {
        if(error instanceof BTCPayError&&!error.uncertain)db.prepare('DELETE FROM checkout_attempts WHERE reference = ?').run(reference);
        throw error;
      }
    }
    if(invoice.deadline>=Date.parse(row.startsAt)||invoice.deadline<=Date.now())throw new SchedulingError('BTC_CHECKOUT_NEEDS_REVIEW');
    db.prepare('UPDATE bookings SET paymentId = ?, checkoutUrl = ?, deadline = ? WHERE reference = ?')
      .run(invoice.id,invoice.url,invoice.deadline,reference);
    return invoice.url;
  }
  const checkout = await stripe.createCheckout({
    reference, locale: row.locale, deadline: row.deadline, price:bookingPrice(row),
    returnUrl: `${siteRoot}/payment/result/?lang=${row.locale}`,
  });
  db.prepare('UPDATE bookings SET paymentId = ?, checkoutUrl = ? WHERE reference = ?')
    .run(checkout.id, checkout.url, reference);
  return checkout.url;
}

async function processPayment(payment) {
  if (!payment?.reference) return;
  if (eventId === 7783830 && payment.reference !== CAL_FOUNDATION_TEST_BOOKING_UID &&
      !findInvitationForBooking.get(payment.reference)) return;
  let row = findBooking.get(payment.reference);
  if (!row) return;
  if(row.provider==='btcpay'&&(payment.resultToken!==row.resultToken||(payment.rail??'onchain')!==row.paymentRail))return;
  // Recover an invoice whose creation succeeded but whose response was lost, even if the customer never returns.
  if(!row.paymentId&&row.provider==='btcpay'&&payment.provider==='btcpay'&&btcpay) {
    const recovered=await btcpay.recoverCheckout({reference:row.reference,resultToken:row.resultToken,price:bookingPrice(row),rail:row.paymentRail});
    if(recovered.id!==payment.id||recovered.deadline>=Date.parse(row.startsAt))throw new Error('BTC invoice needs review.');
    db.prepare('UPDATE bookings SET paymentId = ?, checkoutUrl = ?, deadline = ? WHERE reference = ? AND paymentId IS NULL')
      .run(recovered.id,recovered.url,recovered.deadline,row.reference);
    row=findBooking.get(payment.reference);
  }
  // If Stripe checkout creation is still persisting its provider ID, let Stripe retry.
  if (!row.paymentId) throw new Error('Checkout record is not ready.');
  const decision = paymentDecision(row, payment);
  if(decision==='wait'&&payment.state==='processing')db.prepare("UPDATE bookings SET paymentPhase = ? WHERE reference = ? AND state = 'pending'").run(payment.phase||'processing',row.reference);
  if (decision === 'reconcile') {
    recordPaymentReview({db,row,payment});
  }
  if (decision === 'release') {
    const booking = await calBooking(row.reference);
    if (booking.start !== row.startsAt) {
      db.prepare("UPDATE bookings SET state = 'reconcile' WHERE reference = ? AND state = 'pending'").run(row.reference);
      return;
    }
    if (booking.status === 'accepted') return;
    const result = booking.status === 'pending' ? await calBooking(row.reference, '/decline') : booking;
    if (!['rejected', 'cancelled'].includes(result.status)) throw new Error('Cal.com did not release the slot.');
    db.prepare("UPDATE bookings SET state = 'released' WHERE reference = ? AND state = 'pending'").run(row.reference);
    return;
  }
  if (decision !== 'confirm') return;

  const booking = await calBooking(row.reference);
  if (booking.start !== row.startsAt || !['accepted', 'pending'].includes(booking.status)||
    (booking.status==='pending'&&Date.parse(booking.start)<=Date.now())) {
    db.prepare("UPDATE bookings SET state = 'reconcile' WHERE reference = ? AND state = 'pending'").run(row.reference);
    return;
  }
  if (booking.status === 'pending') {
    const confirmed = await calBooking(row.reference, '/confirm');
    if (confirmed.status !== 'accepted') throw new Error('Cal.com did not confirm the booking.');
  }
  db.prepare("UPDATE bookings SET state = 'confirmed', settledRail = ?, settledSats = ? WHERE reference = ? AND state = 'pending'").run(payment.provider==='btcpay'?(payment.paymentDetails?.rail??'onchain'):null,payment.settledSats??null,row.reference);
}

if (process.argv[2] === 'diagnose-recovery') {
  if(config.live||config.pilot)throw new Error('This diagnostic is staging-only.');
  const rows=db.prepare("SELECT * FROM bookings WHERE provider='stripe' ORDER BY rowid DESC LIMIT 5").all();
  for(const [index,row] of rows.entries()) {
    const report={booking:index+1,localState:row.state,expectedPrice:bookingPrice(row),hasPaymentId:!!row.paymentId};
    try {
      if(row.paymentId) {
        report.provider=await stripe.inspectRecovery({id:row.paymentId,reference:row.reference});
        const recovered=await stripe.recoverPayment({id:row.paymentId,reference:row.reference});
        report.recoveredState=recovered?.state||'no-matching-payment';
        report.decision=recovered?paymentDecision(row,recovered):'none';
        report.beforeDeadline=recovered?recovered.receivedAt<=row.deadline:null;
      }
    }catch(error) {report.errorType=typeof error.type==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(error.type)?error.type:'ProviderReadFailed';report.httpStatus=Number.isInteger(error.statusCode)?error.statusCode:null;}
    console.log(JSON.stringify(report));
  }
  if(!rows.length)console.log('No Stripe bookings in this database.');
} else if (process.argv[2] === 'check-btcpay') {
  if(!btcpay)throw new Error('Set BTCPAY_URL, BTCPAY_STORE_ID, BTCPAY_API_KEY and BTCPAY_WEBHOOK_SECRET on the VPS.');
  console.log(JSON.stringify({...await btcpay.check(),enabled:btcEnabled},null,2));
} else if (process.argv[2] === 'check-calendar') {
  const configuration = await scheduler.configuration();
  console.log(JSON.stringify({eventId, duration:60, requiresConfirmation:true, paymentField:configuration.paymentSlug}, null, 2));
} else if (process.argv[2] === 'create-invite') {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO invitations (tokenHash, expiresAt) VALUES (?, ?)')
    .run(hashToken(token), Date.now() + 24 * 60 * 60_000);
  console.log(`${siteRoot}/payment#invite=${token}`);
} else if (process.argv[2] === 'issue-checkout') {
  if(config.pilot)throw new Error('Use a private pilot invitation.');
  console.log(await issueCheckout(process.argv[3], process.argv[4]));
} else if (process.argv[2] === 'serve') {
  // A single worker serializes confirmation attempts and keeps retries recoverable.
  let queue = Promise.resolve();
  // Reconcile inside this worker's mutation queue, never in a second process.
  if(process.env.BOOKING_RECONCILE_BTC==='true') {
    let cursor='',scheduled=false;
    const sweep=()=> {
      if(scheduled||!btcEnabled)return;
      scheduled=true;
      const task=queue.then(async()=>{
        const rows=db.prepare("SELECT reference,paymentId FROM bookings WHERE provider='btcpay' AND paymentId IS NOT NULL AND state IN ('pending','reconcile') AND reference>? ORDER BY reference LIMIT 20").all(cursor);
        if(!rows.length)cursor='';
        for(const row of rows) {
          cursor=row.reference;
          try {await processPayment(await btcpay.readInvoice(row.paymentId));}
          catch {console.error('BTC reconciliation failed; payment retained for retry.');}
        }
      });
      queue=task.catch(()=>{console.error('BTC reconciliation sweep failed.');}).finally(()=>{scheduled=false;});
    };
    setInterval(sweep,60000).unref();sweep();
  }
  if(stripe&&process.env.BOOKING_RECONCILE_STRIPE==='true') {
    let cursor='',scheduled=false;
    const sweep=()=>{
      if(scheduled)return;scheduled=true;
      const task=queue.then(async()=>{
        const rows=db.prepare("SELECT reference,paymentId FROM bookings WHERE provider='stripe' AND paymentId IS NOT NULL AND state='pending' AND reference>? ORDER BY reference LIMIT 20").all(cursor);
        if(!rows.length)cursor='';
        for(const row of rows) {
          cursor=row.reference;
          try {await processPayment(await stripe.recoverPayment({id:row.paymentId,reference:row.reference}));}
          catch {console.error('Stripe reconciliation failed; payment retained for retry or operator review.');}
        }
      });
      queue=task.catch(()=>console.error('Stripe reconciliation sweep failed.')).finally(()=>{scheduled=false;});
    };
    setInterval(sweep,60000).unref();sweep();
  }
  const bitcoinDetails=new Map();
  function isUnpaidExpiry(row, payment) {
    const price = bookingPrice(row);
    return btcEnabled && row.state === 'released' && payment?.state === 'expired-unpaid' &&
      payment.id === row.paymentId && payment.reference === row.reference &&
      payment.resultToken === row.resultToken && (payment.rail ?? 'onchain') === row.paymentRail &&
      payment.currency === price.currency && payment.minorUnits === price.minorUnits &&
      payment.expiresAt === row.deadline;
  }
  async function verifyRetry(reference) {
    const row = findBooking.get(reference);
    if (row?.state !== 'released' || row.provider !== 'btcpay' || !row.paymentId ||
        db.prepare('SELECT 1 FROM payment_reviews WHERE reference = ?').get(reference) ||
        !isUnpaidExpiry(row, await btcpay?.readInvoice(row.paymentId))) {
      throw new SchedulingError('BOOKING_NEEDS_REVIEW');
    }
    return row;
  }
  async function readBitcoinDetails(row) {
    if(!btcpay||row.provider!=='btcpay'||!row.paymentId)return null;
    const key=row.paymentId, existing=bitcoinDetails.get(key);
    if(existing&&existing.until>Date.now())return existing.promise;
    if(bitcoinDetails.size>=200)bitcoinDetails.delete(bitcoinDetails.keys().next().value);
    const promise=btcpay.readInvoice(key,{includeWallet:true}).then(payment=>payment.resultToken===row.resultToken&&payment.reference===row.reference&&(payment.rail??'onchain')===row.paymentRail?payment:null).catch(()=>null);
    bitcoinDetails.set(key,{until:Date.now()+15000,promise});
    return promise;
  }
  createServer(async (req, res) => {
    if(config.pilot&&req.method==='GET'&&req.url==='/booking-api/pilot-health') {
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'});
      res.end(JSON.stringify({bitcoinCheckout:defaultBitcoinRail}));
      return;
    }
    if (req.method === 'POST' && req.url === '/booking-api/checkout') {
      if (req.headers.origin !== config.origin ||
          !req.headers['content-type']?.startsWith('application/json')) {
        res.writeHead(403).end();
        return;
      }
      try {
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 8192) { res.writeHead(413).end(); return; }
          chunks.push(chunk);
        }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const { reference, locale, action, sessionId,checkoutToken } = input;
        if (action === 'admin-challenge' || action === 'admin-invite' || action === 'admin-reviews' || action === 'admin-sales' || action === 'admin-resolve-preview' || action === 'admin-resolve-confirm') {
          try {
            let result;
            if(action==='admin-resolve-preview'||action==='admin-resolve-confirm') {
              const purpose=action==='admin-resolve-preview'?'resolve-preview':'resolve-confirm';
              const authorized=admin.resolution(input,purpose);
              const task=queue.then(()=>purpose==='resolve-preview'?resolver.preview(authorized.request):resolver.confirm(authorized.request,authorized.operator));
              queue=task.catch(()=>{});result=await task;
            } else if (action === 'admin-sales') {
              result = {...admin.sales(input), environment: config.pilot ? 'Lightning pilot' : config.environment,
                refundOrigin: btcpay ? new URL(BTCPAY_CHECKOUT_ORIGIN || 'https://pay.custody.consulting').origin : null};
            } else result = action === 'admin-challenge' ? admin.challenge(input) : action === 'admin-reviews' ? admin.reviews(input) : admin.invite(input);
            res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'}).end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(error instanceof AdminError || error instanceof SchedulingError ? error.status : 503, {'Content-Type':'application/json', 'Cache-Control':'no-store'}).end(JSON.stringify({error:error instanceof AdminError || error instanceof SchedulingError ? error.message : 'ADMIN_UNAVAILABLE'}));
          }
          return;
        }
        if (action === 'status' || action === 'retry-expired') {
          const validSession=typeof sessionId==='string'&&(config.live?/^cs_live_[A-Za-z0-9]{1,250}$/:/^cs_test_[A-Za-z0-9]{1,250}$/).test(sessionId);
          const validToken=typeof checkoutToken==='string'&&/^[A-Za-z0-9_-]{43}$/.test(checkoutToken);
          if (!validSession&&!validToken) {
            res.writeHead(400, { 'Cache-Control': 'no-store' }).end();
            return;
          }
          // The unguessable Checkout ID is the capability. Expose no attendee or meeting-link data.
          const row = validToken?db.prepare('SELECT priceMinorUnits, priceCurrency, priceVersion, state, startsAt, deadline, paymentPhase, provider, paymentId, resultToken, reference, paymentRail, settledRail FROM bookings WHERE resultToken = ?').get(checkoutToken):
            db.prepare("SELECT priceMinorUnits, priceCurrency, priceVersion, state, reference, paymentPhase FROM bookings WHERE paymentId = ? AND provider = 'stripe'").get(sessionId);
          if (action === 'retry-expired') {
            if (!validToken || !row) throw new SchedulingError('NO_BOOKING', 404);
            const task = queue.then(async () => {
              const previous = await verifyRetry(row.reference);
              // One replacement invite per expired checkout, even after duplicate clicks.
              const token = createHash('sha256').update('custody-retry:' + checkoutToken).digest('base64url');
              const tokenHash = hashToken(token);
              db.prepare('INSERT OR IGNORE INTO invitations (tokenHash, expiresAt, retryReference) VALUES (?, ?, ?)')
                .run(tokenHash, Date.now() + 24 * 60 * 60_000, previous.reference);
              return token;
            });
            queue = task.catch(() => {});
            const invite = await task;
            res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'})
              .end(JSON.stringify({invite}));
            return;
          }
          const appointment = row?.state === 'confirmed' ? (async () => {
            const replacement = db.prepare("SELECT replacementUid FROM payment_resolutions WHERE reference = ? AND state = 'confirmed'").get(row.reference);
            const signal = AbortSignal.timeout(3500);
            return currentCalAppointment(replacement?.replacementUid ?? row.reference,
              uid => calBooking(uid, '', true, signal));
          })().catch(() => ({})) : {};
          const [payment, appointmentDetails] = await Promise.all([
            validToken&&row?readBitcoinDetails(row):null,
            appointment,
          ]);
          const paymentDetails=payment?.paymentDetails;
          const review=validToken&&row?db.prepare('SELECT reason, slotReleased FROM payment_reviews WHERE reference = ?').get(row.reference):null;
          res.writeHead(row ? 200 : 404, {
            'Content-Type': 'application/json', 'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          }).end(JSON.stringify(row ? { state: row.state,price:bookingPrice(row),...(!review&&payment&&isUnpaidExpiry(row,payment)?{canRetry:true}:{}),...((row.paymentRail==='lightning'||row.settledRail==='lightning'||paymentDetails?.rail==='lightning')?{rail:'lightning'}:{}),...(review?{reviewReason:review.reason,slotReleased:!!review.slotReleased}:{}),...(paymentDetails?{paymentDetails}:{}),...(row.paymentPhase?{phase:row.paymentPhase}:{}), ...appointmentDetails } : { error: 'Unknown checkout.' }));
          return;
        }
        const token = req.headers['x-booking-invite'];
        const invitation = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
          ? db.prepare('SELECT * FROM invitations WHERE tokenHash = ?').get(hashToken(token)) : null;
        if (['availability', 'book', 'resume', 'switch-payment'].includes(action)) {
          if (!invitation || invitation.expiresAt <= Date.now() || !['en', 'pl'].includes(locale)) {
            res.writeHead(403, {'Cache-Control':'no-store'}).end(); return;
          }
          const task = queue.then(async () => {
            const current = db.prepare('SELECT * FROM invitations WHERE tokenHash = ?').get(invitation.tokenHash);
            if (current.expiresAt <= Date.now()) throw new SchedulingError('INVITATION_EXPIRED', 403);
            const attempt = db.prepare('SELECT * FROM booking_attempts WHERE tokenHash = ?').get(current.tokenHash);
            if (current.reference) {
              const row = findBooking.get(current.reference);
              const bookingLocale = row?.locale || locale;
              if (row?.state === 'confirmed' && row.paymentId) return {reference:current.reference,
                redirect:`${siteRoot}/payment/result/?lang=${bookingLocale}&${row.provider==='btcpay'?'checkout='+row.resultToken:'session_id='+row.paymentId}`};
              if (current.retryReference && (action === 'switch-payment' || (action !== 'availability' && !row?.paymentId))) {
                await verifyRetry(current.retryReference);
              }
              if (action === 'switch-payment' || (action === 'resume' && row?.state === 'switching')) {
                if (action === 'switch-payment' && input.paymentMethod !== 'BTC') throw new SchedulingError('INVALID_INPUT',400);
                return {reference:current.reference,url:await switchToBTC({db,reference:current.reference,stripe,enabled:btcEnabled,calBooking,issueCheckout,...(defaultBitcoinRail==='either'?{rail:'either'}:{})})};
              }
              if (action === 'availability') return {reference:current.reference, locale:bookingLocale,prices:foundationPrices,bitcoinPrice,...(lightningEnabled?{lightningAvailable:true}:{}),...(config.pilot?{lightningPilot:true}:{}),...(btcEnabled?{btcEstimate:await btcpay.estimatePrice(foundationPrices.PLN)}:{}),paymentMethods:paymentMethods(),
                canSwitchToBTC:btcEnabled && row?.provider==='stripe' && ['pending','switching'].includes(row.state) && !!row.paymentId && row.deadline>Date.now()};
              return {reference:current.reference, url:await issueCheckout(current.reference, bookingLocale)};
            }
            if (attempt) throw new SchedulingError('BOOKING_NEEDS_REVIEW');
            if (action === 'availability') return {slots:await scheduler.availability(input),...(current.retryReference?{retryStartsAt:findBooking.get(current.retryReference)?.startsAt}:{}),prices:foundationPrices,bitcoinPrice,...(lightningEnabled?{lightningAvailable:true}:{}),...(config.pilot?{lightningPilot:true}:{}),...(btcEnabled?{btcEstimate:await btcpay.estimatePrice(foundationPrices.PLN)}:{}),paymentMethods:paymentMethods()};
            if (action === 'resume' || action === 'switch-payment') throw new SchedulingError('NO_BOOKING', 404);
            const price=input.paymentMethod==='BTC'?bitcoinPrice:priceForCurrency(input.currency||'PLN');
            if(!price)throw new SchedulingError('INVALID_INPUT',400);
            const selectedMethod=input.paymentMethod||'PLN';
            if(!paymentMethods().includes(selectedMethod))throw new SchedulingError('PAYMENT_UNAVAILABLE',503);
            const rail=selectedMethod==='BTC'?(config.pilot?defaultBitcoinRail:input.paymentRail??defaultBitcoinRail):'onchain';
            if(!['onchain','lightning','either'].includes(rail)||(rail!=='onchain'&&(selectedMethod!=='BTC'||!lightningEnabled)))throw new SchedulingError('PAYMENT_UNAVAILABLE',503);
            const body = await scheduler.prepare({...input,paymentMethod:selectedMethod});
            if (current.retryReference) await verifyRetry(current.retryReference);
            // Claim before sending to Cal. An ambiguous timeout must never cause a duplicate booking/email.
            db.prepare("INSERT INTO booking_attempts (tokenHash, state) VALUES (?, 'creating')").run(current.tokenHash);
            let booking;
            try { booking = await scheduler.book({...body, metadata:{custodyAttempt:current.tokenHash}}); }
            catch (error) {
              if (error instanceof SchedulingError && !error.uncertain) {
                db.prepare('DELETE FROM booking_attempts WHERE tokenHash = ?').run(current.tokenHash);
              }
              throw error;
            }
            db.exec('BEGIN IMMEDIATE');
            try {
              db.prepare('UPDATE invitations SET reference = ? WHERE tokenHash = ?').run(booking.uid, current.tokenHash);
              db.prepare("UPDATE booking_attempts SET state = 'bound', reference = ? WHERE tokenHash = ?").run(booking.uid, current.tokenHash);
              db.prepare('INSERT OR IGNORE INTO bookings (reference,startsAt,locale,deadline,provider,priceMinorUnits,priceCurrency,priceVersion,paymentRail) VALUES (?,?,?,?,?,?,?,?,?)')
                .run(booking.uid,booking.start,locale,Math.floor(Date.now()/1000)*1000+35*60_000,selectedMethod==='BTC'?'btcpay':'stripe',price.minorUnits,price.currency,selectedMethod==='BTC'?foundationPricingVersion+'-btc10':foundationPricingVersion,rail);
              db.exec('COMMIT');
            } catch (error) { db.exec('ROLLBACK'); throw error; }
            try { return {reference:booking.uid, url:await issueCheckout(booking.uid, locale)}; }
            catch { return {reference:booking.uid, error:'CHECKOUT_UNAVAILABLE'}; }
          });
          queue = task.catch(() => {});
          const result = await task;
          if(result.reference) {
            const row=findBooking.get(result.reference);
            if(row?.provider==='btcpay'&&row.checkoutUrl)result.checkoutOrigin=new URL(row.checkoutUrl).origin;
          }
          res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store',
            'X-Robots-Tag':'noindex, nofollow, noarchive'}).end(JSON.stringify(result));
          return;
        }
        if (config.pilot || !/^[a-zA-Z0-9_-]{1,100}$/.test(reference ?? '') || !['en', 'pl'].includes(locale) ||
            !invitation || invitation.expiresAt <= Date.now() ||
            (invitation.reference && invitation.reference !== reference)) {
          res.writeHead(403).end();
          return;
        }
        const task = queue.then(async () => {
          // Re-read inside the queue: simultaneous requests cannot bind one invite to two bookings.
          const current = db.prepare('SELECT * FROM invitations WHERE tokenHash = ?').get(invitation.tokenHash);
          if (current.expiresAt <= Date.now() || (current.reference && current.reference !== reference)) {
            throw new Error('Invitation is expired or already used.');
          }
          const booking = await calBooking(reference, '', true);
          if (booking.status !== 'pending' || booking.duration !== 60) throw new Error('Unexpected booking.');
          const answers = Object.values(booking.bookingFieldsResponses ?? {});
          const pln = answers.some(answer =>
            typeof answer === 'string' && /^(PLN|420 PLN(?:\s*[—–-].*)?)$/i.test(answer.trim()));
          if (!pln) return null;
          db.prepare('UPDATE invitations SET reference = ? WHERE tokenHash = ? AND reference IS NULL')
            .run(reference, invitation.tokenHash);
          return issueCheckout(reference, locale);
        });
        queue = task.catch(() => {});
        const url = await task;
        res.writeHead(url ? 200 : 409, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        }).end(JSON.stringify(url ? { url } : { error: 'Bitcoin checkout is not available in this pilot yet.' }));
      } catch (error) {
        res.writeHead(error instanceof SchedulingError ? error.status : 503,
          { 'Content-Type':'application/json', 'Cache-Control': 'no-store' })
          .end(JSON.stringify({error:error instanceof SchedulingError ? error.code : 'SERVICE_UNAVAILABLE'}));
      }
      return;
    }
    const calWebhook = req.url === '/booking-api/cal-webhook';
    const btcWebhook = req.url === '/booking-api/btcpay-webhook';
    if(config.pilot&&!btcWebhook){res.writeHead(404).end();return;}
    if (req.method !== 'POST' || (!calWebhook && !btcWebhook && req.url !== '/booking-api/stripe-webhook')) {
      res.writeHead(404).end();
      return;
    }
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 256 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks);
      let task;
      if(btcWebhook) {
        if(!btcpay){res.writeHead(400).end();return;}
        const invoiceId=btcpay.readWebhook(rawBody,req.headers['btcpay-sig']);
        if(!invoiceId){res.writeHead(204).end();return;}
        task=queue.then(async()=>processPayment(await btcpay.readInvoice(invoiceId)));
      } else if (calWebhook) {
        const reference = readCalRequest(rawBody, req.headers['x-cal-signature-256'], CAL_WEBHOOK_SECRET);
        if (!reference) {
          res.writeHead(400).end();
          return;
        }
        // This pilot explicitly authorizes one booking, even for signed requests.
        if (reference !== CAL_FOUNDATION_TEST_BOOKING_UID) {
          res.writeHead(204).end();
          return;
        }
        task = queue.then(async () => {
          const booking = await calBooking(reference);
          const answers = Object.values(booking.bookingFieldsResponses ?? {});
          const choosesPln = answers.some(answer =>
            typeof answer === 'string' && /^(PLN|420 PLN(?:\s*[—–-].*)?)$/i.test(answer.trim()));
          if (!choosesPln) return;
          await issueCheckout(reference, 'en');
        });
      } else {
        const payment = await stripe.readPaymentEvent(rawBody, req.headers['stripe-signature']);
        task = queue.then(() => processPayment(payment));
      }
      queue = task.catch(() => {});
      await task;
      res.writeHead(204).end();
    } catch (error) {
      const badSignature = error?.type === 'StripeSignatureVerificationError'||error?.badSignature===true;
      if (!badSignature) console.error('Booking payment webhook failed. The provider can retry.');
      res.writeHead(badSignature ? 400 : 503).end();
    }
  }).listen(config.port, '127.0.0.1');
} else {
  throw new Error('Use serve, check-calendar, check-btcpay, create-invite or issue-checkout BOOKING_UID en|pl.');
}
