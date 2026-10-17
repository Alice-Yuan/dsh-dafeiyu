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

interface Ref<T> { get(): T }
type LiveConfig = { [K in keyof PilotConfig]: Ref<PilotConfig[K]> };
interface HostContext extends Context {
  profileContext: { dir: string };
  configEditor: { edit(entry: unknown, change: (current: Record<string, unknown>) => unknown): Promise<void> };
}
export const name = 'dafeyu';
export const inject = ['profileContext', 'configEditor', 'agents', 'agentDefaultModel', 'agentPresets', 'typert'];
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
  private readonly lifetime = new AbortController();
  private serial: Promise<unknown> = Promise.resolve();
  private operations = new Set<Promise<unknown>>();
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
    return this.platformValue ??= new Bilibili(new WindowsVault(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'bilibili.dpapi')));
  }
  private model(): HostModel { return this.modelValue ??= new HostModel(this.owner as unknown as ModelHost, () => this.store(), () => this.currentConfig()); }
  private runner(): PilotRunner { return this.runnerValue ??= new PilotRunner(this.store(), this.platform(), this.model(), () => this.currentConfig()); }
  installPolicy(ctx: PolicyContext, audience: 'private' | 'public'): void { this.model().installPolicy(ctx, audience); }
  private async call(method: Method, request: unknown, signal: AbortSignal, action: (value: any, signal: AbortSignal) => Promise<unknown>, exclusive = true): Promise<any> {
    // Model-originated calls have no authenticated owner Peer.
    if (this.ctx.invocation?.peer.principal.kind !== 'owner') throw new RemoteError('gateway/bad-request', 'OWNER_REQUIRED', {});
    const parsed = REQUESTS[method].safeParse(request);
    if (!parsed.success) throw new RemoteError('gateway/bad-request', 'Invalid DaFeiYu request.', {});
    const lifetime = AbortSignal.any([signal, this.lifetime.signal]);
    const run = async () => { lifetime.throwIfAborted(); try { return await action(parsed.data, lifetime); } catch (error) { throw new RemoteError('gateway/bad-request', safeError(error), {}); } };
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
      return { config, revision: this.revision(), limits: LIMITS, budget: store.budget(), account, credentialError,
        configError: mismatch ? 'STORE_CONFIG_MISMATCH' : '', trialConsumed: !!store.get('trialConsumed'),
        busy: this.runnerValue?.busy ?? false, run: store.runs()[0] ?? null, actions: store.actions(),
        privateSessionId: store.get('privateSession'), report: store.get('latestReport'), reportError: store.get('reportError'),
        diagnostic: { version: '0.1.0-alpha.3', hostBaseline: '0.2.1-rc.2', node: process.versions.node, marker: config.diagnosticMarker } };
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
    return this.call('preflight', request, signal, async (_value, lifetime) => {
      if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY');
      const result = await this.runner().preflight(lifetime);
      return { account: result.account, video: { bvid: result.video.bvid, title: result.video.title, hasSubtitle: result.video.subtitle !== null }, commentsRead: result.comments.length, revision: this.revision() };
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
  stop(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('stop', request, signal, async () => { await this.runnerValue?.stop(); return { stopped: true }; }, false);
  }
  @Remote
  reconcile(request: unknown, signal: AbortSignal): Promise<unknown> {
    return this.call('reconcile', request, signal, async (_value, lifetime) => { if (this.runnerValue?.busy) throw new PilotError('RUN_BUSY'); await this.runner().reconcile(lifetime); return { checked: true }; });
  }
  private async shutdown(): Promise<void> {
    this.lifetime.abort(); await this.runnerValue?.stop(); await this.modelValue?.dispose();
    await Promise.allSettled([...this.operations]); this.storeValue?.close();
  }
}
export function apply(ctx: HostContext, config: LiveConfig): void {
  new DaFeiYuControl(ctx, config);
  ctx.logger.info('大肥鱼已加载：真实活动须在设置页手动启动，预算与发送范围受程序限制。');
}
