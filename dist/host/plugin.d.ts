import { type Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type PilotConfig } from '../pilot/contracts.js';
import { type PolicyContext } from './model.js';
interface Ref<T> {
    get(): T;
}
type LiveConfig = {
    [K in keyof PilotConfig]: Ref<PilotConfig[K]>;
};
interface HostContext extends Context {
    profileContext: {
        dir: string;
    };
    configEditor: {
        edit(entry: unknown, change: (current: Record<string, unknown>) => unknown): Promise<void>;
    };
}
export declare const name = "dafeyu";
export declare const inject: string[];
export declare const Config: s<Schemastery.ObjectS<NoInfer<{
    ownerUid: s<string, string, "volatile-defined">;
    bvid: s<string, string, "volatile-defined">;
    persona: s<string, string, "volatile-defined">;
    diagnosticMarker: s<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    ownerUid: s<string, string, "volatile-defined">;
    bvid: s<string, string, "volatile-defined">;
    persona: s<string, string, "volatile-defined">;
    diagnosticMarker: s<string, string, "volatile-defined">;
}>>, "plain">;
export declare class DaFeiYuControl extends TypertRemoteService {
    private readonly owner;
    private readonly live;
    private storeValue;
    private modelValue;
    private runnerValue;
    private platformValue;
    private browseStoreValue;
    private browseRunnerValue;
    private mediaController;
    private readonly lifetime;
    private serial;
    private exclusiveActive;
    private operations;
    private decoderCheck;
    constructor(owner: HostContext, live: LiveConfig);
    currentConfig(): PilotConfig;
    private revision;
    private store;
    private platform;
    private model;
    private runner;
    private browseStore;
    private browser;
    private ownerContext;
    private requestedVideo;
    private mediaOperation;
    installPolicy(ctx: PolicyContext, audience: 'private' | 'public'): void;
    private call;
    status(request: unknown, signal: AbortSignal): Promise<unknown>;
    browse(request: unknown, signal: AbortSignal): Promise<unknown>;
    browseHistory(request: unknown, signal: AbortSignal): Promise<unknown>;
    saveConfig(request: unknown, signal: AbortSignal): Promise<unknown>;
    loginStart(request: unknown, signal: AbortSignal): Promise<unknown>;
    loginPoll(request: unknown, signal: AbortSignal): Promise<unknown>;
    logout(request: unknown, signal: AbortSignal): Promise<unknown>;
    preflight(request: unknown, signal: AbortSignal): Promise<unknown>;
    models(request: unknown, signal: AbortSignal): Promise<unknown>;
    saveModel(request: unknown, signal: AbortSignal): Promise<unknown>;
    checkOwnerRequest(request: unknown, signal: AbortSignal): Promise<unknown>;
    inspectVideo(request: unknown, signal: AbortSignal): Promise<unknown>;
    calibrateVideo(request: unknown, signal: AbortSignal): Promise<unknown>;
    private inspect;
    videoEvidence(request: unknown, signal: AbortSignal): Promise<unknown>;
    reviewVideo(request: unknown, signal: AbortSignal): Promise<unknown>;
    chat(request: unknown, signal: AbortSignal): Promise<unknown>;
    start(request: unknown, signal: AbortSignal): Promise<unknown>;
    startMediaTrial(request: unknown, signal: AbortSignal): Promise<unknown>;
    stop(request: unknown, signal: AbortSignal): Promise<unknown>;
    reconcile(request: unknown, signal: AbortSignal): Promise<unknown>;
    private shutdown;
}
export declare function apply(ctx: HostContext, config: LiveConfig): void;
export {};
