import { SqliteStore } from '../storage/sqlite.js';
import { type Limits, type Outcome, type Ports, type ModelContext, type UpdateEvent, type Audience } from './contracts.js';
export declare class DaFeiYu {
    private readonly store;
    private readonly ports;
    private accepting;
    private pending;
    private paused;
    private tail;
    private stop;
    private closing;
    private readonly ownerUid;
    private readonly limits;
    constructor(store: SqliteStore, ownerUid: string, ports: Ports, limits: Limits);
    private enqueue;
    receiveOwner(actorUid: string, command: {
        id: string;
        kind: string;
        projectId: string;
    }): Promise<Outcome>;
    receiveExternal(raw: unknown): Promise<Outcome>;
    context(event: UpdateEvent, audience: Audience): ModelContext;
    private invoke;
    private process;
    private validateUpdate;
    close(): Promise<void>;
}
