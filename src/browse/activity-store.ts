import { randomUUID, createHash } from 'node:crypto';
import { PilotStore } from '../pilot/store.js';
import { PilotError } from '../pilot/contracts.js';
import { browsePolicySchema, DEFAULT_BROWSE_POLICY, dayOf, type BrowsePolicy } from './policy.js';
import type { PreviewRound } from './contracts.js';
export class ActivityStore {
  constructor(private readonly pilot: PilotStore) {
    pilot.db.exec(`CREATE TABLE IF NOT EXISTS browse_previews(id TEXT PRIMARY KEY,source TEXT NOT NULL,account TEXT NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL,body TEXT NOT NULL,UNIQUE(account,kind,source));
      CREATE TABLE IF NOT EXISTS browse_picks(account TEXT NOT NULL,bvid TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(account,bvid));
      CREATE TABLE IF NOT EXISTS browse_reply_previews(account TEXT NOT NULL,root TEXT NOT NULL,uid TEXT NOT NULL,event TEXT NOT NULL,PRIMARY KEY(account,root,uid),UNIQUE(account,event));`);
    for (const r of this.all()) if (r.state === 'running') this.write({ ...r, state: 'interrupted', reason: 'HOST_RESTARTED' });
  }
  private all(): PreviewRound[] { return this.pilot.db.prepare('SELECT body FROM browse_previews ORDER BY at DESC,rowid DESC').all().map(r => JSON.parse(String(r.body))); }
  private write(r: PreviewRound): void { this.pilot.db.prepare('UPDATE browse_previews SET body=? WHERE id=?').run(JSON.stringify(r), r.id); }
  round(id: string): PreviewRound {
    const row = this.pilot.db.prepare('SELECT body FROM browse_previews WHERE id=?').get(id);
    if (!row) throw new PilotError('BROWSE_PREVIEW_MISSING'); return JSON.parse(String(row.body));
  }
  settings(): { policy: BrowsePolicy; revision: string } {
    const raw = this.pilot.get('browsePolicy');
    let policy: BrowsePolicy;
    try { policy = raw ? browsePolicySchema.parse(JSON.parse(raw)) : { ...DEFAULT_BROWSE_POLICY }; }
    catch { throw new PilotError('BROWSE_POLICY_INVALID'); }
    return { policy, revision: createHash('sha256').update(JSON.stringify(policy)).digest('hex') };
  }
  savePolicy(input: unknown, revision: string): void {
    this.pilot.transaction(() => {
      if (this.all().some(r => r.state === 'running')) throw new PilotError('RUN_BUSY');
      if (revision !== this.settings().revision) throw new PilotError('CONFIG_REVISION_CONFLICT');
      this.pilot.set('browsePolicy', JSON.stringify(browsePolicySchema.parse(input)));
    });
  }
  usage(account: string, at: number) {
    const day = dayOf(at), picked = Number(this.pilot.db.prepare('SELECT COUNT(*) n FROM browse_picks WHERE account=? AND day=?').get(account, day)!.n);
    const rounds = this.all().filter(r => r.account === account);
    return { day, picked, remaining: Math.max(0, this.settings().policy.perDay - picked),
      requests: rounds.filter(r => r.requested).length, todayRequests: rounds.filter(r => r.requested && r.day === day).length,
      latest: rounds[0] ?? null };
  }
  picked(account: string, bvid: string): boolean { return !!this.pilot.db.prepare('SELECT 1 FROM browse_picks WHERE account=? AND bvid=?').get(account, bvid); }
  replied(account: string, root: string, uid: string, event: string): boolean {
    return !!this.pilot.db.prepare('SELECT 1 FROM browse_reply_previews WHERE account=? AND ((root=? AND uid=?) OR event=?)').get(account, root, uid, event);
  }
  begin(kind: PreviewRound['kind'], source: string, account: string, at: number): PreviewRound {
    return this.pilot.transaction(() => {
      if (!/^[1-9]\d{0,24}$/.test(account) || !source || source.length > 200) throw new PilotError('BROWSE_PREVIEW_INVALID');
      if (this.all().some(r => r.state === 'running')) throw new PilotError('RUN_BUSY');
      if (this.pilot.db.prepare('SELECT 1 FROM browse_previews WHERE account=? AND kind=? AND source=?').get(account, kind, source)) throw new PilotError('BROWSE_PREVIEW_CONSUMED');
      const day = dayOf(at), last = this.pilot.get('browseLastDay');
      if (last && day < last) throw new PilotError('BROWSE_CLOCK_ROLLBACK');
      const policy = this.settings().policy, capacity = kind === 'curation' ? this.usage(account, at).remaining : policy.replyPerRound;
      if (capacity === 0) throw new PilotError('BROWSE_DAILY_LIMIT');
      const r: PreviewRound = { id: randomUUID(), kind, source, account, at, day, state: 'running', requested: false, capacity, policy, result: null, reason: '' };
      this.pilot.db.prepare('INSERT INTO browse_previews VALUES(?,?,?,?,?,?)').run(r.id, source, account, kind, at, JSON.stringify(r));
      this.pilot.set('browseLastDay', day); return r;
    });
  }
  reserveRequest(id: string): void {
    this.pilot.transaction(() => {
      const r = this.round(id);
      if (r.state !== 'running' || r.requested) throw new PilotError('BROWSE_REQUEST_CONSUMED');
      this.write({ ...r, requested: true });
    });
  }
  finish(id: string, result: unknown, picks: string[] = [], replies: { root: string; uid: string; id: string }[] = []): PreviewRound {
    return this.pilot.transaction(() => {
      const r = this.round(id);
      if (r.state !== 'running' || !r.requested) throw new PilotError('BROWSE_PREVIEW_NOT_ACTIVE');
      if ((r.kind === 'curation' && (replies.length || picks.length > r.capacity)) || (r.kind === 'replies' && (picks.length || replies.length > r.capacity))) throw new PilotError('BROWSE_LIMIT_EXCEEDED');
      for (const bvid of picks) this.pilot.db.prepare('INSERT INTO browse_picks VALUES(?,?,?)').run(r.account, bvid, r.day);
      for (const reply of replies) this.pilot.db.prepare('INSERT INTO browse_reply_previews VALUES(?,?,?,?)').run(r.account, reply.root, reply.uid, reply.id);
      const done = { ...r, state: 'completed' as const, result }; this.write(done);
      // Keep idempotency/request metadata, but bound stored model prose to 20 rounds.
      for (const old of this.all().slice(20)) if (old.result !== null) this.write({ ...old, result: null });
      return done;
    });
  }
  fail(id: string, cancelled: boolean, reason: string): void {
    const r = this.round(id); if (r.state === 'running') this.write({ ...r, state: cancelled ? 'cancelled' : 'failed', reason });
  }
}
