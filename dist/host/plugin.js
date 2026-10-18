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
import { configOf, DEFAULT_PERSONA, LIMITS, PilotError, safeError, samePublicAuthorization } from '../pilot/contracts.js';
import { PilotStore } from '../pilot/store.js';
import { PilotRunner } from '../pilot/runner.js';
import { Bilibili } from '../platform/bilibili.js';
import { WindowsVault } from '../platform/vault.js';
import { HostModel } from './model.js';
import { REQUESTS } from '../shared/remote.js';
import { FfmpegMediaReader, findDecoder } from '../platform/media.js';
import { publicVideo, MEDIA_INSTRUCTION } from '../pilot/material.js';
import { isOwnerVideoRequest } from '../pilot/owner-request.js';
import { BrowseRunner } from '../browse/runner.js';
import { BrowseStore } from '../browse/store.js';
import { ActivityStore } from '../browse/activity-store.js';
import { Curator } from '../browse/curation.js';
import { PrivateChatBudget } from '../pilot/private-chat.js';
export const name = 'dafeyu';
export const inject = ['profileContext', 'configEditor', 'agents', 'agentDefaultModel', 'agentPresets', 'typert', 'llm', 'attachments'];
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
    let _browse_decorators;
    let _browseHistory_decorators;
    let _saveBrowsePolicy_decorators;
    let _curateBrowse_decorators;
    let _saveConfig_decorators;
    let _loginStart_decorators;
    let _loginPoll_decorators;
    let _logout_decorators;
    let _preflight_decorators;
    let _models_decorators;
    let _saveModel_decorators;
    let _checkOwnerRequest_decorators;
    let _inspectVideo_decorators;
    let _calibrateVideo_decorators;
    let _videoEvidence_decorators;
    let _reviewVideo_decorators;
    let _chat_decorators;
    let _start_decorators;
    let _startMediaTrial_decorators;
    let _stop_decorators;
    let _reconcile_decorators;
    return class DaFeiYuControl extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _status_decorators = [Remote];
            _browse_decorators = [Remote];
            _browseHistory_decorators = [Remote];
            _saveBrowsePolicy_decorators = [Remote];
            _curateBrowse_decorators = [Remote];
            _saveConfig_decorators = [Remote];
            _loginStart_decorators = [Remote];
            _loginPoll_decorators = [Remote];
            _logout_decorators = [Remote];
            _preflight_decorators = [Remote];
            _models_decorators = [Remote];
            _saveModel_decorators = [Remote];
            _checkOwnerRequest_decorators = [Remote];
            _inspectVideo_decorators = [Remote];
            _calibrateVideo_decorators = [Remote];
            _videoEvidence_decorators = [Remote];
            _reviewVideo_decorators = [Remote];
            _chat_decorators = [Remote];
            _start_decorators = [Remote];
            _startMediaTrial_decorators = [Remote];
            _stop_decorators = [Remote];
            _reconcile_decorators = [Remote];
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _browse_decorators, { kind: "method", name: "browse", static: false, private: false, access: { has: obj => "browse" in obj, get: obj => obj.browse }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _browseHistory_decorators, { kind: "method", name: "browseHistory", static: false, private: false, access: { has: obj => "browseHistory" in obj, get: obj => obj.browseHistory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveBrowsePolicy_decorators, { kind: "method", name: "saveBrowsePolicy", static: false, private: false, access: { has: obj => "saveBrowsePolicy" in obj, get: obj => obj.saveBrowsePolicy }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _curateBrowse_decorators, { kind: "method", name: "curateBrowse", static: false, private: false, access: { has: obj => "curateBrowse" in obj, get: obj => obj.curateBrowse }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveConfig_decorators, { kind: "method", name: "saveConfig", static: false, private: false, access: { has: obj => "saveConfig" in obj, get: obj => obj.saveConfig }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _loginStart_decorators, { kind: "method", name: "loginStart", static: false, private: false, access: { has: obj => "loginStart" in obj, get: obj => obj.loginStart }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _loginPoll_decorators, { kind: "method", name: "loginPoll", static: false, private: false, access: { has: obj => "loginPoll" in obj, get: obj => obj.loginPoll }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _logout_decorators, { kind: "method", name: "logout", static: false, private: false, access: { has: obj => "logout" in obj, get: obj => obj.logout }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _preflight_decorators, { kind: "method", name: "preflight", static: false, private: false, access: { has: obj => "preflight" in obj, get: obj => obj.preflight }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _models_decorators, { kind: "method", name: "models", static: false, private: false, access: { has: obj => "models" in obj, get: obj => obj.models }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveModel_decorators, { kind: "method", name: "saveModel", static: false, private: false, access: { has: obj => "saveModel" in obj, get: obj => obj.saveModel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _checkOwnerRequest_decorators, { kind: "method", name: "checkOwnerRequest", static: false, private: false, access: { has: obj => "checkOwnerRequest" in obj, get: obj => obj.checkOwnerRequest }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _inspectVideo_decorators, { kind: "method", name: "inspectVideo", static: false, private: false, access: { has: obj => "inspectVideo" in obj, get: obj => obj.inspectVideo }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _calibrateVideo_decorators, { kind: "method", name: "calibrateVideo", static: false, private: false, access: { has: obj => "calibrateVideo" in obj, get: obj => obj.calibrateVideo }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _videoEvidence_decorators, { kind: "method", name: "videoEvidence", static: false, private: false, access: { has: obj => "videoEvidence" in obj, get: obj => obj.videoEvidence }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _reviewVideo_decorators, { kind: "method", name: "reviewVideo", static: false, private: false, access: { has: obj => "reviewVideo" in obj, get: obj => obj.reviewVideo }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _chat_decorators, { kind: "method", name: "chat", static: false, private: false, access: { has: obj => "chat" in obj, get: obj => obj.chat }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _start_decorators, { kind: "method", name: "start", static: false, private: false, access: { has: obj => "start" in obj, get: obj => obj.start }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _startMediaTrial_decorators, { kind: "method", name: "startMediaTrial", static: false, private: false, access: { has: obj => "startMediaTrial" in obj, get: obj => obj.startMediaTrial }, metadata: _metadata }, null, _instanceExtraInitializers);
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
        browseStoreValue = null;
        browseRunnerValue = null;
        activityValue = null;
        curatorValue = null;
        previewController = null;
        mediaController = null;
        chatController = null;
        lifetime = new AbortController();
        serial = Promise.resolve();
        exclusiveActive = false;
        operations = new Set();
        decoderCheck = null;
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
            return this.platformValue ??= new Bilibili(new WindowsVault(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'bilibili.dpapi')), fetch, Date.now, new FfmpegMediaReader(join(this.owner.profileContext.dir, 'data', 'dsh-dafeiyu', 'media-temp')), account => this.store().bindAccount(this.currentConfig().ownerUid, account.uid));
        }
        async retainAccountBinding() {
            const store = this.store(), config = this.currentConfig();
            store.bindOwner(config.ownerUid);
            if (!store.boundAccountUid()) {
                const saved = await this.platform().hasCredential();
                if (saved && saved.uid !== config.ownerUid)
                    store.bindAccount(config.ownerUid, saved.uid);
            }
        }
        model() { return this.modelValue ??= new HostModel(this.owner, () => this.store(), () => this.currentConfig()); }
        runner() { return this.runnerValue ??= new PilotRunner(this.store(), this.platform(), this.model(), () => this.currentConfig()); }
        browseStore() { return this.browseStoreValue ??= new BrowseStore(this.store()); }
        activity() { return this.activityValue ??= new ActivityStore(this.store()); }
        curator() { return this.curatorValue ??= new Curator(this.browseStore(), this.activity(), (prompt, signal, reserve) => this.model().preview(prompt, signal, reserve), Date.now, () => this.currentConfig().persona); }
        browser() {
            return this.browseRunnerValue ??= new BrowseRunner(this.browseStore(), {
                account: signal => this.platform().account(signal),
                search: (keyword, page, signal) => this.platform().search(keyword, page, signal),
                read: (bvid, signal) => this.platform().video(bvid, signal, false),
            });
        }
        async ownerContext(signal) {
            const result = await this.runner().preflight(signal);
            const roots = [...new Set(this.store().actions().filter(a => a.kind === 'comment' && a.state === 'accepted' && a.remoteId && a.target.aid === result.video.aid).map(a => a.remoteId))].slice(-2);
            for (const root of roots) {
                let cursor = null;
                for (let page = 0; page < LIMITS.pages; page++) {
                    const replies = await this.platform().comments(result.video.aid, root, cursor, true, signal);
                    result.comments.push(...replies.comments.slice(0, LIMITS.pageSize).filter(c => c.parent === root));
                    if (!replies.next || replies.next === cursor)
                        break;
                    cursor = replies.next;
                }
            }
            return result;
        }
        async requestedVideo(signal, preview = false) {
            const store = this.store(), config = this.currentConfig();
            const saved = store.get('ownerVideoRequest');
            if (!saved)
                throw new PilotError('OWNER_VIDEO_REQUEST_REQUIRED');
            const request = JSON.parse(saved);
            if (!preview && store.get('ownerVideoRequestUsed:' + request.id))
                throw new PilotError('OWNER_VIDEO_REQUEST_CONSUMED');
            const result = await this.ownerContext(signal);
            const comment = result.comments.find(c => c.id === request.id);
            if (request.bvid !== config.bvid || request.accountUid !== result.account.uid || !comment ||
                !isOwnerVideoRequest(comment, config.ownerUid, result.account.uid, Number(store.get('ownerVideoBaselineAt'))))
                throw new PilotError('OWNER_VIDEO_REQUEST_REQUIRED');
            // The normal preflight never downloads media. Only a current verified owner command gets here.
            const video = await this.platform().video(config.bvid, signal, true);
            return { ...result, video, ownerRequestId: request.id };
        }
        async mediaOperation(signal, action) {
            if (this.mediaController || this.runnerValue?.busy)
                throw new PilotError('RUN_BUSY');
            const controller = new AbortController();
            this.mediaController = controller;
            try {
                return await action(AbortSignal.any([signal, controller.signal]));
            }
            finally {
                this.mediaController = null;
            }
        }
        installPolicy(ctx, audience) { this.model().installPolicy(ctx, audience); }
        async call(method, request, signal, action, exclusive = true) {
            // Model-originated calls have no authenticated owner Peer.
            if (this.ctx.invocation?.peer.principal.kind !== 'owner')
                throw new RemoteError('gateway/bad-request', 'OWNER_REQUIRED', {});
            const parsed = REQUESTS[method].safeParse(request);
            if (!parsed.success)
                throw new RemoteError('gateway/bad-request', 'Invalid DaFeiYu request.', {});
            const lifetime = AbortSignal.any([signal, this.lifetime.signal]);
            const run = async () => {
                lifetime.throwIfAborted();
                try {
                    if (this.browseRunnerValue?.busy && !['status', 'stop', 'browseHistory'].includes(method))
                        throw new PilotError('RUN_BUSY');
                    if (this.previewController && !['status', 'stop', 'browseHistory'].includes(method))
                        throw new PilotError('RUN_BUSY');
                    if (exclusive)
                        this.exclusiveActive = true;
                    return await action(parsed.data, lifetime);
                }
                catch (error) {
                    throw new RemoteError('gateway/bad-request', safeError(error), {});
                }
                finally {
                    if (exclusive)
                        this.exclusiveActive = false;
                }
            };
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
                if (!this.decoderCheck || Date.now() - this.decoderCheck.at > 30_000) {
                    let available = false;
                    try {
                        await findDecoder();
                        available = true;
                    }
                    catch { /* Optional runtime. No installation or path disclosure. */ }
                    this.decoderCheck = { at: Date.now(), available };
                }
                return { config, revision: this.revision(), limits: LIMITS, budget: store.budget(), account, credentialError,
                    privateBudget: config.ownerUid && !mismatch ? new PrivateChatBudget(store).status(config.ownerUid) : null,
                    configError: mismatch ? 'STORE_CONFIG_MISMATCH' : '', trialConsumed: !!store.get('trialConsumed'),
                    busy: !!this.chatController || !!this.modelValue?.busy || !!this.previewController || !!this.mediaController || !!this.browseRunnerValue?.busy || (this.runnerValue?.busy ?? false), run: store.runs()[0] ?? null, actions: store.actions(),
                    browseBusy: this.browseRunnerValue?.busy ?? false, browseRun: this.browseStore().latest(),
                    browseSettings: this.activity().settings(), browseUsage: this.activity().usage(account?.uid ?? '', Date.now()),
                    privateSessionId: store.get('privateSession'), report: store.get('latestReport'), reportError: store.get('reportError'),
                    videoInspection: store.get('videoInspection'), videoInspectionRevision: store.inspectionRevision(), videoReview: store.get('videoReview'), videoCalibrationConsumed: !!store.get('videoCalibrationConsumed'), videoInspectionConsumed: !!store.get('videoInspectionConsumed'), mediaTrialConsumed: !!store.get('mediaTrialConsumed'),
                    ownerVideoRequest: store.get('ownerVideoRequest'), ownerVideoBaselineAt: store.get('ownerVideoBaselineAt'), modelSelection: this.model().selection(), modelPinned: !!store.get('modelSelection'),
                    diagnostic: { version: '0.1.0-alpha.12', hostBaseline: '0.2.1-rc.2', node: process.versions.node, marker: config.diagnosticMarker, decoderAvailable: this.decoderCheck.available } };
            }, false);
        }
        browse(request, signal) {
            // Do not queue starts behind a stopped operation: a new click is always required.
            return this.call('browse', request, signal, async (value, lifetime) => {
                if (this.exclusiveActive || this.mediaController || this.runnerValue?.busy || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                const config = configOf(this.currentConfig(), true);
                this.store().bindOwner(config.ownerUid);
                return this.browser().start(value.keyword, value.accountUid, config.ownerUid, lifetime);
            }, false);
        }
        browseHistory(request, signal) {
            return this.call('browseHistory', request, signal, async () => this.browseStore().history(), false);
        }
        saveBrowsePolicy(request, signal) {
            return this.call('saveBrowsePolicy', request, signal, async (value) => {
                if (this.mediaController || this.runnerValue?.busy || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                this.store().assertOwner(this.currentConfig().ownerUid);
                this.activity().savePolicy(value.policy, value.revision);
                return this.activity().settings();
            });
        }
        curateBrowse(request, signal) {
            return this.call('curateBrowse', request, signal, async (value, lifetime) => {
                if (this.exclusiveActive || this.mediaController || this.runnerValue?.busy || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                const controller = new AbortController();
                this.previewController = controller;
                const linked = AbortSignal.any([lifetime, controller.signal, AbortSignal.timeout(120_000)]);
                try {
                    const config = configOf(this.currentConfig(), true);
                    this.store().bindOwner(config.ownerUid);
                    const account = await this.platform().account(linked);
                    linked.throwIfAborted();
                    if (account.uid !== value.accountUid || account.uid === config.ownerUid)
                        throw new PilotError('ACCOUNT_CHANGED');
                    return await this.curator().preview(value.runId, account.uid, linked);
                }
                finally {
                    this.previewController = null;
                }
            }, false);
        }
        saveConfig(request, signal) {
            return this.call('saveConfig', request, signal, async (value) => {
                if (this.runnerValue?.busy || this.mediaController || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                if (value.revision !== this.revision())
                    throw new PilotError('CONFIG_REVISION_CONFLICT');
                const config = configOf(value.config);
                const store = this.store();
                store.assertOwner(config.ownerUid);
                if ((store.get('trialConsumed') || store.get('mediaTrialConsumed')) && !samePublicAuthorization(config, this.currentConfig()))
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
                if (this.runnerValue?.busy || this.mediaController || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                await this.retainAccountBinding();
                lifetime.throwIfAborted();
                return this.platform().loginStart(lifetime);
            });
        }
        loginPoll(request, signal) {
            return this.call('loginPoll', request, signal, async (value, lifetime) => {
                if (this.runnerValue?.busy || this.mediaController || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                return this.platform().loginPoll(value.loginId, lifetime);
            });
        }
        logout(request, signal) {
            return this.call('logout', request, signal, async () => { await this.runnerValue?.stop(); await this.retainAccountBinding(); await this.platform().logout(); return { removed: true }; });
        }
        preflight(request, signal) {
            return this.call('preflight', request, signal, async (_value, lifetime) => this.mediaOperation(lifetime, async (lifetime) => {
                if (this.runnerValue?.busy)
                    throw new PilotError('RUN_BUSY');
                const result = await this.runner().preflight(lifetime);
                return { account: result.account, video: { bvid: result.video.bvid, title: result.video.title, hasSubtitle: !!result.video.subtitle?.trim(), frameCount: result.video.visual?.frames.length ?? 0, durationSeconds: result.video.visual?.durationSeconds ?? null, audio: result.video.visual?.audio ?? 'not-transcribed' }, commentsRead: result.comments.length, revision: this.revision() };
            }));
        }
        models(request, signal) {
            return this.call('models', request, signal, async (_value, lifetime) => {
                const llm = this.owner.llm;
                const rows = await Promise.all(llm.listProviders().map(async (provider) => {
                    try {
                        const models = await llm.listModels(provider.id);
                        return { provider: provider.id, name: provider.name ?? provider.id, models };
                    }
                    catch {
                        return { provider: provider.id, name: provider.name ?? provider.id, models: [], unavailable: true };
                    }
                }));
                lifetime.throwIfAborted();
                return rows;
            });
        }
        saveModel(request, signal) {
            return this.call('saveModel', request, signal, async (value, lifetime) => {
                if (this.mediaController || this.runnerValue?.busy || this.modelValue?.busy)
                    throw new PilotError('RUN_BUSY');
                const llm = this.owner.llm;
                if (!llm.listProviders().some(p => p.id === value.provider) || !(await llm.listModels(value.provider)).some(m => m.id === value.model))
                    throw new PilotError('MODEL_NOT_IN_CATALOG');
                const info = await llm.resolveModelInfo(value.provider, value.model, lifetime);
                lifetime.throwIfAborted();
                this.store().assertOwner(this.currentConfig().ownerUid);
                this.store().set('modelSelection', JSON.stringify({ provider: value.provider, model: value.model }));
                return { saved: true, imageSupported: !!info.inputModalities?.includes('image') };
            });
        }
        checkOwnerRequest(request, signal) {
            return this.call('checkOwnerRequest', request, signal, async (_value, lifetime) => {
                const store = this.store(), config = this.currentConfig();
                if (!store.get('ownerVideoBaselineAt'))
                    store.set('ownerVideoBaselineAt', String(Date.now()));
                const result = await this.ownerContext(lifetime);
                const found = result.comments.filter(c => isOwnerVideoRequest(c, config.ownerUid, result.account.uid, Number(store.get('ownerVideoBaselineAt'))) && !store.get('ownerVideoRequestUsed:' + c.id)).sort((a, b) => b.createdAt - a.createdAt)[0];
                if (found)
                    store.set('ownerVideoRequest', JSON.stringify({ id: found.id, accountUid: result.account.uid, bvid: result.video.bvid, at: found.createdAt }));
                return { found: !!found, baselineAt: store.get('ownerVideoBaselineAt') };
            });
        }
        inspectVideo(request, signal) {
            return this.inspect(request, signal, false);
        }
        calibrateVideo(request, signal) {
            return this.inspect(request, signal, true);
        }
        inspect(request, signal, calibration) {
            return this.call(calibration ? 'calibrateVideo' : 'inspectVideo', request, signal, async (requestValue, lifetime) => this.mediaOperation(lifetime, async (lifetime) => {
                if (this.runnerValue?.busy)
                    throw new PilotError('RUN_BUSY');
                const store = this.store();
                if (calibration)
                    store.assertCalibration(requestValue.revision);
                else {
                    if (store.get('videoInspection'))
                        throw new PilotError('VIDEO_INSPECTION_ALREADY_CONSUMED');
                    if (store.budget().grant !== 'initial')
                        throw new PilotError('MODEL_BUDGET_EXHAUSTED');
                }
                const config = configOf(this.currentConfig(), true), result = await this.requestedVideo(lifetime);
                if (!result.video.visual?.frames.length && !result.video.subtitle?.trim())
                    throw new PilotError('VIDEO_CONTENT_UNAVAILABLE');
                if (calibration)
                    store.matchInspection(result.account.uid, result.video);
                const budget = store.budget();
                if (budget.used >= budget.total || budget.byPurpose.public >= 3)
                    throw new PilotError('MODEL_BUDGET_EXHAUSTED');
                // This explicit read-only analysis spends the existing public request budget. It never rearms a trial.
                store.set('videoInspectionConsumed', 'true');
                const allFrames = result.video.visual?.frames;
                // Calibration compares isolated first/middle/last frames in one request, never a model loop.
                const frames = allFrames?.length ? [...new Set([0, Math.floor(allFrames.length / 2), allFrames.length - 1])].map(i => allFrames[i]) : allFrames;
                const inputMaterial = publicVideo({ ...result.video, ...(result.video.visual && frames ? { visual: { ...result.video.visual, frames } } : {}) });
                store.set('ownerVideoRequestUsed:' + result.ownerRequestId, 'true');
                const answer = await this.model().ask({ purpose: 'public', persona: config.persona, frames, calibrationRevision: calibration ? requestValue.revision : undefined,
                    prompt: `${MEDIA_INSTRUCTION}${calibration ? '本次只核对所附的独立采样帧；分别描述每张帧中可见的主体姿态与环境，看不清就写无法判断。不要把不同帧的姿态混在一起。' : ''}用简短答案概述实际可见内容，不需要逐帧详解或识别作品名称。总字数不超过250字，观察最多3项。仅返回 JSON：{"summary":"简短概述","observations":[{"atSeconds":0,"description":"该时刻实际可见的内容"}],"limitations":["音频未转写"]}。观察时刻必须来自所提供的采样帧。\n` + JSON.stringify(inputMaterial) }, lifetime);
                lifetime.throwIfAborted();
                let parsed;
                try {
                    parsed = JSON.parse(answer.text);
                }
                catch {
                    throw new PilotError('INVALID_VIDEO_ANALYSIS');
                }
                const value = parsed;
                const times = frames?.map(f => f.atSeconds) ?? [];
                if (!value || typeof value.summary !== 'string' || value.summary.length > 2000 || !Array.isArray(value.observations) || value.observations.length > 12 ||
                    value.observations.some((o) => !o || typeof o.atSeconds !== 'number' || typeof o.description !== 'string' || o.description.length > 1000 || !times.some(t => Math.abs(t - o.atSeconds) < 0.1)) ||
                    !Array.isArray(value.limitations) || value.limitations.length > 12 || value.limitations.some((s) => typeof s !== 'string' || s.length > 1000))
                    throw new PilotError('INVALID_VIDEO_ANALYSIS');
                const report = { video: `https://www.bilibili.com/video/${config.bvid}/`, accountUid: result.account.uid, material: publicVideo(result.video), inputFrameTimes: times, analysis: { summary: value.summary, observations: value.observations.map((o) => ({ atSeconds: o.atSeconds, description: o.description })), limitations: value.limitations }, audio: 'not-transcribed', sessionId: answer.sessionId };
                store.set('videoInspection', JSON.stringify(report));
                return report;
            }));
        }
        videoEvidence(request, signal) {
            return this.call('videoEvidence', request, signal, async (_value, lifetime) => this.mediaOperation(lifetime, async (lifetime) => {
                const store = this.store();
                if (!store.inspectionRevision())
                    throw new PilotError('VIDEO_INSPECTION_REQUIRED');
                const result = await this.requestedVideo(lifetime, true);
                store.matchInspection(result.account.uid, result.video);
                lifetime.throwIfAborted();
                const revision = store.inspectionRevision();
                store.set('videoEvidenceViewed', revision);
                return { revision, subtitle: result.video.subtitle, frames: (result.video.visual?.frames ?? []).map(f => ({ atSeconds: f.atSeconds, image: 'data:image/jpeg;base64,' + Buffer.from(f.jpeg).toString('base64') })) };
            }));
        }
        reviewVideo(request, signal) {
            return this.call('reviewVideo', request, signal, async (value) => {
                if (this.runnerValue?.busy)
                    throw new PilotError('RUN_BUSY');
                this.store().recordVideoReview(value.revision, value.decision, value.note);
                return { saved: true };
            });
        }
        chat(request, signal) {
            return this.call('chat', request, signal, async (value, lifetime) => {
                // Starts are not queued: a stop cannot accidentally release another
                // already queued chat into a fresh model request.
                if (this.exclusiveActive || this.chatController || this.mediaController || this.runnerValue?.busy || this.modelValue?.busy)
                    throw new PilotError('MODEL_BUSY');
                const config = configOf(this.currentConfig());
                this.store().bindOwner(config.ownerUid);
                if (!new PrivateChatBudget(this.store()).status(config.ownerUid).enabled)
                    throw new PilotError('PRIVATE_CHAT_BUDGET_EXHAUSTED');
                const controller = new AbortController();
                this.chatController = controller;
                try {
                    return await this.model().ask({ purpose: 'private', persona: config.persona, prompt: value.text }, AbortSignal.any([lifetime, controller.signal]));
                }
                finally {
                    this.chatController = null;
                }
            }, false);
        }
        start(request, signal) {
            return this.call('start', request, signal, async (value, lifetime) => {
                if (value.revision !== this.revision())
                    throw new PilotError('CONFIG_REVISION_CONFLICT');
                return this.runner().start(value.accountUid, lifetime);
            });
        }
        startMediaTrial(request, signal) {
            return this.call('startMediaTrial', request, signal, async (value, lifetime) => {
                if (value.revision !== this.revision())
                    throw new PilotError('CONFIG_REVISION_CONFLICT');
                if (!this.store().get('videoInspection'))
                    throw new PilotError('MEDIA_TRIAL_NOT_READY');
                return this.runner().start(value.accountUid, lifetime, 'media-trial-2');
            });
        }
        stop(request, signal) {
            return this.call('stop', request, signal, async () => { this.chatController?.abort(); this.modelValue?.cancelPrivate(); this.previewController?.abort(); this.mediaController?.abort(); this.browseRunnerValue?.stop(); await this.runnerValue?.stop(); return { stopped: true }; }, false);
        }
        reconcile(request, signal) {
            return this.call('reconcile', request, signal, async (_value, lifetime) => { if (this.runnerValue?.busy)
                throw new PilotError('RUN_BUSY'); await this.runner().reconcile(lifetime); return { checked: true }; });
        }
        async shutdown() {
            this.lifetime.abort();
            this.browseRunnerValue?.stop();
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