import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { LIMITS, PilotError, type PilotConfig, type Purpose, type SendTarget, type Visibility } from './contracts.js';
import type { VideoMaterial } from './contracts.js';
import { publicVideo } from './material.js';

export type Grant = 'initial' | 'media-trial-2';
export interface Run { id: string; accountUid: string; config: PilotConfig; startedAt: number; deadline: number; state: string; reason: string; root: string; grant?: Grant }
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
  inspectionRevision(): string { const value = this.get('videoInspection'); return value ? createHash('sha256').update(value).digest('hex') : ''; }
  matchInspection(accountUid: string, video: VideoMaterial): void {
    let saved: any; try { saved = JSON.parse(this.get('videoInspection') ?? 'null'); } catch { /* Reject invalid evidence. */ }
    if (!saved || saved.accountUid !== accountUid || JSON.stringify(saved.material) !== JSON.stringify(publicVideo(video))) throw new PilotError('VIDEO_EVIDENCE_CHANGED');
  }
  recordVideoReview(revision: string, decision: 'approved' | 'rejected', note: string): void {
    this.transaction(() => {
      if (this.runs().some(r => r.state === 'running')) throw new PilotError('RUN_BUSY');
      if (!revision || revision !== this.inspectionRevision() || this.get('videoEvidenceViewed') !== revision) throw new PilotError('VIDEO_REVIEW_STALE');
      this.set('videoReview', JSON.stringify({ revision, decision, note, at: Date.now() }));
    });
  }
  assertVideoReviewed(): void {
    let review: any; try { review = JSON.parse(this.get('videoReview') ?? 'null'); } catch { /* Reject invalid review. */ }
    if (!review || review.decision !== 'approved' || !review.revision || review.revision !== this.inspectionRevision()) throw new PilotError('VIDEO_REVIEW_REQUIRED');
  }
  budget(grant: Grant = this.get('activeGrant') === 'media-trial-2' ? 'media-trial-2' : 'initial'): { used: number; total: number; byPurpose: Record<Purpose, number>; lifetimeUsed: number; grant: Grant } {
    const byPurpose = { private: 0, public: 0, summary: 0 };
    const labels = ['private', 'public', 'summary'].map(p => grant === 'initial' ? p : p + ':' + grant);
    for (const row of this.db.prepare('SELECT purpose,COUNT(*) AS n FROM pilot_requests WHERE purpose IN (?,?,?) GROUP BY purpose').all(...labels)) byPurpose[String(row.purpose).split(':')[0] as Purpose] = Number(row.n);
    const lifetimeUsed = Number(this.db.prepare('SELECT COUNT(*) AS n FROM pilot_requests').get()!.n);
    return { used: byPurpose.private + byPurpose.public + byPurpose.summary, total: grant === 'initial' ? LIMITS.requests : 4, byPurpose, lifetimeUsed, grant };
  }
  assertCalibration(revision: string): void {
    const run = this.runs().find(r => r.id === this.get('mediaTrialConsumed'));
    let review: any; try { review = JSON.parse(this.get('videoReview') ?? 'null'); } catch { /* Fail closed. */ }
    if (this.get('videoCalibrationConsumed')) throw new PilotError('VIDEO_CALIBRATION_ALREADY_CONSUMED');
    if (this.get('activeGrant') !== 'media-trial-2' || !run || run.state !== 'cancelled' || run.reason !== 'OWNER_STOPPED' ||
        this.runs().some(r => ['starting', 'running'].includes(r.state)) || !revision || revision !== this.inspectionRevision() ||
        review?.revision !== revision || review?.decision !== 'rejected') throw new PilotError('VIDEO_CALIBRATION_NOT_READY');
  }
  reserveRequest(purpose: Purpose, now: number, calibrationRevision?: string): string {
    return this.transaction(() => {
      if (calibrationRevision !== undefined) {
        if (purpose !== 'public') throw new PilotError('MODEL_REQUEST_DENIED');
        this.assertCalibration(calibrationRevision);
      }
      const b = this.budget(); const cap = purpose === 'public' ? 3 : purpose === 'private' && b.grant !== 'initial' ? 0 : 1;
      if (b.used >= b.total || b.byPurpose[purpose] >= cap || b.lifetimeUsed >= 9) throw new PilotError('MODEL_BUDGET_EXHAUSTED');
      const id = randomUUID(); this.db.prepare('INSERT INTO pilot_requests VALUES(?,?,?)').run(id, b.grant === 'initial' ? purpose : purpose + ':' + b.grant, now);
      if (calibrationRevision !== undefined) {
        this.set('videoInspectionArchive:' + calibrationRevision, JSON.stringify({ inspection: this.get('videoInspection'), review: this.get('videoReview') }));
        this.set('videoCalibrationConsumed', JSON.stringify({ requestId: id, revision: calibrationRevision, at: now, grant: b.grant }));
      }
      return id;
    });
  }
  begin(config: PilotConfig, accountUid: string, now: number, grant: Grant = 'initial'): Run {
    return this.transaction(() => {
      this.bindOwner(config.ownerUid);
      if (accountUid === config.ownerUid) throw new PilotError('BOT_EQUALS_OWNER');
      if (!['initial', 'media-trial-2'].includes(grant)) throw new PilotError('GRANT_DENIED');
      if ((grant === 'initial' && this.get('trialConsumed')) || (grant === 'media-trial-2' && this.get('mediaTrialConsumed'))) throw new PilotError('TRIAL_ALREADY_CONSUMED');
      if (grant === 'media-trial-2') {
        const previous = this.runs().find(r => r.id === this.get('trialConsumed'));
        if (!previous || previous.state !== 'completed' || previous.accountUid !== accountUid || JSON.stringify(previous.config) !== JSON.stringify(config) || !this.get('videoInspection')) throw new PilotError('MEDIA_TRIAL_NOT_READY');
        let inspection: any; try { inspection = JSON.parse(this.get('videoInspection')!); } catch { throw new PilotError('MEDIA_TRIAL_NOT_READY'); }
        if (inspection.accountUid !== accountUid || inspection.material?.bvid !== config.bvid || !inspection.analysis?.summary ||
            (!inspection.material?.visual?.frames?.length && !inspection.material?.subtitle?.trim())) throw new PilotError('MEDIA_TRIAL_NOT_READY');
        this.assertVideoReviewed();
        if (this.actions().some(a => ['sending', 'unknown'].includes(a.state))) throw new PilotError('UNKNOWN_SEND_BLOCKS');
        if (this.get('latestReport')) this.set('report:' + previous.id, this.get('latestReport')!);
        this.set('activeGrant', grant);
      }
      const run: Run = { id: randomUUID(), accountUid, config: structuredClone(config), startedAt: now, deadline: now + LIMITS.durationMs, state: 'running', reason: '', root: '', grant };
      this.set(grant === 'initial' ? 'trialConsumed' : 'mediaTrialConsumed', run.id); this.saveRun(run); return run;
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
