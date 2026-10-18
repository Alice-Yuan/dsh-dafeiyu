import { PilotStore } from './store.js';
export declare const PRIVATE_CHAT_LIMITS: Readonly<{
    maximumBatch: 20;
    outputTokens: 2048;
}>;
export declare class PrivateChatBudget {
    private readonly store;
    constructor(store: PilotStore);
    private owner;
    status(ownerUid: string): {
        grantId: null;
        limit: number;
        used: number;
        remaining: number;
        lifetimeUsed: number;
        outputTokens: 2048;
        enabled: boolean;
    } | {
        grantId: string;
        limit: number;
        used: number;
        remaining: number;
        lifetimeUsed: number;
        outputTokens: 2048;
        enabled: boolean;
    };
    authorize(ownerUid: string, grantId: string, requests: number, now: number): void;
    reserve(ownerUid: string, now: number): string;
    revoke(ownerUid: string): void;
}
