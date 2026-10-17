import { type ModelPort, type ModelContext, type Decision, type ProjectUpdate, type PlatformPort, type OwnerPort, type OwnerMessage, type Receipt } from '../core/contracts.js';
export declare class DeterministicModel implements ModelPort {
    readonly mode: "mock";
    readonly contexts: ModelContext[];
    decide(context: ModelContext, signal: AbortSignal): Promise<Decision>;
    compose(update: ProjectUpdate, signal: AbortSignal): Promise<string>;
}
export declare class MockPlatform implements PlatformPort {
    readonly mode: "mock";
    readonly reads: string[];
    private readonly updates;
    constructor(updates: readonly ProjectUpdate[]);
    readProjectUpdate(projectId: string, signal: AbortSignal): Promise<ProjectUpdate>;
}
export declare class MockOwner implements OwnerPort {
    private readonly loseAcknowledgement;
    readonly mode: "mock";
    readonly messages: OwnerMessage[];
    constructor(loseAcknowledgement?: boolean);
    deliver(message: OwnerMessage, signal: AbortSignal): Promise<Receipt>;
}
