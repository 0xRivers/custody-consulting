import { randomUUID } from 'node:crypto';

// Internal persistence boundary only. Never expose these methods as HTTP actions.
// Callers must verify fresh signing proofs and authorize mutations before calling.
export const presets = Object.freeze({
  mentor: Object.freeze(['sales.read.own', 'invitations.create.own']),
  editor: Object.freeze(['content.draft']),
});
const validKey = key => typeof key === 'string' && /^[0-9a-f]{64}$/.test(key);
export function createIdentityStore({ db, now = Date.now }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_people (id TEXT PRIMARY KEY, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS network_identity_keys (
      pubkey TEXT PRIMARY KEY, personId TEXT NOT NULL REFERENCES network_people(id),
      activatedAt INTEGER NOT NULL, retiredAt INTEGER);
    CREATE TABLE IF NOT EXISTS network_identity_audit (
      id TEXT PRIMARY KEY, actorPersonId TEXT NOT NULL, signingKey TEXT NOT NULL,
      action TEXT NOT NULL, subjectId TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS network_identity_audit_update BEFORE UPDATE ON network_identity_audit
      BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS network_identity_audit_delete BEFORE DELETE ON network_identity_audit
      BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
  `);
  function transaction(fn) {
    db.exec('SAVEPOINT identity_change');
    try { const result = fn(); db.exec('RELEASE identity_change'); return result; }
    catch (error) { db.exec('ROLLBACK TO identity_change'); db.exec('RELEASE identity_change'); throw error; }
  }
  function resolve(pubkey) {
    if (!validKey(pubkey)) return null;
    return db.prepare('SELECT personId FROM network_identity_keys WHERE pubkey=? AND retiredAt IS NULL AND activatedAt<=?').get(pubkey, now())?.personId ?? null;
  }
  function actor(key) {
    const id = resolve(key);
    if (!id) throw new Error('Actor key is inactive or unknown');
    return id;
  }
  function audit(key, action, subjectId) {
    db.prepare('INSERT INTO network_identity_audit VALUES (?,?,?,?,?,?)').run(randomUUID(), actor(key), key, action, subjectId, now());
  }
  function person(id) {
    if (!db.prepare('SELECT id FROM network_people WHERE id=?').get(id)) throw new Error('Unknown person');
  }
  return {
    resolve,
    // Requires a verified enrollment proof. Registration grants no permissions.
    registerVerifiedKey(pubkey) {
      if (!validKey(pubkey)) throw new Error('Invalid public key');
      const existing = db.prepare('SELECT personId,retiredAt FROM network_identity_keys WHERE pubkey=?').get(pubkey);
      if (existing) {
        if (existing.retiredAt !== null) throw new Error('Retired key cannot be registered again');
        return existing.personId;
      }
      return transaction(() => {
        const id = randomUUID(), time = now();
        db.prepare('INSERT INTO network_people VALUES (?,?)').run(id, time);
        db.prepare('INSERT INTO network_identity_keys VALUES (?,?,?,NULL)').run(pubkey, id, time);
        audit(pubkey, 'identity.registered', id);
        return id;
      });
    },
    // Requires verified old/new proofs or a separately authorized recovery ceremony.
    // Business root rotation must use its dedicated recovery policy, not a generic UI.
    replaceVerifiedKey({ signingKey, personId, oldKey, newKey }) {
      if (!validKey(newKey) || resolve(oldKey) !== personId) throw new Error('Invalid key replacement');
      person(personId);
      return transaction(() => {
        audit(signingKey, 'identity.key-replaced', personId);
        db.prepare('INSERT INTO network_identity_keys VALUES (?,?,?,NULL)').run(newKey, personId, now());
        db.prepare('UPDATE network_identity_keys SET retiredAt=? WHERE pubkey=?').run(now(), oldKey);
        return personId;
      });
    },
  };
}
