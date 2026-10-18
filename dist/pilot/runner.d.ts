import { type Account, type BiliPort, type Comment, type PilotConfig, type PilotModel, type VideoMaterial } from './contracts.js';
import { PilotStore, type Run, type Grant } from './store.js';
interface Options {
    now?: () => number;
    sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}
export declare class PilotRunner {
    private readonly store;
    private readonly platform;
    private readonly model;
    private readonly config;
    private controller;
    private work;
    private starting;
    private readonly now;
    private readonly sleep;
    constructor(store: PilotStore, platform: BiliPort, model: PilotModel, config: () => PilotConfig, options?: Options);
    get busy(): boolean;
    preflight(signal: AbortSignal): Promise<{
        account: Account;
        video: VideoMaterial;
        comments: Comment[];
    }>;
    start(expectedAccount: string, signal: AbortSignal, grant?: Grant): Promise<Run>;
    private readPages;
    private active;
    private execute;
    private decide;
    reconcile(signal: AbortSignal, runId?: string): Promise<void>;
    private finish;
    private report;
    stop(): Promise<void>;
    idle(): Promise<void>;
}
export {};
