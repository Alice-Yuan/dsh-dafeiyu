import { ActivityStore } from './activity-store.js';
import type { PreviewModel } from './curation.js';
export interface OwnThread {
    id: string;
    uid: string;
    aid: string;
    createdAt: number;
    text: string;
}
export interface ReplyInput {
    id: string;
    uid: string;
    aid: string;
    root: string;
    parent: string;
    createdAt: number;
    text: string;
}
export declare function eligibleReplies(account: string, threads: OwnThread[], inputs: ReplyInput[], baseline: number, now: number, store: ActivityStore): ReplyInput[];
export declare function previewReplies(store: ActivityStore, model: PreviewModel, source: string, account: string, threads: OwnThread[], inputs: ReplyInput[], baseline: number, now: number, signal: AbortSignal): Promise<import("./contracts.js").PreviewRound | null>;
