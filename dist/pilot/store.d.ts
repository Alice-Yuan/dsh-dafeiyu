import { DatabaseSync } from 'node:sqlite';
import { type PilotConfig, type Purpose, type SendTarget, type Visibility } from './contracts.js';
import type { VideoMaterial } from './contracts.js';
export type Grant = 'initial' | 'media-trial-2';
export interface Run {
    id: string;
    accountUid: string;
    config: PilotConfig;
    startedAt: number;
    deadline: number;
    state: string;
    reason: string;
    root: string;
    grant?: Grant;
}
export interface Action {
    id: string;
    runId: string;
    eventId: string;
    kind: 'comment' | 'reply';
    target: SendTarget;
    text: string;
    state: string;
    remoteId: string;
    selfVisible: boolean | null;
    publicVisible: boolean | null;
    reason: string;
}
export declare class PilotStore {
    readonly db: DatabaseSync;
    private readonly token;
    private closed;
    constructor(path: string);
    transaction<T>(fn: () => T): T;
    get(key: string): string | null;
    set(key: string, value: string): void;
    assertOwner(ownerUid: string): void;
    bindOwner(ownerUid: string): void;
    boundAccountUid(): string | null;
    bindAccount(ownerUid: string, accountUid: string): void;
    inspectionRevision(): string;
    matchInspection(accountUid: string, video: VideoMaterial): void;
    recordVideoReview(revision: string, decision: 'approved' | 'rejected', note: string): void;
    assertVideoReviewed(): void;
    budget(grant?: Grant): {
        used: number;
        total: number;
        byPurpose: Record<Purpose, number>;
        lifetimeUsed: number;
        grant: Grant;
    };
    assertCalibration(revision: string): void;
    reserveRequest(purpose: Purpose, now: number, calibrationRevision?: string): string;
    begin(config: PilotConfig, accountUid: string, now: number, grant?: Grant): Run;
    runs(): Run[];
    run(id: string): Run;
    saveRun(run: Run): void;
    seen(runId: string, id: string): boolean;
    remember(runId: string, ids: string[]): void;
    actions(runId?: string): Action[];
    reserveAction(runId: string, eventId: string, kind: Action['kind'], target: SendTarget, text: string, now: number): Action;
    assertActive(run: Run, now: number): void;
    saveAction(action: Action): void;
    visibility(action: Action, status: Visibility): void;
    close(): void;
}
