import {createHash, randomBytes} from 'node:crypto';
import {verifyEvent} from 'nostr-tools/pure';
import {decode} from 'nostr-tools/nip19';

const hash = value => createHash('sha256').update(value).digest('hex');
export class AdminError extends Error {
  constructor(message, status = 403) { super(message); this.status = status; }
}

export function createNostrAdmin({db, allowlist = '', now = Date.now,origin='https://staging.custody.consulting',pathPrefix=''}) {
  const endpoint=origin+pathPrefix+'/booking-api/checkout';
  const allowed = new Set(allowlist.split(/[\s,]+/).filter(Boolean).map(npub => {
    const key = decode(npub);
    if (key.type !== 'npub') throw new Error('BOOKING_ADMIN_NPUBS must contain only npubs.');
    return key.data;
  }));
  db.exec(`CREATE TABLE IF NOT EXISTS admin_challenges (
    nonce TEXT PRIMARY KEY, pubkey TEXT NOT NULL, locale TEXT NOT NULL, expiresAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_invite_audit (
    tokenHash TEXT PRIMARY KEY, pubkey TEXT NOT NULL, createdAt INTEGER NOT NULL
  );`);
  const challengeColumns=new Set(db.prepare('PRAGMA table_info(admin_challenges)').all().map(column=>column.name));
  if(!challengeColumns.has('purpose'))db.exec("ALTER TABLE admin_challenges ADD COLUMN purpose TEXT NOT NULL DEFAULT 'invite'");
  if(!challengeColumns.has('requestJson'))db.exec("ALTER TABLE admin_challenges ADD COLUMN requestJson TEXT NOT NULL DEFAULT '{}'");
  db.exec(`CREATE TABLE IF NOT EXISTS payment_resolutions (
    reference TEXT PRIMARY KEY, targetStart TEXT NOT NULL, previewHash TEXT NOT NULL,
    replacementUid TEXT UNIQUE, state TEXT NOT NULL, operator TEXT NOT NULL, createdAt INTEGER NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS payment_reviews (
    reference TEXT PRIMARY KEY, invoiceId TEXT NOT NULL, startsAt TEXT NOT NULL,
    reason TEXT NOT NULL, slotReleased INTEGER NOT NULL, invoiceStatus TEXT,
    firstSeen INTEGER NOT NULL, lastSeen INTEGER NOT NULL
  )`);
  let windowStart = 0, requests = 0;
  function requireAllowed(pubkey) {
    if (typeof pubkey !== 'string' || !allowed.has(pubkey)) throw new AdminError('ADMIN_NOT_ALLOWED');
  }
  function template(row) {
    return {kind:27235, created_at:Math.floor((row.expiresAt - 120000) / 1000), content:'', tags:[
      ['u', endpoint], ['method', 'POST'], ['payload', hash(JSON.stringify({locale:row.locale,purpose:row.purpose,request:JSON.parse(row.requestJson)}))],
      ['challenge', row.nonce],
    ]};
  }
  function authorize({event,locale},purpose) {
      requireAllowed(event?.pubkey);
      const nonce = event?.tags?.find(tag => Array.isArray(tag) && tag[0] === 'challenge')?.[1];
      if (typeof nonce !== 'string') throw new AdminError('ADMIN_INVALID_SIGNATURE');
      const row = db.prepare('SELECT * FROM admin_challenges WHERE nonce = ?').get(nonce);
      if (!row || row.expiresAt <= now() || row.pubkey !== event.pubkey || row.locale !== locale || row.purpose !== purpose) throw new AdminError('ADMIN_CHALLENGE_EXPIRED');
      const expected = template(row);
      if (event.kind !== expected.kind || event.created_at !== expected.created_at || event.content !== '' ||
          JSON.stringify(event.tags) !== JSON.stringify(expected.tags)) throw new AdminError('ADMIN_INVALID_SIGNATURE');
      // Rebuild a plain event: never trust verifier cache symbols supplied by callers.
      let valid = false;
      try {valid = verifyEvent({id:event.id, pubkey:event.pubkey, sig:event.sig, ...expected});} catch {}
      if (!valid) throw new AdminError('ADMIN_INVALID_SIGNATURE');
    return {row,nonce};
  }
  return {
    challenge({pubkey, locale, purpose='invite', request={}}) {
      // Bound challenge traffic and storage, including requests for known public keys.
      const time = now();
      if (time - windowStart >= 60000) {windowStart = time; requests = 0;}
      if (++requests > 60) throw new AdminError('ADMIN_RATE_LIMIT', 429);
      requireAllowed(pubkey);
      if (!['en','pl'].includes(locale)||!['invite','reviews','sales','resolve-preview','resolve-confirm'].includes(purpose)) throw new AdminError('INVALID_INPUT', 400);
      db.prepare('DELETE FROM admin_challenges WHERE expiresAt <= ?').run(time);
      const requestJson=JSON.stringify(request);
      if(requestJson.length>1000 || !request || typeof request!=='object' || Array.isArray(request))throw new AdminError('INVALID_INPUT',400);
      const row = {requestJson,nonce:randomBytes(32).toString('base64url'), pubkey, locale, purpose, expiresAt:time + 120000};
      db.prepare('INSERT INTO admin_challenges (nonce,pubkey,locale,expiresAt,purpose,requestJson) VALUES (?, ?, ?, ?, ?, ?)').run(row.nonce, pubkey, locale, row.expiresAt, purpose, requestJson);
      return {event:template(row)};
    },
    resolution(input,purpose) {
      if(!['resolve-preview','resolve-confirm'].includes(purpose))throw new AdminError('INVALID_INPUT',400);
      const {row,nonce}=authorize(input,purpose);
      if(db.prepare('DELETE FROM admin_challenges WHERE nonce = ?').run(nonce).changes!==1)throw new AdminError('ADMIN_CHALLENGE_EXPIRED');
      return {request:JSON.parse(row.requestJson),operator:row.pubkey};
    },
    reviews({event,locale}) {
      const {nonce}=authorize({event,locale},'reviews');
      if(db.prepare('DELETE FROM admin_challenges WHERE nonce = ?').run(nonce).changes!==1)throw new AdminError('ADMIN_CHALLENGE_EXPIRED');
      return {reviews:db.prepare("SELECT r.* FROM payment_reviews r WHERE NOT EXISTS (SELECT 1 FROM payment_resolutions s WHERE s.reference=r.reference AND s.state='confirmed') ORDER BY lastSeen DESC LIMIT 100").all()};
    },
    sales(input) {
      const {nonce}=authorize(input,'sales');
      if(db.prepare('DELETE FROM admin_challenges WHERE nonce = ?').run(nonce).changes!==1)throw new AdminError('ADMIN_CHALLENGE_EXPIRED');
      const totals = db.prepare(`
        SELECT provider, settledRail, priceCurrency AS currency,
          COUNT(*) AS count, SUM(priceMinorUnits) AS minorUnits,
          SUM(settledSats) AS sats, COUNT(settledSats) AS satsCount
        FROM bookings WHERE state = 'confirmed' AND paymentId IS NOT NULL
        GROUP BY provider, settledRail, priceCurrency ORDER BY provider, settledRail, priceCurrency
      `).all();
      const recent = db.prepare(`
        SELECT reference, paymentId, provider, settledRail, priceCurrency AS currency, priceMinorUnits AS minorUnits
        FROM bookings WHERE state = 'confirmed' AND paymentId IS NOT NULL
        ORDER BY rowid DESC LIMIT 25
      `).all();
      return {totals,recent};
    },
    invite({event, locale}) {
      const {row,nonce}=authorize({event,locale},'invite');
      const time = now();
      const count = db.prepare('SELECT COUNT(*) AS count FROM admin_invite_audit WHERE pubkey = ? AND createdAt > ?').get(row.pubkey, time - 3600000).count;
      if (count >= 30) throw new AdminError('ADMIN_RATE_LIMIT', 429);
      const token = randomBytes(32).toString('base64url'), tokenHash = hash(token), expiresAt = time + 86400000;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('DELETE FROM admin_challenges WHERE nonce = ?').run(nonce).changes !== 1) throw new AdminError('ADMIN_CHALLENGE_EXPIRED');
        db.prepare('INSERT INTO invitations (tokenHash, expiresAt) VALUES (?, ?)').run(tokenHash, expiresAt);
        db.prepare('INSERT INTO admin_invite_audit VALUES (?, ?, ?)').run(tokenHash, row.pubkey, time);
        db.exec('COMMIT');
      } catch (error) {db.exec('ROLLBACK'); throw error;}
      return {url:`${origin}${pathPrefix}/payment/?lang=${locale}#invite=${token}`, expiresAt};
    },
  };
}
