import { BrowseStore } from './store.js';
import { ActivityStore } from './activity-store.js';
export type PreviewModel = (prompt: string, signal: AbortSignal, reserve: () => void) => Promise<{
    text: string;
}>;
export declare class Curator {
    private readonly readings;
    private readonly activity;
    private readonly model;
    private readonly now;
    private readonly persona;
    private running;
    constructor(readings: BrowseStore, activity: ActivityStore, model: PreviewModel, now?: () => number, persona?: () => string);
    preview(runId: string, account: string, signal: AbortSignal): Promise<import("./contracts.js").PreviewRound>;
}
