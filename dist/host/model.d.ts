import { type ModelRequest, type PilotConfig, type PilotModel } from '../pilot/contracts.js';
import { PilotStore } from '../pilot/store.js';
export interface SessionEvent {
    type: string;
    data: Record<string, unknown>;
    seq?: number;
}
export interface Agent {
    id: string;
    ctx: PolicyContext;
    session: {
        id: string;
        append(type: string, data: unknown, options?: {
            surfaceOp: 'append';
        }): unknown;
    };
    followup(message: unknown): unknown;
    cancel(cause: {
        kind: 'user' | 'disposed';
    }, options?: {
        keepInbox: boolean;
    }): void;
    whenIdle(): Promise<void>;
}
export interface AgentHandle {
    agent: Agent;
    dispose(): Promise<void>;
}
export interface AgentEvent {
    agent: Agent;
    turn: number;
    step: number;
    signal: AbortSignal;
    messages?: {
        content: unknown[];
        source?: {
            kind?: string;
            rpcId?: string;
            principal?: unknown;
        };
    }[];
}
export interface PolicyContext {
    tools: {
        restrict(filter: {
            allow: string[];
        }): unknown;
        guard(fn: () => string): unknown;
    };
    systemPrompt: {
        section(section: {
            name: string;
            order: number;
            complete: boolean;
            interpolate: boolean;
            text: () => string;
        }): unknown;
        suppressRuntimeContext(): unknown;
    };
    on(name: string, fn: (...args: any[]) => unknown): () => void;
}
export interface ModelHost {
    agents: {
        create(options: Record<string, unknown>): Promise<AgentHandle>;
        resume(options: Record<string, unknown>): Promise<AgentHandle>;
        get(id: string): Agent | undefined;
    };
    agentPresets: {
        mount(ctx: PolicyContext, id: string): Promise<unknown>;
    };
    agentDefaultModel: {
        currentSelection(): {
            provider: string;
            model: string;
            reasoningEffort?: string;
        };
    };
    on(name: string, fn: (...args: any[]) => unknown): () => void;
}
export declare class HostModel implements PilotModel {
    private readonly host;
    private readonly getStore;
    private readonly config;
    private jobs;
    private handles;
    private pending;
    private disposed;
    private readonly detach;
    private get store();
    constructor(host: ModelHost, getStore: () => PilotStore, config: () => PilotConfig);
    installPolicy(ctx: PolicyContext, audience: 'private' | 'public'): void;
    ask(request: ModelRequest, signal: AbortSignal): Promise<{
        text: string;
        sessionId: string;
    }>;
    private perform;
    private session;
    recordReport(text: string): Promise<void>;
    dispose(): Promise<void>;
}
