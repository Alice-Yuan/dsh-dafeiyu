var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import s from '@deepseek-ai/schemastery';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { configOf, DEFAULT_PERSONA, LIMITS, PilotError, safeError } from '../pilot/contracts.js';
import { PilotStore } from '../pilot/store.js';
import { PilotRunner } from '../pilot/runner.js';
import { Bilibili } from '../platform/bilibili.js';
import { WindowsVault } from '../platform/vault.js';
import { HostModel } from './model.js';
import { REQUESTS } from '../shared/remote.js';
export const name = 'dafeyu';
export const inject = ['profileContext', 'configEditor', 'agents', 'agentDefaultModel', 'agentPresets', 'typert'];
export const Config = s.object({
    ownerUid: s.string().pattern(/^(|[1-9]\d{0,24})$/).default('').volatile(),
    bvid: s.string().pattern(/^(|BV[1-9A-HJ-NP-Za-km-z]{10})$/).default('').volatile(),
    persona: s.string().min(1).max(2000).default(DEFAULT_PERSONA).volatile(),
    diagnosticMarker: s.string().pattern(/^[\w .:-]{0,80}$/).default('').volatile(),
});
let DaFeiYuControl = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _status_decorators;
    let _saveConfig_decorators;
    let _loginStart_decorators;
    let _loginPoll_decorators;
    let _logout_decorators;
    let _preflight_decorators;
    let _chat_decorators;
    let _start_decorators;
    let _stop_decorators;
    let _reconcile_decorators;
    return class DaFeiYuControl extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _status_decorators = [Remote];
            _saveConfig_decorators = [Remote];
            _loginStart_decorators = [Remote];
            _loginPoll_decorators = [Remote];
            _logout_decorators = [Remote];
            _preflight_decorators = [Remote];
            _chat_decorators = [Remote];
            _start_decorators = [Remote];
            _stop_decorators = [Remote];
            _reconcile_decorators = [Remote];
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveConfig_decorators, { kind: "method", name: "saveConfig", static: false, private: false, access: { has: obj => "saveConfig" in obj, get: obj => obj.saveConfig }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _loginStart_decorators, { kind: "method", name: "loginStart", static: false, private: false, access: { has: obj => "loginStart" in obj, get: obj => obj.loginStart }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _loginPoll_decorators, { kind: "method", name: "loginPoll", static: false, private: false, access: { has: obj => "loginPoll" in obj, get: obj => obj.loginPoll }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _logout_decorators, { kind: "method", name: "logout", static: false, private: false, access: { has: obj => "logout" in obj, get: obj => obj.logout }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _preflight_decorators, { kind: "method", name: "preflight", static: false, private: false, access: { has: obj => "preflight" in obj, get: obj => obj.preflight }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _chat_decorators, { kind: "method", name: "chat", static: false, private: false, access: { has: obj => "chat" in obj, get: obj => obj.chat }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _start_decorators, { kind: "method", name: "start", static: false, private: false, access: { has: obj => "start" in obj, get: obj => obj.start }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _stop_decorators, { kind: "method", name: "stop", static: false, private: false, access: { has: obj => "stop" in obj, get: obj => obj.stop }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _reconcile_decorators, { kind: "method", name: "reconcile", static: false, private: false, access: { has: obj => "reconcile" in obj, get: obj => obj.reconcile }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        owner = __runInitializers(this, _instanceExtraInitializers);
        live;
        storeValue = null;
        modelValue = null;
        runnerValue = null;
        platformValue = null;
        lifetime = new AbortController();
        serial = Promise.resolve();
        operations = new Set();
        constructor(owner, live) {
            super(owner, 'dafeyuControl', { namespace: 'dafeyu' });
            this.owner = owner;
            this.live = live;
            owner.effect(() => () => this.shutdown());
        }
        currentConfig() {
            return configOf({ ownerUid: this.live.ownerUid.get(), bvid: this.live.bvid.get(), persona: this.live.persona.get(), diagnosticMarker: this.live.diagnosticMarker.get() });
        }
        revision() { return createHash('sha256').update(JSON.stringify(this.currentConfig())).digest('hex'); }
        store() {
            if (!this.storeValue)
                this.storeValue = new PilotStore(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'pilot.sqlite'));
            return this.storeValue;
        }
        platform() {
            return this.platformValue ??= new Bilibili(new WindowsVault(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'bilibili.dpapi')));
        }
        model() { return this.modelValue ??= new HostModel(this.owner, () => this.store(), () => this.currentConfig()); }
        runner() { return this.runnerValue ??= new PilotRunner(this.store(), this.platform(), this.model(), () => this.currentConfig()); }
        installPolicy(ctx, audience) { this.model().installPolicy(ctx, audience); }
        async call(method, request, signal, action, exclusive = true) {
            // Model-originated calls have no authenticated owner Peer.
            if (this.ctx.invocation?.peer.principal.kind !== 'owner')
                throw new RemoteError('gateway/bad-request', 'OWNER_REQUIRED', {});
            const parsed = REQUESTS[method].safeParse(request);
            if (!parsed.success)
                throw new RemoteError('gateway/bad-request', 'Invalid DaFeiYu request.', {});
            const lifetime = AbortSignal.any([signal, this.lifetime.signal]);
            const run = async () => { lifetime.throwIfAborted(); try {
                return await action(parsed.data, lifetime);
            }
            catch (error) {
                throw new RemoteError('gateway/bad-request', safeError(error), {});
            } };
            const op = exclusive ? this.serial.then(run) : run();
            if (exclusive)
                this.serial = op.catch(() => { });
            this.operations.add(op);
            try {
                return await op;
            }
            finally {
                this.operations.delete(op);
            }
        }
        status(request, signal) {
            return this.call('status', request, signal, async () => {
                const store = this.store();
                const config = this.currentConfig();
                let mismatch = false;
                try {
                    store.assertOwner(config.ownerUid);
                }
                catch {
                    mismatch = true;
                }
                let account = null;
                let credentialError = '';
                try {
                    account = await this.platform().hasCredential();
                }
                catch (error) {
                    credentialError = safeError(error);
                }
                return { config, revision: this.revision(), limits: LIMITS, budget: store.budget(), account, credentialError,
                    configError: mismatch ? 'STORE_CONFIG_MISMATCH' : '', trialConsumed: !!store.get('trialConsumed'),
                    busy: this.runnerValue?.busy ?? false, run: store.runs()[0] ?? null, actions: store.actions(),
                    privateSessionId: store.get('privateSession'), report: store.get('latestReport'), reportError: store.get('reportError'),
                    diagnostic: { version: '0.1.0-alpha.5', hostBaseline: '0.2.1-rc.2', node: process.versions.node, marker: config.diagnosticMarker } };
            }, false);
        }
        saveConfig(request, signal) {
            return this.call('saveConfig', request, signal, async (value) => {
                if (this.runnerValue?.busy)
                    throw new PilotError('RUN_BUSY');
                if (value.revision !== this.revision())
                    throw new PilotError('CONFIG_REVISION_CONFLICT');
                const config = configOf(value.config);
                const store = this.store();
                store.assertOwner(config.ownerUid);
                if (store.get('trialConsumed') && JSON.stringify(config) !== JSON.stringify(this.currentConfig()))
                    throw new PilotError('TRIAL_CONFIG_LOCKED');
                const entry = this.owner.fiber.entry;
                if (!entry)
                    throw new PilotError('CONFIG_EDITOR_UNAVAILABLE');
                await this.owner.configEditor.edit(entry, current => ({ ...current, ...config }));
                if (JSON.stringify(config) !== JSON.stringify(this.currentConfig()))
                    throw new PilotError('CONFIG_NOT_APPLIED');
                return { config: this.currentConfig(), revision: this.revision() };
            });
        }
        loginStart(request, signal) {
            return this.call('loginStart', request, signal, async (_value, lifetime) => {
                if (this.runnerValue?.busy || this.store().get('trialConsumed'))
                    throw new PilotError('TRIAL_ACCOUNT_LOCKED');
                return this.platform().loginStart(lifetime);
            });
        }
        loginPoll(request, signal) {
            return this.call('loginPoll', request, signal, async (value, lifetime) => {
                if (this.runnerValue?.busy || this.store().get('trialConsumed'))
                    throw new PilotError('TRIAL_ACCOUNT_LOCKED');
                return this.platform().loginPoll(value.loginId, lifetime);
            });
        }
        logout(request, signal) {
            return this.call('logout', request, signal, async () => { await this.runnerValue?.stop(); await this.platform().logout(); return { removed: true }; });
        }
        preflight(request, signal) {
            return this.call('preflight', request, signal, async (_value, lifetime) => {
                if (this.runnerValue?.busy)
                    throw new PilotError('RUN_BUSY');
                const result = await this.runner().preflight(lifetime);
                return { account: result.account, video: { bvid: result.video.bvid, title: result.video.title, hasSubtitle: result.video.subtitle !== null }, commentsRead: result.comments.length, revision: this.revision() };
            });
        }
        chat(request, signal) {
            return this.call('chat', request, signal, async (value, lifetime) => {
                const config = configOf(this.currentConfig(), true);
                return this.model().ask({ purpose: 'private', persona: config.persona, prompt: value.text }, lifetime);
            });
        }
        start(request, signal) {
            return this.call('start', request, signal, async (value, lifetime) => {
                if (value.revision !== this.revision())
                    throw new PilotError('CONFIG_REVISION_CONFLICT');
                return this.runner().start(value.accountUid, lifetime);
            });
        }
        stop(request, signal) {
            return this.call('stop', request, signal, async () => { await this.runnerValue?.stop(); return { stopped: true }; }, false);
        }
        reconcile(request, signal) {
            return this.call('reconcile', request, signal, async (_value, lifetime) => { if (this.runnerValue?.busy)
                throw new PilotError('RUN_BUSY'); await this.runner().reconcile(lifetime); return { checked: true }; });
        }
        async shutdown() {
            this.lifetime.abort();
            await this.runnerValue?.stop();
            await this.modelValue?.dispose();
            await Promise.allSettled([...this.operations]);
            this.storeValue?.close();
        }
    };
})();
export { DaFeiYuControl };
export function apply(ctx, config) {
    new DaFeiYuControl(ctx, config);
    ctx.logger.info('大肥鱼已加载：真实活动须在设置页手动启动，预算与发送范围受程序限制。');
}
//# sourceMappingURL=plugin.js.map