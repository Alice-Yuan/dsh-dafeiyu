import { type Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { configOf, DEFAULT_PERSONA, LIMITS, PilotError, safeError, type PilotConfig } from '../pilot/contracts.js';
import { PilotStore } from '../pilot/store.js';
import { PilotRunner } from '../pilot/runner.js';
import { Bilibili } from '../platform/bilibili.js';
import { WindowsVault } from '../platform/vault.js';
import { HostModel, type ModelHost, type PolicyContext } from './model.js';
import { REQUESTS, type Method } from '../shared/remote.js';
import { FfmpegMediaReader, findDecoder } from '../platform/media.js';
import { publicVideo, MEDIA_INSTRUCTION } from '../pilot/material.js';
import { isOwnerVideoRequest } from '../pilot/owner-request.js';
import { BrowseRunner } from '../browse/runner.js';
import { BrowseStore } from '../browse/store.js';
import { ActivityStore } from '../browse/activity-store.js';
import { Curator } from '../browse/curation.js';

interface Ref<T> { get(): T }
type LiveConfig = { [K in keyof PilotConfig]: Ref<PilotConfig[K]> };
interface HostContext extends Context {
  profileContext: { dir: string };
  configEditor: { edit(entry: unknown, change: (current: Record<string, unknown>) => unknown): Promise<void> };
}
export const name = 'dafeyu';
export const inject = ['profileContext', 'configEditor', 'agents', 'agentDefaultModel', 'agentPresets', 'typert', 'llm', 'attachments'];
export const Config = s.object({
  ownerUid: s.string().pattern(/^(|[1-9]\d{0,24})$/).default('').volatile(),
  bvid: s.string().pattern(/^(|BV[1-9A-HJ-NP-Za-km-z]{10})$/).default('').volatile(),
  persona: s.string().min(1).max(2000).default(DEFAULT_PERSONA).volatile(),
  diagnosticMarker: s.string().pattern(/^[\w .:-]{0,80}$/).default('').volatile(),
});
export class DaFeiYuControl extends TypertRemoteService {
  private storeValue: PilotStore | null = null;
  private modelValue: HostModel | null = null;
  private runnerValue: PilotRunner | null = null;
  private platformValue: Bilibili | null = null;
  private browseStoreValue: BrowseStore | null = null;
  private browseRunnerValue: BrowseRunner | null = null;
  private activityValue: ActivityStore | null = null;
  private curatorValue: Curator | null = null;
  private previewController: AbortController | null = null;
  private mediaController: AbortController | null = null;
  private readonly lifetime = new AbortController();
  private serial: Promise<unknown> = Promise.resolve();
  private exclusiveActive = false;
  private operations = new Set<Promise<unknown>>();
  private decoderCheck: { at: number; available: boolean } | null = null;
  constructor(private readonly owner: HostContext, private readonly live: LiveConfig) {
    super(owner, 'dafeyuControl', { namespace: 'dafeyu' });
    owner.effect(() => () => this.shutdown());
  }
  currentConfig(): PilotConfig {
    return configOf({ ownerUid: this.live.ownerUid.get(), bvid: this.live.bvid.get(), persona: this.live.persona.get(), diagnosticMarker: this.live.diagnosticMarker.get() });
  }
  private revision(): string { return createHash('sha256').update(JSON.stringify(this.currentConfig())).digest('hex'); }
  private store(): PilotStore {
    if (!this.storeValue) this.storeValue = new PilotStore(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'pilot.sqlite'));
    return this.storeValue;
  }
  private platform(): Bilibili {
    return this.platformValue ??= new Bilibili(new WindowsVault(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'bilibili.dpapi')), fetch, Date.now,
      new FfmpegMediaReader(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'media-temp')));
  }
  private model(): HostModel { return this.modelValue ??= new HostModel(this.owner as unknown as ModelHost, () => this.store(), () => this.currentConfig()); }
  private runner(): PilotRunner { return this.runnerValue ??= new PilotRunner(this.store(), this.platform(), this.model(), () => this.currentConfig()); }
  private browseStore(): BrowseStore { return this.browseStoreValue ??= new BrowseStore(this.store()); }
  private activity(): ActivityStore { return this.activityValue ??= new ActivityStore(this.store()); }
  private curator(): Curator { return this.curatorValue ??= new Curator(this.browseStore(), this.activity(), (prompt, signal, reserve) => this.model().preview(prompt, signal, reserve)); }
  private browser(): BrowseRunner {
    return this.browseRunnerValue ??= new BrowseRunner(this.browseStore(), {
      account: signal => this.platform().account(signal),
      search: (keyword, page, signal) => this.platform().search(keyword, page, signal),
      read: (bvid, signal) => this.platform().video(bvid, signal, false),
    });
  }
  private async ownerContext(signal: AbortSignal) {
    const result = await this.runner().preflight(signal);
    const roots = [...new Set(this.store().actions().filter(a => a.kind === 'comment' && a.state === 'accepted' && a.remoteId && a.target.aid === result.video.aid).map(a => a.remoteId))].slice(-2);
    for (const root of roots) {
      let cursor: string | null = null;
      for (let page = 0; page < LIMITS.pages; page++) {
        const replies = await this.platform().comments(result.video.aid, root, cursor, true, signal);
        result.comments.push(...replies.comments.slice(0, LIMITS.pageSize).filter(c => c.parent === root));
        if (!replies.next || replies.next === cursor) break; cursor = replies.next;
      }
    }
    return result;
  }
  private async requestedVideo(signal: AbortSignal, preview = false) {
    const store = this.store(), config = this.currentConfig();
    const saved = store.get('ownerVideoRequest');
    if (!saved) throw new PilotError('OWNER_VIDEO_REQUEST_REQUIRED');
    const request = JSON.parse(saved);
    if (!preview && store.get('ownerVideoRequestUsed:' + request.id)) throw new PilotError('OWNER_VIDEO_REQUEST_CONSUMED');
    const result = await this.ownerContext(signal);
    const comment = result.comments.find(c => c.id === request.id);
    if (request.bvid !== config.bvid || request.accountUid !== result.account.uid || !comment ||
        !isOwnerVideoRequest(comment, config.ownerUid, result.account.uid, Number(store.get('ownerVideoBaselineAt')))) throw new PilotError('OWNER_VIDEO_REQUEST_REQUIRED');
    // The normal preflight never downloads media. Only a current verified owner command gets here.
    const video = await this.platform().video(config.bvid, signal, true);
    return { ...result, video, ownerRequestId: request.id };
  }
  private async mediaOperation<T>(signal: AbortSignal, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.mediaController || this.runnerValue?.busy) throw new PilotError('RUN_BUSY');
    const controller = new AbortController(); this.mediaController = controller;
    try { return await action(AbortSignal.any([signal, controller.signal])); }
    finally { this.mediaController = null; }
  }
  installPolicy(ctx: PolicyContext, audience: 'private' | 'public'): void { this.model().installPolicy(ctx, audience); }
  private async call(method: Method, request: unknown, signal: AbortSignal, action: (value: any, signal: AbortSignal) => Promise<unknown>, exclusive = true): Promise<any> {
    // Model-originated calls have no authenticated owner Peer.
    if (this.ctx.invocation?.peer.principal.kind !== 'owner') throw new RemoteError('gateway/bad-request', 'OWNER_REQUIRED', {});
    const parsed = REQUESTS[method].safeParse(request);
    if (!parsed.success) throw new RemoteError('gateway/bad-request', 'Invalid DaFeiYu request.', {});
    const lifetime = AbortSignal.any([signal, this.lifetime.signal]);
    const run = async () => { lifetime.throwIfAborted(); try {
      if (this.browseRunnerValue?.busy && !['status', 'stop', 'browseHistory'].includes(method)) throw new PilotError('RUN_BUSY');
      if (this.previewController && !['status', 'stop', 'browseHistory'].includes(method)) throw new PilotError('RUN_BUSY');
      if (exclusive) this.exclusiveActive = true;
      return await action(parsed.data, lifetime);
    } catch (error) { throw new RemoteError('gateway/bad-request', safeError(error), {}); }
    finally { if (exclusive) this.exclusiveActive = false; } };
    const op = exclusive ? this.serial.then(run) : run(); if (exclusive) this.serial = op.catch(() => {});
    this.operations.add(op); try { return await op; } finally { this.operations.delete(op); }
  }
  @Remote
  status(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('status', request, signal, async () => {
      const store = this.store(); const config = this.currentConfig();
      let mismatch = false; try { store.assertOwner(config.ownerUid); } catch { mismatch = true; }
      let account = null; let credentialError = '';
      try { account = await this.platform().hasCredential(); } catch (error) { credentialError = safeError(error); }
      if (!this.decoderCheck || Date.now() - this.decoderCheck.at > 30_000) {
        let available = false; try { await findDecoder(); available = true; } catch { /* Optional runtime. No installation or path disclosure. */ }
        this.decoderCheck = { at: Date.now(), available };
      }
      return { config, revision: this.revision(), limits: LIMITS, budget: store.budget(), account, credentialError,
        configError: mismatch ? 'STORE_CONFIG_MISMATCH' : '', trialConsumed: !!store.get('trialConsumed'),
        busy: !!this.previewController || !!this.mediaController || !!this.browseRunnerValue?.busy || (this.runnerValue?.busy ?? false), run: store.runs()[0] ?? null, actions: store.actions(),
        browseBusy: this.browseRunnerValue?.busy ?? false, browseRun: this.browseStore().latest(),
        browseSettings: this.activity().settings(), browseUsage: this.activity().usage(account?.uid ?? '', Date.now()),
        privateSessionId: store.get('privateSession'), report: store.get('latestReport'), reportError: store.get('reportError'),
        videoInspection: store.get('videoInspection'), videoInspectionRevision: store.inspectionRevision(), videoReview: store.get('videoReview'), videoCalibrationConsumed: !!store.get('videoCalibrationConsumed'), videoInspectionConsumed: !!store.get('videoInspectionConsumed'), mediaTrialConsumed: !!store.get('mediaTrialConsumed'),
        ownerVideoRequest: store.get('ownerVideoRequest'), ownerVideoBaselineAt: store.get('ownerVideoBaselineAt'), modelSelection: this.model().selection(), modelPinned: !!store.get('modelSelection'),
        diagnostic: { version: '0.1.0-alpha.11', hostBaseline: '0.2.1-rc.2', node: process.versions.node, marker: config.diagnosticMarker, decoderAvailable: this.decoderCheck.available } };
    }, false);
  }
  @Remote
  browse(request: unknown, signal: AbortSignal): Promise<unknown> {
    // Do not queue starts behind a stopped operation: a new click is always required.
    return this.call('browse', request, signal, async (value, lifetime) => {
      if (this.exclusiveActive || this.mediaController || this.runnerValue?.busy || this.modelValue?.busy) throw new PilotError('RUN_BUSY');
      const config = configOf(this.currentConfig(), true); this.store().bindOwner(config.ownerUid);
      return this.browser().start(value.keyword, value.accountUid, config.ownerUid, lifetime);
    }, false);
  }
  @Remote
  browseHistory(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('browseHistory', request, signal, async () => this.browseStore().history(), false);
  }
  @Remote
  saveBrowsePolicy(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('saveBrowsePolicy', request, signal, async value => {
      if (this.mediaController || this.runnerValue?.busy || this.modelValue?.busy) throw new PilotError('RUN_BUSY');
      this.store().assertOwner(this.currentConfig().ownerUid);
      this.activity().savePolicy(value.policy, value.revision); return this.activity().settings();
    });
  }
  @Remote
  curateBrowse(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('curateBrowse', request, signal, async (value, lifetime) => {
      if (this.exclusiveActive || this.mediaController || this.runnerValue?.busy || this.modelValue?.busy) throw new PilotError('RUN_BUSY');
      const controller = new AbortController(); this.previewController = controller;
      const linked = AbortSignal.any([lifetime, controller.signal, AbortSignal.timeout(120_000)]);
      try {
        const config = configOf(this.currentConfig(), true); this.store().bindOwner(config.ownerUid);
        const account = await this.platform().account(linked); linked.throwIfAborted();
        if (account.uid !== value.accountUid || account.uid === config.ownerUid) throw new PilotError('ACCOUNT_CHANGED');
        return await this.curator().preview(value.runId, account.uid, linked);
      } finally { this.previewController = null; }
    }, false);
  }
  @Remote
  saveConfig(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('saveConfig', request, signal, async value => {
      if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY');
      if (value.revision !== this.revision()) throw new PilotError('CONFIG_REVISION_CONFLICT');
      const config = configOf(value.config); const store = this.store(); store.assertOwner(config.ownerUid);
      if (store.get('trialConsumed') && JSON.stringify(config) !== JSON.stringify(this.currentConfig())) throw new PilotError('TRIAL_CONFIG_LOCKED');
      const entry = (this.owner.fiber as unknown as { entry?: unknown }).entry;
      if (!entry) throw new PilotError('CONFIG_EDITOR_UNAVAILABLE');
      await this.owner.configEditor.edit(entry, current => ({ ...current, ...config }));
      if (JSON.stringify(config) !== JSON.stringify(this.currentConfig())) throw new PilotError('CONFIG_NOT_APPLIED');
      return { config: this.currentConfig(), revision: this.revision() };
    });
  }
  @Remote
  loginStart(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('loginStart', request, signal, async (_value, lifetime) => {
      if (this.runnerValue?.busy || this.store().get('trialConsumed')) throw new PilotError('TRIAL_ACCOUNT_LOCKED');
      return this.platform().loginStart(lifetime);
    });
  }
  @Remote
  loginPoll(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('loginPoll', request, signal, async (value, lifetime) => {
      if (this.runnerValue?.busy || this.store().get('trialConsumed')) throw new PilotError('TRIAL_ACCOUNT_LOCKED');
      return this.platform().loginPoll(value.loginId, lifetime);
    });
  }
  @Remote
  logout(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('logout', request, signal, async () => { await this.runnerValue?.stop(); await this.platform().logout(); return { removed: true }; });
  }
  @Remote
  preflight(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('preflight', request, signal, async (_value, lifetime) => this.mediaOperation(lifetime, async lifetime => {
      if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY');
      const result = await this.runner().preflight(lifetime);
      return { account: result.account, video: { bvid: result.video.bvid, title: result.video.title, hasSubtitle: !!result.video.subtitle?.trim(), frameCount: result.video.visual?.frames.length ?? 0, durationSeconds: result.video.visual?.durationSeconds ?? null, audio: result.video.visual?.audio ?? 'not-transcribed' }, commentsRead: result.comments.length, revision: this.revision() };
    }));
  }
  @Remote
  models(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('models', request, signal, async (_value, lifetime) => {
      const llm = (this.owner as unknown as ModelHost).llm;
      const rows = await Promise.all(llm.listProviders().map(async provider => {
        try { const models = await llm.listModels(provider.id); return { provider: provider.id, name: provider.name ?? provider.id, models }; }
        catch { return { provider: provider.id, name: provider.name ?? provider.id, models: [], unavailable: true }; }
      })); lifetime.throwIfAborted(); return rows;
    });
  }
  @Remote
  saveModel(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('saveModel', request, signal, async (value, lifetime) => {
      if (this.mediaController || this.runnerValue?.busy || this.modelValue?.busy) throw new PilotError('RUN_BUSY');
      const llm = (this.owner as unknown as ModelHost).llm;
      if (!llm.listProviders().some(p => p.id === value.provider) || !(await llm.listModels(value.provider)).some(m => m.id === value.model)) throw new PilotError('MODEL_NOT_IN_CATALOG');
      const info = await llm.resolveModelInfo(value.provider, value.model, lifetime); lifetime.throwIfAborted();
      this.store().assertOwner(this.currentConfig().ownerUid);
      this.store().set('modelSelection', JSON.stringify({ provider: value.provider, model: value.model }));
      return { saved: true, imageSupported: !!info.inputModalities?.includes('image') };
    });
  }
  @Remote
  checkOwnerRequest(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('checkOwnerRequest', request, signal, async (_value, lifetime) => {
      const store = this.store(), config = this.currentConfig();
      if (!store.get('ownerVideoBaselineAt')) store.set('ownerVideoBaselineAt', String(Date.now()));
      const result = await this.ownerContext(lifetime);
      const found = result.comments.filter(c => isOwnerVideoRequest(c, config.ownerUid, result.account.uid, Number(store.get('ownerVideoBaselineAt'))) && !store.get('ownerVideoRequestUsed:' + c.id)).sort((a,b) => b.createdAt-a.createdAt)[0];
      if (found) store.set('ownerVideoRequest', JSON.stringify({ id: found.id, accountUid: result.account.uid, bvid: result.video.bvid, at: found.createdAt }));
      return { found: !!found, baselineAt: store.get('ownerVideoBaselineAt') };
    });
  }
  @Remote
  inspectVideo(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.inspect(request, signal, false);
  }
  @Remote
  calibrateVideo(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.inspect(request, signal, true);
  }
  private inspect(request: unknown, signal: AbortSignal, calibration: boolean): Promise<unknown> {
    return this.call(calibration ? 'calibrateVideo' : 'inspectVideo', request, signal, async (requestValue, lifetime) => this.mediaOperation(lifetime, async lifetime => {
      if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY');
      const store = this.store();
      if (calibration) store.assertCalibration(requestValue.revision);
      else {
        if (store.get('videoInspection')) throw new PilotError('VIDEO_INSPECTION_ALREADY_CONSUMED');
        if (store.budget().grant !== 'initial') throw new PilotError('MODEL_BUDGET_EXHAUSTED');
      }
      const config = configOf(this.currentConfig(), true), result = await this.requestedVideo(lifetime);
      if (!result.video.visual?.frames.length && !result.video.subtitle?.trim()) throw new PilotError('VIDEO_CONTENT_UNAVAILABLE');
      if (calibration) store.matchInspection(result.account.uid, result.video);
      const budget = store.budget(); if (budget.used >= budget.total || budget.byPurpose.public >= 3) throw new PilotError('MODEL_BUDGET_EXHAUSTED');
      // This explicit read-only analysis spends the existing public request budget. It never rearms a trial.
      store.set('videoInspectionConsumed', 'true');
      const allFrames = result.video.visual?.frames;
      // Calibration compares isolated first/middle/last frames in one request, never a model loop.
      const frames = allFrames?.length ? [...new Set([0, Math.floor(allFrames.length / 2), allFrames.length - 1])].map(i => allFrames[i]!) : allFrames;
      const inputMaterial = publicVideo({ ...result.video, ...(result.video.visual && frames ? { visual: { ...result.video.visual, frames } } : {}) });
      store.set('ownerVideoRequestUsed:' + result.ownerRequestId, 'true');
      const answer = await this.model().ask({ purpose: 'public', persona: config.persona, frames, calibrationRevision: calibration ? requestValue.revision : undefined,
          prompt: `${MEDIA_INSTRUCTION}${calibration ? '本次只核对所附的独立采样帧；分别描述每张帧中可见的主体姿态与环境，看不清就写无法判断。不要把不同帧的姿态混在一起。' : ''}用简短答案概述实际可见内容，不需要逐帧详解或识别作品名称。总字数不超过250字，观察最多3项。仅返回 JSON：{"summary":"简短概述","observations":[{"atSeconds":0,"description":"该时刻实际可见的内容"}],"limitations":["音频未转写"]}。观察时刻必须来自所提供的采样帧。\n` + JSON.stringify(inputMaterial) }, lifetime);
      lifetime.throwIfAborted();
      let parsed: any; try { parsed = JSON.parse(answer.text); } catch { throw new PilotError('INVALID_VIDEO_ANALYSIS'); }
      const value = parsed;
      const times = frames?.map(f => f.atSeconds) ?? [];
      if (!value || typeof value.summary !== 'string' || value.summary.length > 2000 || !Array.isArray(value.observations) || value.observations.length > 12 ||
          value.observations.some((o: any) => !o || typeof o.atSeconds !== 'number' || typeof o.description !== 'string' || o.description.length > 1000 || !times.some(t => Math.abs(t - o.atSeconds) < 0.1)) ||
          !Array.isArray(value.limitations) || value.limitations.length > 12 || value.limitations.some((s: any) => typeof s !== 'string' || s.length > 1000)) throw new PilotError('INVALID_VIDEO_ANALYSIS');
      const report = { video: `https://www.bilibili.com/video/${config.bvid}/`, accountUid: result.account.uid, material: publicVideo(result.video), inputFrameTimes: times, analysis: { summary: value.summary, observations: value.observations.map((o: any) => ({ atSeconds: o.atSeconds, description: o.description })), limitations: value.limitations }, audio: 'not-transcribed', sessionId: answer.sessionId };
      store.set('videoInspection', JSON.stringify(report)); return report;
    }));
  }
  @Remote
  videoEvidence(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('videoEvidence', request, signal, async (_value, lifetime) => this.mediaOperation(lifetime, async lifetime => {
      const store = this.store(); if (!store.inspectionRevision()) throw new PilotError('VIDEO_INSPECTION_REQUIRED');
      const result = await this.requestedVideo(lifetime, true);
      store.matchInspection(result.account.uid, result.video); lifetime.throwIfAborted();
      const revision = store.inspectionRevision(); store.set('videoEvidenceViewed', revision);
      return { revision, subtitle: result.video.subtitle, frames: (result.video.visual?.frames ?? []).map(f => ({ atSeconds: f.atSeconds, image: 'data:image/jpeg;base64,' + Buffer.from(f.jpeg).toString('base64') })) };
    }));
  }
  @Remote
  reviewVideo(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('reviewVideo', request, signal, async value => {
      if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY');
      this.store().recordVideoReview(value.revision, value.decision, value.note);
      return { saved: true };
    });
  }
  @Remote
  chat(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('chat', request, signal, async (value, lifetime) => {
      const config = configOf(this.currentConfig(), true);
      return this.model().ask({ purpose: 'private', persona: config.persona, prompt: value.text }, lifetime);
    });
  }
  @Remote
  start(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('start', request, signal, async (value, lifetime) => {
      if (value.revision !== this.revision()) throw new PilotError('CONFIG_REVISION_CONFLICT');
      return this.runner().start(value.accountUid, lifetime);
    });
  }
  @Remote
  startMediaTrial(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('startMediaTrial', request, signal, async (value, lifetime) => {
      if (value.revision !== this.revision()) throw new PilotError('CONFIG_REVISION_CONFLICT');
      if (!this.store().get('videoInspection')) throw new PilotError('MEDIA_TRIAL_NOT_READY');
      return this.runner().start(value.accountUid, lifetime, 'media-trial-2');
    });
  }
  @Remote
  stop(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('stop', request, signal, async () => { this.previewController?.abort(); this.mediaController?.abort(); this.browseRunnerValue?.stop(); await this.runnerValue?.stop(); return { stopped: true }; }, false);
  }
  @Remote
  reconcile(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('reconcile', request, signal, async (_value, lifetime) => { if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY'); await this.runner().reconcile(lifetime); return { checked: true }; });
  }
  private async shutdown(): Promise<void> {
    this.lifetime.abort(); this.browseRunnerValue?.stop(); await this.runnerValue?.stop(); await this.modelValue?.dispose();
    await Promise.allSettled([...this.operations]); this.storeValue?.close();
  }
}
export function apply(ctx: HostContext, config: LiveConfig): void {
  new DaFeiYuControl(ctx, config);
  ctx.logger.info('大肥鱼已加载：真实活动须在设置页手动启动，预算与发送范围受程序限制。');
}
