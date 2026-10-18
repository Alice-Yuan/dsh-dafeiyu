import { PilotStore } from '../pilot/store.js';
import { BROWSE_LIMITS, type BrowseRun, type Reading } from './contracts.js';

export class BrowseStore {
  constructor(private readonly pilot: PilotStore) {
    pilot.db.exec(`CREATE TABLE IF NOT EXISTS browse_runs(id TEXT PRIMARY KEY, at INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS browse_readings(account TEXT NOT NULL,bvid TEXT NOT NULL,at INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(account,bvid));`);
    // Host reload records interruption. No task is scheduled or resumed.
    for (const row of pilot.db.prepare('SELECT body FROM browse_runs').all()) {
      const run = JSON.parse(String(row.body)) as BrowseRun;
      if (run.state === 'running') this.save({ ...run, state: 'interrupted', reason: 'HOST_RESTARTED', finishedAt: Date.now() });
    }
  }
  latest(): BrowseRun | null {
    const row = this.pilot.db.prepare('SELECT body FROM browse_runs ORDER BY at DESC,rowid DESC LIMIT 1').get();
    return row ? JSON.parse(String(row.body)) as BrowseRun : null;
  }
  run(id: string): BrowseRun | null {
    const row = this.pilot.db.prepare('SELECT body FROM browse_runs WHERE id=?').get(id);
    return row ? JSON.parse(String(row.body)) as BrowseRun : null;
  }
  reading(account: string, bvid: string): Reading | null {
    const row = this.pilot.db.prepare('SELECT body FROM browse_readings WHERE account=? AND bvid=?').get(account, bvid);
    return row ? JSON.parse(String(row.body)) as Reading : null;
  }
  save(run: BrowseRun): void {
    this.pilot.transaction(() => {
      this.pilot.db.prepare('INSERT INTO browse_runs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(run.id, run.startedAt, JSON.stringify(run));
      this.pilot.db.prepare('DELETE FROM browse_runs WHERE id NOT IN (SELECT id FROM browse_runs ORDER BY at DESC,rowid DESC LIMIT ?)').run(BROWSE_LIMITS.runs);
    });
  }
  seen(account: string, bvid: string): boolean { return !!this.pilot.db.prepare('SELECT 1 FROM browse_readings WHERE account=? AND bvid=?').get(account, bvid); }
  record(reading: Reading, run: BrowseRun): void {
    this.pilot.transaction(() => {
      this.pilot.db.prepare('INSERT INTO browse_readings VALUES(?,?,?,?) ON CONFLICT(account,bvid) DO UPDATE SET at=excluded.at,body=excluded.body').run(reading.accountUid, reading.bvid, reading.at, JSON.stringify(reading));
      this.pilot.db.prepare('DELETE FROM browse_readings WHERE rowid NOT IN (SELECT rowid FROM browse_readings ORDER BY at DESC,rowid DESC LIMIT ?)').run(BROWSE_LIMITS.history);
      this.pilot.db.prepare('UPDATE browse_runs SET body=? WHERE id=?').run(JSON.stringify(run), run.id);
    });
  }
  history(): Reading[] { return this.pilot.db.prepare('SELECT body FROM browse_readings ORDER BY at DESC,rowid DESC LIMIT 10').all().map(row => JSON.parse(String(row.body)) as Reading); }
}
