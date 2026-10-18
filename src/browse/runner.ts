import { randomUUID } from 'node:crypto';
import { decimalId, PilotError, safeError } from '../pilot/contracts.js';
import { BROWSE_LIMITS, keywordOf, type BrowsePort, type BrowseRun } from './contracts.js';
import { BrowseStore } from './store.js';

export class BrowseRunner {
  private controller: AbortController | null = null;
  constructor(private readonly store: BrowseStore, private readonly platform: BrowsePort, private readonly now = Date.now) {}
  get busy(): boolean { return this.controller !== null; }
  stop(): void { this.controller?.abort(); }
  async start(keyword: string, expectedAccount: string, ownerUid: string, signal: AbortSignal): Promise<BrowseRun> {
    keyword = keywordOf(keyword); decimalId(expectedAccount); decimalId(ownerUid);
    if (expectedAccount === '0' || ownerUid === '0' || ownerUid === expectedAccount) throw new PilotError('BOT_EQUALS_OWNER');
    if (this.busy) throw new PilotError('RUN_BUSY');
    const last = this.store.latest();
    if (last && this.now() - last.startedAt < BROWSE_LIMITS.cooldownMs) throw new PilotError('BROWSE_COOLDOWN');
    signal.throwIfAborted();
    const controller = new AbortController(); this.controller = controller;
    const deadline = this.now() + BROWSE_LIMITS.durationMs;
    const timeout = AbortSignal.timeout(BROWSE_LIMITS.durationMs);
    const combined = AbortSignal.any([signal, controller.signal, timeout]);
    const check = () => { combined.throwIfAborted(); if (this.now() >= deadline) throw new PilotError('BROWSE_DEADLINE'); };
    const run: BrowseRun = { id: randomUUID(), accountUid: expectedAccount, keyword, startedAt: this.now(), finishedAt: null, state: 'running', reason: '', pages: 0, read: 0, items: [] };
    try {
      this.store.save(run);
      check(); const account = await this.platform.account(combined); check();
      if (account.uid !== expectedAccount) throw new PilotError('ACCOUNT_CHANGED');
      const visited = new Set<string>();
      for (let page = 1; page <= BROWSE_LIMITS.pages; page++) {
        check(); const results = await this.platform.search(keyword, page, combined); check();
        run.pages++; this.store.save(run);
        for (const candidate of results.videos.slice(0, BROWSE_LIMITS.pageSize)) {
          check();
          if (visited.has(candidate.bvid)) continue;
          visited.add(candidate.bvid);
          if (this.store.seen(account.uid, candidate.bvid)) { run.items.push({ bvid: candidate.bvid, title: candidate.title, state: 'seen', reason: 'RECENTLY_READ' }); continue; }
          if (run.read >= BROWSE_LIMITS.videos) { run.items.push({ bvid: candidate.bvid, title: candidate.title, state: 'deferred', reason: 'BATCH_LIMIT' }); continue; }
          run.read++; this.store.save(run); // Failed attempts also count toward this batch's read cap.
          const video = await this.platform.read(candidate.bvid, combined); check();
          if (video.bvid !== candidate.bvid || video.aid !== candidate.aid || video.visual) throw new PilotError('BROWSE_MATERIAL_MISMATCH');
          const subtitle = video.subtitle?.trim().slice(0, 20_000) || null;
          const state = subtitle ? 'subtitle' : 'no-subtitle';
          run.items.push({ bvid: video.bvid, title: video.title, state, reason: subtitle ? 'SUBTITLE_FETCHED_NOT_ANALYZED' : 'NO_SUBTITLE' });
          this.store.record({ accountUid: account.uid, bvid: video.bvid, aid: video.aid, title: video.title, author: candidate.author, subtitle, truncated: (video.subtitle?.length ?? 0) >= 20_000, state, at: this.now() }, run);
        }
        this.store.save(run);
        if (!results.hasMore || run.read >= BROWSE_LIMITS.videos) break;
      }
      check(); run.state = 'completed'; run.reason = 'BATCH_COMPLETE';
    } catch (error) {
      run.state = combined.aborted || safeError(error) === 'BROWSE_DEADLINE' ? 'cancelled' : 'failed';
      run.reason = controller.signal.aborted ? 'OWNER_STOPPED' : signal.aborted ? 'CANCELLED' : timeout.aborted ? 'BROWSE_DEADLINE' : safeError(error);
    } finally {
      run.finishedAt = this.now();
      try { this.store.save(run); } finally { this.controller = null; }
    }
    return run;
  }
}
