import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { decode, npubEncode } from 'nostr-tools/nip19';
import { verifyEvent } from 'nostr-tools/pure';
import { createIdentityStore, presets } from './identity-store.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const keyOf = npub => {
  try { const key = decode(npub); if (key.type === 'npub') return key.data; } catch {}
  throw new NetworkError('Use a valid public npub. Never enter a private key.', 400);
};
export class NetworkError extends Error {
  constructor(message, status = 403) { super(message); this.status = status; }
}
export const rolePermissions = presets;
const actions = new Set(['content-session-start', 'content-assign', 'content-assignments', 'session-start', 'apply', 'my-status', 'applications', 'branches', 'create-branch', 'approve', 'reject', 'role-update', 'sales', 'issue-invite']);
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
const text = (value, name, min, max) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new NetworkError(`${name} must contain ${min}–${max} characters.`, 400);
  return value.trim();
};
function only(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new NetworkError('Invalid request fields.', 400);
}

export function createMentorNetwork({ db, superAdminNpub, origin, now = Date.now }) {
  // No fallback to personal/booking allowlists; ownership is configured explicitly.
  const superAdmin = keyOf(superAdminNpub);
  if (!['https://custody.consulting', 'https://staging.custody.consulting'].includes(origin)) throw new NetworkError('Invalid network origin.');
  const endpoint = `${origin}/booking-api/checkout`;
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_content_sessions (tokenHash TEXT PRIMARY KEY, pubkey TEXT NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS content_article_ownership (articleId TEXT PRIMARY KEY, branchId TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mentor_sessions (tokenHash TEXT PRIMARY KEY, pubkey TEXT NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mentor_challenges (nonce TEXT PRIMARY KEY, pubkey TEXT NOT NULL, purpose TEXT NOT NULL, requestJson TEXT NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mentor_applications (id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, displayName TEXT NOT NULL, city TEXT NOT NULL, countryCode TEXT NOT NULL, timezone TEXT NOT NULL, languagesJson TEXT NOT NULL, experience TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', submittedAt INTEGER NOT NULL, reviewedAt INTEGER, reviewer TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS mentor_pending_key ON mentor_applications(pubkey) WHERE state='pending';
    CREATE TABLE IF NOT EXISTS custody_branches (id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, countryCode TEXT NOT NULL, timezone TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, createdAt INTEGER NOT NULL, createdBy TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS custody_roles (pubkey TEXT NOT NULL, role TEXT NOT NULL, branchId TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, changedAt INTEGER NOT NULL, changedBy TEXT NOT NULL, PRIMARY KEY(pubkey,role,branchId));
    CREATE TABLE IF NOT EXISTS custody_role_audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, detailJson TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mentor_invite_attribution (tokenHash TEXT PRIMARY KEY, mentorPubkey TEXT NOT NULL, branchId TEXT NOT NULL, branchName TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mentor_booking_attribution (reference TEXT PRIMARY KEY, mentorPubkey TEXT NOT NULL, branchId TEXT NOT NULL, branchName TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS mentor_sale_attribution_immutable BEFORE UPDATE ON mentor_booking_attribution BEGIN SELECT RAISE(ABORT,'Sale attribution is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS mentor_sale_attribution_no_delete BEFORE DELETE ON mentor_booking_attribution BEGIN SELECT RAISE(ABORT,'Sale attribution is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS custody_role_audit_no_update BEFORE UPDATE ON custody_role_audit BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS custody_role_audit_no_delete BEFORE DELETE ON custody_role_audit BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
  `);
  const identities = createIdentityStore({ db, now });
  const root = actor => { if (actor !== superAdmin) throw new NetworkError('Only the Custody Consulting super-admin can perform this action.'); };
  const audit = (actor, action, target, detail) => db.prepare('INSERT INTO custody_role_audit VALUES (?,?,?,?,?,?)').run(randomUUID(), actor, action, target, JSON.stringify(detail), now());
  function requireBranch(id) {
    if (!slug(id)) throw new NetworkError('Choose a valid branch.', 400);
    const branch = db.prepare('SELECT * FROM custody_branches WHERE id=? AND active=1').get(id);
    if (!branch) throw new NetworkError('This branch is unavailable.', 400);
    return branch;
  }
  const roles = actor => {
    const personId = identities.resolve(actor);
    if (!personId) return [];
    return db.prepare(`SELECT DISTINCT r.role,r.branchId FROM custody_roles r
      JOIN custody_branches b ON b.id=r.branchId
      JOIN network_identity_keys k ON k.pubkey=r.pubkey
      WHERE k.personId=? AND r.active=1 AND b.active=1`).all(personId);
  };
  const ownKeys = actor => db.prepare('SELECT pubkey FROM network_identity_keys WHERE personId=?').all(identities.resolve(actor)).map(row => row.pubkey);
  const permit = (actor, permission, branchId) => actor === superAdmin || roles(actor).some(role => role.branchId === branchId && rolePermissions[role.role]?.includes(permission));
  function regional(data) {
    const city = text(data.city, 'City/region', 2, 100);
    if (typeof data.countryCode !== 'string' || !/^[A-Z]{2}$/.test(data.countryCode)) throw new NetworkError('Use a two-letter country code.', 400);
    if (typeof data.timezone !== 'string' || data.timezone.length > 80) throw new NetworkError('Choose a valid time zone.', 400);
    try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }); } catch { throw new NetworkError('Choose a valid time zone.', 400); }
    return { city, countryCode: data.countryCode, timezone: data.timezone };
  }
  function dispatch(actor, action, request) {
    if (action === 'content-assignments') {
      root(actor); only(request, []);
      return { assignments: db.prepare('SELECT articleId,branchId FROM content_article_ownership ORDER BY articleId').all() };
    }
    if (action === 'content-assign') {
      root(actor); only(request, ['articleId', 'branchId']);
      if (!slug(request.articleId)) throw new NetworkError('Choose a valid article.', 400);
      if (request.branchId !== null) requireBranch(request.branchId);
      const previous = db.prepare('SELECT branchId FROM content_article_ownership WHERE articleId=?').get(request.articleId)?.branchId ?? null;
      if (request.branchId === null) db.prepare('DELETE FROM content_article_ownership WHERE articleId=?').run(request.articleId);
      else db.prepare('INSERT INTO content_article_ownership VALUES (?,?) ON CONFLICT(articleId) DO UPDATE SET branchId=excluded.branchId').run(request.articleId, request.branchId);
      audit(actor, 'content.assigned', request.articleId, { previousBranchId: previous, branchId: request.branchId });
      return { assigned: true };
    }
    if (action === 'content-session-start') {
      only(request, []);
      if (actor !== superAdmin && !roles(actor).some(r => r.role === 'editor')) throw new NetworkError('Content editing access is unavailable.');
      const token = randomBytes(32).toString('base64url');
      db.prepare('DELETE FROM mentor_content_sessions WHERE expiresAt<=? OR pubkey=?').run(now(), actor);
      db.prepare('INSERT INTO mentor_content_sessions VALUES (?,?,?)').run(hash(token), actor, now() + 1800000);
      return { contentSessionToken: token };
    }
    if (action === 'session-start') {
      only(request, []);
      const token = randomBytes(32).toString('base64url');
      db.prepare('DELETE FROM mentor_sessions WHERE expiresAt<=? OR pubkey=?').run(now(), actor);
      db.prepare('INSERT INTO mentor_sessions VALUES (?,?,?)').run(hash(token), actor, now() + 1800000);
      return { sessionToken: token };
    }
    if (action === 'apply') {
      only(request, ['displayName', 'city', 'countryCode', 'timezone', 'languages', 'experience', 'consent']);
      const region = regional(request);
      if (request.consent !== true) throw new NetworkError('Confirm that Custody Consulting may review your application.', 400);
      const name = text(request.displayName, 'Name', 2, 100), experience = text(request.experience, 'Experience', 40, 3000);
      if (!Array.isArray(request.languages) || request.languages.length < 1 || request.languages.length > 10 || request.languages.some(language => typeof language !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language))) throw new NetworkError('Choose at least one language.', 400);
      if (db.prepare("SELECT id FROM mentor_applications WHERE pubkey IN (SELECT pubkey FROM network_identity_keys WHERE personId=?) AND state='pending'").get(identities.resolve(actor))) throw new NetworkError('You already have an application awaiting review.', 409);
      if (roles(actor).some(role => role.role === 'mentor')) throw new NetworkError('This npub is already an approved mentor.', 409);
      const id = randomUUID();
      db.prepare('INSERT INTO mentor_applications (id,pubkey,displayName,city,countryCode,timezone,languagesJson,experience,submittedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(id, actor, name, region.city, region.countryCode, region.timezone, JSON.stringify([...new Set(request.languages)]), experience, now());
      audit(actor, 'application.submitted', id, {});
      return { id, state: 'pending', message: 'Application received. Access is granted only after review and approval.' };
    }
    if (action === 'my-status') {
      only(request, []);
      return { superAdmin: actor === superAdmin, applications: db.prepare('SELECT id,state,submittedAt,reviewedAt FROM mentor_applications WHERE pubkey IN (SELECT pubkey FROM network_identity_keys WHERE personId=?) ORDER BY submittedAt DESC LIMIT 20').all(identities.resolve(actor)), roles: roles(actor) };
    }
    if (action === 'applications') {
      root(actor); only(request, []);
      return { applications: db.prepare('SELECT * FROM mentor_applications ORDER BY submittedAt DESC LIMIT 100').all().map(row => ({ ...row, npub: npubEncode(row.pubkey), languages: JSON.parse(row.languagesJson), languagesJson: undefined })) };
    }
    if (action === 'branches') {
      root(actor); only(request, []);
      return { branches: db.prepare('SELECT * FROM custody_branches ORDER BY name').all(), members: db.prepare('SELECT pubkey,role,branchId,active FROM custody_roles ORDER BY branchId,role').all() };
    }
    if (action === 'create-branch') {
      root(actor); only(request, ['id', 'name', 'city', 'countryCode', 'timezone']);
      if (!slug(request.id)) throw new NetworkError('Choose a lowercase branch ID.', 400);
      const region = regional(request), name = text(request.name, 'Branch name', 3, 120);
      if (db.prepare('SELECT id FROM custody_branches WHERE id=?').get(request.id)) throw new NetworkError('This branch ID already exists.', 409);
      db.prepare('INSERT INTO custody_branches (id,name,city,countryCode,timezone,createdAt,createdBy) VALUES (?,?,?,?,?,?,?)').run(request.id, name, region.city, region.countryCode, region.timezone, now(), actor);
      audit(actor, 'branch.created', request.id, { ...region, name }); return { id: request.id };
    }
    if (action === 'approve' || action === 'reject') {
      root(actor); only(request, action === 'approve' ? ['applicationId', 'branchId'] : ['applicationId']);
      const application = db.prepare("SELECT * FROM mentor_applications WHERE id=? AND state='pending'").get(request.applicationId);
      if (!application) throw new NetworkError('This application is no longer awaiting review.', 409);
      if (action === 'approve') {
        requireBranch(request.branchId);
        db.prepare('INSERT INTO custody_roles VALUES (?,?,?,?,?,?) ON CONFLICT(pubkey,role,branchId) DO UPDATE SET active=1,changedAt=excluded.changedAt,changedBy=excluded.changedBy').run(application.pubkey, 'mentor', request.branchId, 1, now(), actor);
      }
      const state = action === 'approve' ? 'approved' : 'rejected';
      db.prepare('UPDATE mentor_applications SET state=?,reviewedAt=?,reviewer=? WHERE id=?').run(state, now(), actor, application.id);
      audit(actor, `application.${state}`, application.id, { pubkey: application.pubkey, branchId: request.branchId ?? null }); return { state };
    }
    if (action === 'role-update') {
      root(actor); only(request, ['npub', 'role', 'branchId', 'active']);
      const target = keyOf(request.npub); requireBranch(request.branchId);
      if (!Object.hasOwn(rolePermissions, request.role) || typeof request.active !== 'boolean') throw new NetworkError('Choose a supported role and active state. The super-admin cannot be delegated here.', 400);
      if (!identities.resolve(target)) throw new NetworkError('The recipient must first connect with an active verified key.', 400);
      db.prepare(`UPDATE custody_roles SET active=0,changedAt=?,changedBy=?
        WHERE role=? AND branchId=? AND pubkey IN
        (SELECT pubkey FROM network_identity_keys WHERE personId=?)`).run(now(), actor, request.role, request.branchId, identities.resolve(target));
      db.prepare('INSERT INTO custody_roles VALUES (?,?,?,?,?,?) ON CONFLICT(pubkey,role,branchId) DO UPDATE SET active=excluded.active,changedAt=excluded.changedAt,changedBy=excluded.changedBy').run(target, request.role, request.branchId, Number(request.active), now(), actor);
      if (!request.active) {
        for (const table of ['mentor_sessions','mentor_content_sessions']) db.prepare(`DELETE FROM ${table} WHERE pubkey IN (SELECT pubkey FROM network_identity_keys WHERE personId=?)`).run(identities.resolve(target));
        db.prepare('DELETE FROM mentor_challenges WHERE pubkey IN (SELECT pubkey FROM network_identity_keys WHERE personId=?)').run(identities.resolve(target));
      }
      audit(actor, request.active ? 'role.granted' : 'role.revoked', target, { role: request.role, branchId: request.branchId }); return { updated: true };
    }
    if (action === 'issue-invite') {
      only(request, ['branchId', 'locale']); const branch = requireBranch(request.branchId);
      if (!permit(actor, 'invitations.create.own', branch.id) || !['en', 'pl'].includes(request.locale)) throw new NetworkError('You cannot create an invitation for this branch.');
      if (db.prepare('SELECT COUNT(*) AS n FROM mentor_invite_attribution WHERE mentorPubkey=? AND createdAt>?').get(actor, now() - 3600000).n >= 30) throw new NetworkError('Invitation limit reached. Try again later.', 429);
      const token = randomBytes(32).toString('base64url'), tokenHash = hash(token), expiresAt = now() + 86400000;
      db.prepare('INSERT INTO invitations (tokenHash,expiresAt) VALUES (?,?)').run(tokenHash, expiresAt);
      db.prepare('INSERT INTO mentor_invite_attribution VALUES (?,?,?,?,?)').run(tokenHash, actor, branch.id, branch.name, now());
      audit(actor, 'invitation.created', tokenHash, { branchId: branch.id });
      return { url: `${origin}/payment/?lang=${request.locale}#invite=${token}`, expiresAt };
    }
    if (action === 'sales') {
      only(request, ['branchId']); const assignments = roles(actor);
      let filter = '', parameters = [];
      if (request.branchId) requireBranch(request.branchId);
      if (actor === superAdmin) {
        if (request.branchId) { filter = 'AND a.branchId=?'; parameters.push(request.branchId); }
      } else {
        const managerBranches = assignments.filter(role => rolePermissions[role.role]?.includes('sales.read.branch')).map(role => role.branchId);
        const ownBranches = assignments.filter(role => rolePermissions[role.role]?.includes('sales.read.own')).map(role => role.branchId);
        if (!managerBranches.length && !ownBranches.length) throw new NetworkError('Sales access is unavailable for this account.');
        const placeholders = values => values.map(() => '?').join(',');
        const clauses = [];
        if (managerBranches.length) { clauses.push(`a.branchId IN (${placeholders(managerBranches)})`); parameters.push(...managerBranches); }
        if (ownBranches.length) { const keys = ownKeys(actor); clauses.push(`(a.mentorPubkey IN (${placeholders(keys)}) AND a.branchId IN (${placeholders(ownBranches)}))`); parameters.push(...keys, ...ownBranches); }
        filter = `AND (${clauses.join(' OR ')})`;
        if (request.branchId) {
          if (![...managerBranches, ...ownBranches].includes(request.branchId)) throw new NetworkError('This branch is outside your sales scope.');
          filter += ' AND a.branchId=?'; parameters.push(request.branchId);
        }
      }
      const totals = db.prepare(`SELECT a.mentorPubkey,a.branchId,a.branchName,b.provider,b.settledRail,b.priceCurrency AS currency,COUNT(*) AS count,SUM(b.priceMinorUnits) AS minorUnits,SUM(b.settledSats) AS sats,COUNT(b.settledSats) AS satsCount FROM bookings b LEFT JOIN mentor_booking_attribution a ON a.reference=b.reference WHERE b.state='confirmed' AND b.paymentId IS NOT NULL ${filter} GROUP BY a.mentorPubkey,a.branchId,a.branchName,b.provider,b.settledRail,b.priceCurrency ORDER BY a.branchId,a.mentorPubkey,b.priceCurrency`).all(...parameters);
      return { totals, basis: 'Confirmed booking amounts by original currency; not net revenue. Refund and fee reconciliation is not included.', unassignedIncluded: actor === superAdmin && !request.branchId };
    }
    throw new NetworkError('Unknown network action.', 400);
  }
  const eventFor = row => ({ kind: 27235, created_at: Math.floor(row.createdAt / 1000), content: '', tags: [
    ['u', endpoint], ['method', 'POST'], ['payload', hash(JSON.stringify({ purpose: row.purpose, request: JSON.parse(row.requestJson) }))], ['challenge', row.nonce],
  ] });
  return {
    isSuperAdmin(pubkey) { return pubkey === superAdmin && !!identities.resolve(pubkey); },
    contentBranches(pubkey) { return roles(pubkey).filter(r => r.role === 'editor').map(r => r.branchId); },
    requireContentSession(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NetworkError('Reconnect to edit articles.', 401);
      const row = db.prepare('SELECT pubkey FROM mentor_content_sessions WHERE tokenHash=? AND expiresAt>?').get(hash(token), now());
      if (!row || !identities.resolve(row.pubkey) || (row.pubkey !== superAdmin && !roles(row.pubkey).some(r => r.role === 'editor'))) throw new NetworkError('Your content session ended or access was revoked.', 401);
      return row.pubkey;
    },
    endContentSession(token) { if (typeof token === 'string') db.prepare('DELETE FROM mentor_content_sessions WHERE tokenHash=?').run(hash(token)); },
    readSession({ token, purpose, request = {} }) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NetworkError('Connect your Nostr signer again.', 401);
      const session = db.prepare('SELECT pubkey FROM mentor_sessions WHERE tokenHash=? AND expiresAt>?').get(hash(token), now());
      if (!session || !identities.resolve(session.pubkey)) throw new NetworkError('Your session expired or key was retired.', 401);
      if (!['my-status', 'applications', 'branches', 'sales', 'content-assignments'].includes(purpose)) throw new NetworkError('This action requires a fresh signature.');
      return dispatch(session.pubkey, purpose, request);
    },
    endSession(token) {
      if (typeof token === 'string') db.prepare('DELETE FROM mentor_sessions WHERE tokenHash=?').run(hash(token));
    },
    capabilities(pubkey) { return pubkey === superAdmin ? { superAdmin: true, roles: [] } : { superAdmin: false, roles: roles(pubkey) }; },
    challenge({ npub, purpose, request = {} }) {
      const pubkey = keyOf(npub), time = now();
      if (!actions.has(purpose)) throw new NetworkError('Unknown network action.', 400);
      if (!['session-start', 'apply', 'my-status'].includes(purpose) && pubkey !== superAdmin && !roles(pubkey).length) throw new NetworkError('This npub does not have network access.');
      const requestJson = JSON.stringify(request);
      if (requestJson.length > 8000 || !request || typeof request !== 'object' || Array.isArray(request)) throw new NetworkError('Application or request is too large.', 400);
      db.prepare('DELETE FROM mentor_challenges WHERE expiresAt<=?').run(time);
      if (db.prepare('SELECT COUNT(*) AS n FROM mentor_challenges').get().n >= 1000 || db.prepare('SELECT COUNT(*) AS n FROM mentor_challenges WHERE pubkey=?').get(pubkey).n >= 5) throw new NetworkError('Too many pending requests. Try again shortly.', 429);
      const row = { nonce: randomBytes(32).toString('base64url'), pubkey, purpose, requestJson, createdAt: time, expiresAt: time + 60000 };
      db.prepare('INSERT INTO mentor_challenges VALUES (?,?,?,?,?,?)').run(row.nonce, pubkey, purpose, requestJson, time, row.expiresAt);
      return { event: eventFor(row) };
    },
    execute({ event }) {
      const nonce = event?.tags?.find(tag => Array.isArray(tag) && tag[0] === 'challenge')?.[1];
      if (typeof nonce !== 'string' || nonce.length !== 43) throw new NetworkError('Invalid signing challenge.');
      const row = db.prepare('SELECT * FROM mentor_challenges WHERE nonce=?').get(nonce);
      if (!row || row.expiresAt <= now() || row.pubkey !== event.pubkey) throw new NetworkError('Signing request expired or was already used.');
      const expected = eventFor(row);
      if (event.kind !== expected.kind || event.created_at !== expected.created_at || event.content !== '' || JSON.stringify(event.tags) !== JSON.stringify(expected.tags)) throw new NetworkError('Signing request does not match this action.');
      let valid = false;
      try { valid = verifyEvent({ id: event.id, pubkey: event.pubkey, sig: event.sig, ...expected }); } catch {}
      if (!valid) throw new NetworkError('The Nostr signature could not be verified.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('DELETE FROM mentor_challenges WHERE nonce=?').run(nonce).changes !== 1) throw new NetworkError('Signing request was already used.');
        try { identities.registerVerifiedKey(row.pubkey); }
        catch { throw new NetworkError('This identity key is retired or unavailable.'); }
        const result = dispatch(row.pubkey, row.purpose, JSON.parse(row.requestJson));
        db.exec('COMMIT'); return result;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    // Called only by the booking service when it binds an invitation to a booking.
    // The browser cannot submit or change attribution through execute().
    attributeBooking(reference, tokenHash) {
      const invite = db.prepare('SELECT * FROM mentor_invite_attribution WHERE tokenHash=?').get(tokenHash);
      if (!invite) return;
      const existing = db.prepare('SELECT * FROM mentor_booking_attribution WHERE reference=?').get(reference);
      if (existing) {
        if (existing.mentorPubkey !== invite.mentorPubkey || existing.branchId !== invite.branchId) throw new NetworkError('Booking attribution conflicts with the original invitation.');
        return;
      }
      db.prepare('INSERT INTO mentor_booking_attribution VALUES (?,?,?,?,?)').run(reference, invite.mentorPubkey, invite.branchId, invite.branchName, now());
    },
  };
}
