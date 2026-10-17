import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DomainError, assertId, type Audience, type Memory, type Outcome } from '../core/contracts.js';

export type OutboxState = 'pending' | 'sending' | 'accepted' | 'unknown' | 'cancelled';
export class SqliteStore {
  readonly path: string;
  private db!: DatabaseSync;
  private lockFd: number | undefined;
  private closed = false;
  constructor(path: string, ownerUid: string, maxCalls: number) {
    assertId(ownerUid);
    if (!Number.isSafeInteger(maxCalls) || maxCalls < 1) throw new DomainError('INVALID_LIMITS');
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    try { this.lockFd = openSync(this.path + '.lock', 'wx'); }
    catch { throw new DomainError('STORE_LOCKED'); }
    try {
      this.db = new DatabaseSync(this.path);
      this.db.exec(`
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=FULL;
        PRAGMA busy_timeout=1000;
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS watches (
          project TEXT PRIMARY KEY, revision TEXT, source TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS inbox (
          id TEXT PRIMARY KEY, status TEXT NOT NULL, source TEXT NOT NULL,
          scope TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '');
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY, event_id TEXT NOT NULL, project TEXT NOT NULL,
          revision TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL,
          receipt TEXT, scope TEXT NOT NULL CHECK(scope='owner_private'));
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY, scope TEXT NOT NULL, platform TEXT NOT NULL,
          text TEXT NOT NULL, source TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL,
          action TEXT NOT NULL, result TEXT NOT NULL);
      `);
      this.transaction(() => {
        for (const [key, expected] of Object.entries({
          schema: '1', owner: ownerUid, maxCalls: String(maxCalls),
        })) {
          const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);
          if (row && row.value !== expected) throw new DomainError('STORE_CONFIG_MISMATCH');
          this.db.prepare('INSERT OR IGNORE INTO meta VALUES (?,?)').run(key, expected);
        }
        this.db.prepare("INSERT OR IGNORE INTO meta VALUES ('calls','0')").run();
        // Crash leftovers never auto-send or auto-retry.
        this.db.exec("UPDATE outbox SET state='unknown' WHERE state IN ('sending','pending')");
        this.db.exec("UPDATE inbox SET status='unknown', reason='restart_requires_review' WHERE status='processing'");
      });
    } catch (error) {
      this.db?.close(); this.releaseLock(); throw error;
    }
  }
  transaction<T>(fn: () => T): T {
    if (this.closed) throw new DomainError('STORE_CLOSED');
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  begin(id: string, source: string, scope: string): boolean {
    return Number(this.db.prepare(
      "INSERT OR IGNORE INTO inbox (id,status,source,scope) VALUES (?,'processing',?,?)",
    ).run(id, source, scope).changes) === 1;
  }
  finish(id: string, status: Outcome['status'], reason = ''): void {
    this.transaction(() => {
      this.db.prepare('UPDATE inbox SET status=?,reason=? WHERE id=?').run(status, reason, id);
      this.db.prepare('INSERT INTO audit(event_id,action,result) VALUES (?,?,?)').run(id, 'finish', status);
    });
  }
  watch(project: string, source: string): void {
    this.db.prepare('INSERT OR IGNORE INTO watches(project,source) VALUES (?,?)').run(project, source);
  }
  watched(project: string): { revision: string | null } | undefined {
    return this.db.prepare('SELECT revision FROM watches WHERE project=?').get(project) as
      { revision: string | null } | undefined;
  }
  get maxCalls(): number {
    return Number(this.db.prepare("SELECT value FROM meta WHERE key='maxCalls'").get()!.value);
  }
  get ownerUid(): string {
    return String(this.db.prepare("SELECT value FROM meta WHERE key='owner'").get()!.value);
  }
  get calls(): number {
    return Number(this.db.prepare("SELECT value FROM meta WHERE key='calls'").get()!.value);
  }
  reserve(calls: number): boolean {
    return this.transaction(() => {
      const limit = Number(this.db.prepare("SELECT value FROM meta WHERE key='maxCalls'").get()!.value);
      if (this.calls + calls > limit) return false;
      this.db.prepare("UPDATE meta SET value=? WHERE key='calls'").run(String(this.calls + calls));
      return true;
    });
  }
  settle(reserved: number, actual: number): void {
    this.db.prepare("UPDATE meta SET value=? WHERE key='calls'").run(String(this.calls - reserved + actual));
  }
  prepare(id: string, eventId: string, project: string, revision: string, body: string): void {
    this.db.prepare(`INSERT INTO outbox(id,event_id,project,revision,body,state,scope)
      VALUES (?,?,?,?,?,'pending','owner_private')`).run(id, eventId, project, revision, body);
  }
  markSending(id: string): void {
    this.db.prepare("UPDATE outbox SET state='sending' WHERE id=? AND state='pending'").run(id);
  }
  markUnknown(id: string): void {
    this.db.prepare("UPDATE outbox SET state='unknown' WHERE id=? AND state!='accepted'").run(id);
  }
  cancelPending(id: string): void {
    this.db.prepare("UPDATE outbox SET state='cancelled' WHERE id=? AND state='pending'").run(id);
  }
  accept(id: string, receipt: string): void {
    this.transaction(() => {
      const row = this.db.prepare('SELECT project,revision,event_id FROM outbox WHERE id=?').get(id)!;
      this.db.prepare("UPDATE outbox SET state='accepted',receipt=? WHERE id=?").run(receipt, id);
      this.db.prepare('UPDATE watches SET revision=? WHERE project=?').run(row.revision!, row.project!);
      this.db.prepare("UPDATE inbox SET status='notified' WHERE id=?").run(row.event_id!);
      this.db.prepare('INSERT INTO audit(event_id,action,result) VALUES (?,?,?)')
        .run(row.event_id!, 'simulated_delivery', 'accepted');
    });
  }
  hasUnresolved(): boolean {
    return !!this.db.prepare("SELECT 1 FROM outbox WHERE state IN ('pending','sending','unknown') LIMIT 1").get();
  }
  putFixtureMemory(memory: Memory): void {
    this.db.prepare('INSERT INTO memories VALUES (?,?,?,?,?)')
      .run(memory.id, memory.scope, memory.platform, memory.text, memory.source);
  }
  retrieve(audience: Audience, platform: string): Memory[] {
    if (audience !== 'owner' && audience !== 'public') throw new DomainError('INVALID_AUDIENCE');
    // Filtering is in SQL, before rows are supplied to the model.
    const query = audience === 'public'
      ? "SELECT * FROM memories WHERE scope='public_persona' OR (scope='public_episode' AND platform=?)"
      : "SELECT * FROM memories WHERE scope IN ('owner_private','public_persona') OR (scope='public_episode' AND platform=?)";
    return this.db.prepare(query).all(platform) as unknown as Memory[];
  }
  snapshot(): { calls: number; inbox: unknown[]; outbox: unknown[]; audit: unknown[] } {
    return {
      calls: this.calls,
      inbox: this.db.prepare('SELECT * FROM inbox ORDER BY id').all(),
      outbox: this.db.prepare('SELECT * FROM outbox ORDER BY id').all(),
      audit: this.db.prepare('SELECT * FROM audit ORDER BY seq').all(),
    };
  }
  private releaseLock(): void {
    if (this.lockFd !== undefined) {
      closeSync(this.lockFd); this.lockFd = undefined; unlinkSync(this.path + '.lock');
    }
  }
  close(): void {
    if (this.closed) return;
    this.db.close(); this.closed = true; this.releaseLock();
  }
}
