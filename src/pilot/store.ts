import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LIMITS, PilotError, type PilotConfig, type Purpose, type SendTarget, type Visibility } from './contracts.js';

export interface Run { id: string; accountUid: string; config: PilotConfig; startedAt: number; deadline: number; state: string; reason: string; root: string }
export interface Action { id: string; runId: string; eventId: string; kind: 'comment' | 'reply'; target: SendTarget; text: string;
  state: string; remoteId: string; selfVisible: boolean | null; publicVisible: boolean | null; reason: string }
export class PilotStore {
  readonly db: DatabaseSync;
  private readonly token = randomUUID();
  private closed = false;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try {
      this.db.exec(`PRAGMA busy_timeout=1000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS pilot_writer(id INTEGER PRIMARY KEY CHECK(id=1),pid INTEGER NOT NULL,token TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pilot_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pilot_requests(id TEXT PRIMARY KEY,purpose TEXT NOT NULL,at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS pilot_runs(id TEXT PRIMARY KEY,body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pilot_actions(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,event_id TEXT NOT NULL,body TEXT NOT NULL,UNIQUE(run_id,event_id));
        CREATE TABLE IF NOT EXISTS pilot_events(run_id TEXT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(run_id,event_id));`);
      // Stale-owner recovery and acquisition share one database write transaction.
      // A PID that is live, inaccessible or reused is treated as still owning the store.
      this.transaction(() => {
        const writer = this.db.prepare('SELECT pid FROM pilot_writer WHERE id=1').get();
        if (writer) {
          const pid = Number(writer.pid);
          if (!Number.isSafeInteger(pid) || pid <= 0) throw new PilotError('STORE_LOCKED');
          try { process.kill(pid, 0); throw new PilotError('STORE_LOCKED'); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw new PilotError('STORE_LOCKED'); }
        }
        this.db.prepare('INSERT INTO pilot_writer VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET pid=excluded.pid,token=excluded.token').run(process.pid, this.token);
      });
      for (const run of this.runs()) if (['starting', 'running'].includes(run.state)) this.saveRun({ ...run, state: 'interrupted', reason: 'HOST_RESTARTED' });
      for (const action of this.actions()) if (action.state === 'sending') this.saveAction({ ...action, state: 'unknown', reason: 'HOST_RESTARTED' });
    } catch (error) {
      try { this.db.prepare('DELETE FROM pilot_writer WHERE token=?').run(this.token); } catch { /* Schema may not exist yet. */ }
      this.db.close(); throw error;
    }
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  get(key: string): string | null { const row = this.db.prepare('SELECT value FROM pilot_meta WHERE key=?').get(key); return row ? String(row.value) : null; }
  set(key: string, value: string): void { this.db.prepare('INSERT INTO pilot_meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  assertOwner(ownerUid: string): void { const saved = this.get('ownerUid'); if (saved && saved !== ownerUid) throw new PilotError('STORE_CONFIG_MISMATCH'); }
  bindOwner(ownerUid: string): void { if (!ownerUid) throw new PilotError('CONFIG_INCOMPLETE'); this.assertOwner(ownerUid); this.set('ownerUid', ownerUid); }
  budget(): { used: number; total: number; byPurpose: Record<Purpose, number> } {
    const byPurpose = { private: 0, public: 0, summary: 0 };
    for (const row of this.db.prepare('SELECT purpose,COUNT(*) AS n FROM pilot_requests GROUP BY purpose').all()) byPurpose[String(row.purpose) as Purpose] = Number(row.n);
    return { used: byPurpose.private + byPurpose.public + byPurpose.summary, total: LIMITS.requests, byPurpose };
  }
  reserveRequest(purpose: Purpose, now: number): string {
    return this.transaction(() => {
      const b = this.budget(); const cap = purpose === 'public' ? 3 : 1;
      if (b.used >= LIMITS.requests || b.byPurpose[purpose] >= cap) throw new PilotError('MODEL_BUDGET_EXHAUSTED');
      const id = randomUUID(); this.db.prepare('INSERT INTO pilot_requests VALUES(?,?,?)').run(id, purpose, now); return id;
    });
  }
  begin(config: PilotConfig, accountUid: string, now: number): Run {
    return this.transaction(() => {
      this.bindOwner(config.ownerUid);
      if (accountUid === config.ownerUid) throw new PilotError('BOT_EQUALS_OWNER');
      if (this.get('trialConsumed')) throw new PilotError('TRIAL_ALREADY_CONSUMED');
      const run: Run = { id: randomUUID(), accountUid, config: structuredClone(config), startedAt: now, deadline: now + LIMITS.durationMs, state: 'running', reason: '', root: '' };
      this.set('trialConsumed', run.id); this.saveRun(run); return run;
    });
  }
  runs(): Run[] { return this.db.prepare('SELECT body FROM pilot_runs ORDER BY rowid DESC').all().map(r => JSON.parse(String(r.body)) as Run); }
  run(id: string): Run { const row = this.db.prepare('SELECT body FROM pilot_runs WHERE id=?').get(id); if (!row) throw new PilotError('RUN_NOT_FOUND'); return JSON.parse(String(row.body)) as Run; }
  saveRun(run: Run): void { this.db.prepare('INSERT INTO pilot_runs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(run.id, JSON.stringify(run)); }
  seen(runId: string, id: string): boolean { return !!this.db.prepare('SELECT 1 FROM pilot_events WHERE run_id=? AND event_id=?').get(runId, id); }
  remember(runId: string, ids: string[]): void { this.transaction(() => { const stmt = this.db.prepare('INSERT OR IGNORE INTO pilot_events VALUES(?,?)'); for (const id of ids) stmt.run(runId, id); }); }
  actions(runId?: string): Action[] { return (runId ? this.db.prepare('SELECT body FROM pilot_actions WHERE run_id=? ORDER BY rowid').all(runId) : this.db.prepare('SELECT body FROM pilot_actions ORDER BY rowid').all()).map(r => JSON.parse(String(r.body)) as Action); }
  reserveAction(runId: string, eventId: string, kind: Action['kind'], target: SendTarget, text: string, now: number): Action {
    return this.transaction(() => {
      const run = this.run(runId); this.assertActive(run, now);
      if (target.bvid !== run.config.bvid || this.seen(runId, eventId)) throw new PilotError('TARGET_OR_EVENT_DENIED');
      const own = this.actions(runId);
      if (own.some(a => ['sending', 'unknown'].includes(a.state))) throw new PilotError('UNKNOWN_SEND_BLOCKS');
      if (own.filter(a => a.kind === kind).length >= (kind === 'comment' ? LIMITS.comments : LIMITS.replies)) throw new PilotError('SEND_BUDGET_EXHAUSTED');
      if (kind === 'comment' ? target.root !== '0' || target.parent !== '0' : !run.root || target.root !== run.root || target.parent !== eventId) throw new PilotError('THREAD_DENIED');
      const a: Action = { id: randomUUID(), runId, eventId, kind, target, text, state: 'sending', remoteId: '', selfVisible: null, publicVisible: null, reason: '' };
      this.db.prepare('INSERT INTO pilot_actions VALUES(?,?,?,?)').run(a.id, runId, eventId, JSON.stringify(a));
      this.db.prepare('INSERT INTO pilot_events VALUES(?,?)').run(runId, eventId); return a;
    });
  }
  assertActive(run: Run, now: number): void { if (run.state !== 'running' || now >= run.deadline) throw new PilotError('RUN_NOT_ACTIVE'); }
  saveAction(action: Action): void { this.db.prepare('UPDATE pilot_actions SET body=? WHERE id=?').run(JSON.stringify(action), action.id); }
  visibility(action: Action, status: Visibility): void { this.saveAction({ ...action, ...status }); }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.db.prepare('DELETE FROM pilot_writer WHERE token=?').run(this.token); }
    finally { this.db.close(); }
  }
}
