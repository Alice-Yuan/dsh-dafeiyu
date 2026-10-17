import { DomainError, } from '../core/contracts.js';
export class DeterministicModel {
    mode = 'mock';
    contexts = [];
    async decide(context, signal) {
        signal.throwIfAborted();
        this.contexts.push(structuredClone(context));
        return context.event.revision === context.lastRevision
            ? { kind: 'skip', reason: 'unchanged' }
            : { kind: 'tool', name: 'read_project_update', projectId: context.event.projectId };
    }
    async compose(update, signal) {
        signal.throwIfAborted();
        return `你关注的 ${update.projectId} 更新到 ${update.revision}：${update.summary}`;
    }
}
export class MockPlatform {
    mode = 'mock';
    reads = [];
    updates = new Map();
    constructor(updates) {
        for (const update of updates)
            this.updates.set(update.projectId, { ...update });
    }
    async readProjectUpdate(projectId, signal) {
        signal.throwIfAborted();
        this.reads.push(projectId);
        const update = this.updates.get(projectId);
        if (!update)
            throw new DomainError('MOCK_PROJECT_MISSING');
        return { ...update };
    }
}
export class MockOwner {
    loseAcknowledgement;
    mode = 'mock';
    messages = [];
    constructor(loseAcknowledgement = false) {
        this.loseAcknowledgement = loseAcknowledgement;
    }
    async deliver(message, signal) {
        signal.throwIfAborted();
        this.messages.push(structuredClone(message));
        if (this.loseAcknowledgement)
            throw new DomainError('SIMULATED_ACK_LOSS');
        return { kind: 'accepted', id: 'mock-receipt:' + message.actionId, simulation: true };
    }
}
//# sourceMappingURL=mock.js.map