import { PilotStore } from '../pilot/store.js';
import { type BrowsePolicy } from './policy.js';
import type { PreviewRound } from './contracts.js';
export declare class ActivityStore {
    private readonly pilot;
    constructor(pilot: PilotStore);
    private all;
    private write;
    round(id: string): PreviewRound;
    settings(): {
        policy: BrowsePolicy;
        revision: string;
    };
    savePolicy(input: unknown, revision: string): void;
    usage(account: string, at: number): {
        day: string;
        picked: number;
        remaining: number;
        requests: number;
        todayRequests: number;
        latest: PreviewRound | null;
    };
    picked(account: string, bvid: string): boolean;
    replied(account: string, root: string, uid: string, event: string): boolean;
    begin(kind: PreviewRound['kind'], source: string, account: string, at: number): PreviewRound;
    reserveRequest(id: string): void;
    finish(id: string, result: unknown, picks?: string[], replies?: {
        root: string;
        uid: string;
        id: string;
    }[]): PreviewRound;
    fail(id: string, cancelled: boolean, reason: string): void;
}
