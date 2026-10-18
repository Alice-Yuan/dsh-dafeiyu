import { randomUUID } from 'node:crypto';
import { PilotError, LIMITS } from './contracts.js';
import { PilotStore } from './store.js';

// This ceiling bounds a single explicitly authorized batch, not a default grant.
// Production has no grant-creation endpoint until the owner chooses its policy.
export const PRIVATE_CHAT_LIMITS = Object.freeze({ maximumBatch: 20, outputTokens: LIMITS.outputTokens });
export class PrivateChatBudget {
  constructor(private readonly store: PilotStore) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS private_chat_grants(
      id TEXT PRIMARY KEY,owner_uid TEXT NOT NULL,request_limit INTEGER NOT NULL,created_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS private_chat_requests(
      id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES private_chat_grants(id),at INTEGER NOT NULL);`);
  }
  private owner(ownerUid: string): void {
    if (!/^[1-9]\d{0,24}$/.test(ownerUid)) throw new PilotError('CONFIG_INCOMPLETE');
    this.store.assertOwner(ownerUid);
  }
  status(ownerUid: string) {
    this.owner(ownerUid);
    const row = this.store.db.prepare('SELECT * FROM private_chat_grants WHERE owner_uid=? ORDER BY rowid DESC LIMIT 1').get(ownerUid);
    const lifetimeUsed = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM private_chat_requests r JOIN private_chat_grants g ON r.grant_id=g.id WHERE g.owner_uid=?').get(ownerUid)!.n);
    if (!row) return { grantId: null, limit: 0, used: 0, remaining: 0, lifetimeUsed, outputTokens: PRIVATE_CHAT_LIMITS.outputTokens, enabled: false };
    const limit = Number(row.request_limit), revoked = Number(row.revoked);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PRIVATE_CHAT_LIMITS.maximumBatch || ![0, 1].includes(revoked)) throw new PilotError('PRIVATE_CHAT_BUDGET_INVALID');
    const used = Number(this.store.db.prepare('SELECT COUNT(*) AS n FROM private_chat_requests WHERE grant_id=?').get(String(row.id))!.n);
    return { grantId: String(row.id), limit, used, remaining: revoked ? 0 : Math.max(0, limit - used), lifetimeUsed,
      outputTokens: PRIVATE_CHAT_LIMITS.outputTokens, enabled: !revoked && used < limit };
  }
  authorize(ownerUid: string, grantId: string, requests: number, now: number): void {
    this.owner(ownerUid);
    if (!/^[\w-]{1,100}$/.test(grantId) || !Number.isSafeInteger(requests) || requests < 1 || requests > PRIVATE_CHAT_LIMITS.maximumBatch || !Number.isSafeInteger(now)) throw new PilotError('PRIVATE_CHAT_GRANT_INVALID');
    this.store.transaction(() => {
      this.store.bindOwner(ownerUid);
      if (this.store.db.prepare('SELECT 1 FROM private_chat_grants WHERE id=?').get(grantId)) throw new PilotError('PRIVATE_CHAT_GRANT_EXISTS');
      if (this.status(ownerUid).remaining) throw new PilotError('PRIVATE_CHAT_GRANT_ACTIVE');
      this.store.db.prepare('INSERT INTO private_chat_grants(id,owner_uid,request_limit,created_at) VALUES(?,?,?,?)').run(grantId, ownerUid, requests, now);
    });
  }
  reserve(ownerUid: string, now: number): string {
    this.owner(ownerUid);
    return this.store.transaction(() => {
      if (this.store.get('ownerUid') !== ownerUid) throw new PilotError('STORE_CONFIG_MISMATCH');
      const budget = this.status(ownerUid);
      if (!budget.enabled || !budget.grantId) throw new PilotError('PRIVATE_CHAT_BUDGET_EXHAUSTED');
      const id = randomUUID();
      this.store.db.prepare('INSERT INTO private_chat_requests VALUES(?,?,?)').run(id, budget.grantId, now);
      return id;
    });
  }
  revoke(ownerUid: string): void {
    this.owner(ownerUid);
    this.store.transaction(() => {
      const budget = this.status(ownerUid);
      if (budget.grantId) this.store.db.prepare('UPDATE private_chat_grants SET revoked=1 WHERE id=? AND owner_uid=?').run(budget.grantId, ownerUid);
    });
  }
}
