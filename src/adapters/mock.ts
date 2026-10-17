import {
  DomainError, type ModelPort, type ModelContext, type Decision, type ProjectUpdate,
  type PlatformPort, type OwnerPort, type OwnerMessage, type Receipt,
} from '../core/contracts.js';

export class DeterministicModel implements ModelPort {
  readonly mode = 'mock' as const;
  readonly contexts: ModelContext[] = [];
  async decide(context: ModelContext, signal: AbortSignal): Promise<Decision> {
    signal.throwIfAborted();
    this.contexts.push(structuredClone(context));
    return context.event.revision === context.lastRevision
      ? { kind: 'skip', reason: 'unchanged' }
      : { kind: 'tool', name: 'read_project_update', projectId: context.event.projectId };
  }
  async compose(update: ProjectUpdate, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    return `你关注的 ${update.projectId} 更新到 ${update.revision}：${update.summary}`;
  }
}
export class MockPlatform implements PlatformPort {
  readonly mode = 'mock' as const;
  readonly reads: string[] = [];
  private readonly updates = new Map<string, ProjectUpdate>();
  constructor(updates: readonly ProjectUpdate[]) {
    for (const update of updates) this.updates.set(update.projectId, { ...update });
  }
  async readProjectUpdate(projectId: string, signal: AbortSignal): Promise<ProjectUpdate> {
    signal.throwIfAborted();
    this.reads.push(projectId);
    const update = this.updates.get(projectId);
    if (!update) throw new DomainError('MOCK_PROJECT_MISSING');
    return { ...update };
  }
}
export class MockOwner implements OwnerPort {
  readonly mode = 'mock' as const;
  readonly messages: OwnerMessage[] = [];
  constructor(private readonly loseAcknowledgement = false) {}
  async deliver(message: OwnerMessage, signal: AbortSignal): Promise<Receipt> {
    signal.throwIfAborted();
    this.messages.push(structuredClone(message));
    if (this.loseAcknowledgement) throw new DomainError('SIMULATED_ACK_LOSS');
    return { kind: 'accepted', id: 'mock-receipt:' + message.actionId, simulation: true };
  }
}
