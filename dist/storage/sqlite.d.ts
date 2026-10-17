import { type Audience, type Memory, type Outcome } from '../core/contracts.js';
export type OutboxState = 'pending' | 'sending' | 'accepted' | 'unknown' | 'cancelled';
export declare class SqliteStore {
    readonly path: string;
    private db;
    private lockFd;
    private closed;
    constructor(path: string, ownerUid: string, maxCalls: number);
    transaction<T>(fn: () => T): T;
    begin(id: string, source: string, scope: string): boolean;
    finish(id: string, status: Outcome['status'], reason?: string): void;
    watch(project: string, source: string): void;
    watched(project: string): {
        revision: string | null;
    } | undefined;
    get maxCalls(): number;
    get ownerUid(): string;
    get calls(): number;
    reserve(calls: number): boolean;
    settle(reserved: number, actual: number): void;
    prepare(id: string, eventId: string, project: string, revision: string, body: string): void;
    markSending(id: string): void;
    markUnknown(id: string): void;
    cancelPending(id: string): void;
    accept(id: string, receipt: string): void;
    hasUnresolved(): boolean;
    putFixtureMemory(memory: Memory): void;
    retrieve(audience: Audience, platform: string): Memory[];
    snapshot(): {
        calls: number;
        inbox: unknown[];
        outbox: unknown[];
        audit: unknown[];
    };
    private releaseLock;
    close(): void;
}
