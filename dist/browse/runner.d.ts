import { type BrowsePort, type BrowseRun } from './contracts.js';
import { BrowseStore } from './store.js';
export declare class BrowseRunner {
    private readonly store;
    private readonly platform;
    private readonly now;
    private controller;
    constructor(store: BrowseStore, platform: BrowsePort, now?: () => number);
    get busy(): boolean;
    stop(): void;
    start(keyword: string, expectedAccount: string, ownerUid: string, signal: AbortSignal): Promise<BrowseRun>;
}
