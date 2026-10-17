export type Scope = 'owner_private' | 'public_persona' | 'public_episode';
export type Audience = 'owner' | 'public';
export interface Memory {
    id: string;
    scope: Scope;
    platform: string;
    text: string;
    source: string;
}
export interface UpdateEvent {
    id: string;
    projectId: string;
    revision: string;
    text: string;
}
export interface ProjectUpdate {
    projectId: string;
    revision: string;
    summary: string;
}
export interface ModelContext {
    mode: 'mock';
    event: Readonly<UpdateEvent>;
    lastRevision: string | null;
    memories: readonly Memory[];
}
export type Decision = {
    kind: 'skip';
    reason: string;
} | {
    kind: 'tool';
    name: string;
    projectId: string;
};
export interface ModelPort {
    readonly mode: 'mock' | 'production';
    decide(input: ModelContext, signal: AbortSignal): Promise<Decision>;
    compose(update: ProjectUpdate, signal: AbortSignal): Promise<string>;
}
export interface PlatformPort {
    readonly mode: 'mock' | 'production';
    readProjectUpdate(projectId: string, signal: AbortSignal): Promise<ProjectUpdate>;
}
export interface OwnerMessage {
    actionId: string;
    ownerUid: string;
    body: string;
    simulation: true;
}
export interface Receipt {
    kind: 'accepted';
    id: string;
    simulation: true;
}
export interface OwnerPort {
    readonly mode: 'mock' | 'production';
    deliver(message: OwnerMessage, signal: AbortSignal): Promise<Receipt>;
}
export interface Ports {
    model: ModelPort;
    platform: PlatformPort;
    owner: OwnerPort;
}
export interface Limits {
    maxCalls: number;
    maxPending: number;
    timeoutMs: number;
}
export interface Outcome {
    status: 'watched' | 'duplicate' | 'skipped' | 'notified' | 'denied' | 'unknown' | 'cancelled';
    eventId: string;
    reason?: string;
}
export declare class DomainError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function assertText(value: unknown, limit?: number): asserts value is string;
export declare function assertId(value: unknown): asserts value is string;
