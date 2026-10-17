import { DomainError, assertId, assertText, } from './contracts.js';
export class DaFeiYu {
    store;
    ports;
    accepting = true;
    pending = 0;
    paused = false;
    tail = Promise.resolve();
    stop = new AbortController();
    closing;
    ownerUid;
    limits;
    constructor(store, ownerUid, ports, limits) {
        this.store = store;
        this.ports = ports;
        assertId(ownerUid);
        if (Object.values(ports).some(port => port.mode !== 'mock'))
            throw new DomainError('MOCK_ONLY');
        for (const n of [limits.maxCalls, limits.maxPending, limits.timeoutMs]) {
            if (!Number.isSafeInteger(n) || n < 1)
                throw new DomainError('INVALID_LIMITS');
        }
        if (store.maxCalls !== limits.maxCalls || store.ownerUid !== ownerUid) {
            throw new DomainError('STORE_CONFIG_MISMATCH');
        }
        this.ownerUid = ownerUid;
        this.limits = Object.freeze({ ...limits });
    }
    enqueue(work) {
        if (this.paused)
            return Promise.reject(new DomainError('PAUSED_UNKNOWN'));
        if (!this.accepting)
            return Promise.reject(new DomainError('CLOSED'));
        if (this.pending >= this.limits.maxPending)
            return Promise.reject(new DomainError('QUEUE_FULL'));
        this.pending++;
        const job = this.tail.then(() => {
            this.stop.signal.throwIfAborted();
            if (this.paused)
                throw new DomainError('PAUSED_UNKNOWN');
            return work();
        }).finally(() => { this.pending--; });
        this.tail = job.catch(() => undefined);
        return job;
    }
    // Only trusted UI/host adapters may call this ingress. External payloads cannot select it.
    receiveOwner(actorUid, command) {
        assertId(actorUid);
        assertId(command.id);
        assertId(command.projectId);
        const input = Object.freeze({ ...command });
        return this.enqueue(async () => {
            const id = 'owner:' + actorUid + ':' + input.id;
            if (!this.store.begin(id, 'mock-owner-ui', 'owner_private'))
                return { status: 'duplicate', eventId: id };
            if (actorUid !== this.ownerUid || input.kind !== 'watch_project') {
                this.store.finish(id, 'denied', 'unauthorized_owner_command');
                return { status: 'denied', eventId: id };
            }
            this.store.watch(input.projectId, id);
            this.store.finish(id, 'watched');
            return { status: 'watched', eventId: id };
        });
    }
    receiveExternal(raw) {
        if (!raw || typeof raw !== 'object')
            throw new DomainError('INVALID_INPUT');
        const e = raw;
        // No caller-supplied authority, scope, tool or permission fields are accepted.
        if (Object.keys(e).some(k => !['id', 'projectId', 'revision', 'text'].includes(k))) {
            throw new DomainError('UNTRUSTED_FIELDS');
        }
        assertId(e.id);
        assertId(e.projectId);
        assertId(e.revision);
        assertText(e.text, 4000);
        const event = Object.freeze({
            id: e.id, projectId: e.projectId, revision: e.revision, text: e.text,
        });
        return this.enqueue(() => this.process(event));
    }
    context(event, audience) {
        return { mode: 'mock', event: { ...event }, lastRevision: this.store.watched(event.projectId)?.revision ?? null,
            memories: this.store.retrieve(audience, 'mock') };
    }
    async invoke(fn) {
        this.stop.signal.throwIfAborted();
        const controller = new AbortController();
        const stop = () => controller.abort(new DomainError('CANCELLED'));
        this.stop.signal.addEventListener('abort', stop, { once: true });
        if (this.stop.signal.aborted)
            stop();
        let timer;
        let abort;
        const cancelled = new Promise((_, reject) => {
            abort = () => reject(controller.signal.reason);
            controller.signal.addEventListener('abort', abort, { once: true });
            if (controller.signal.aborted)
                abort();
            timer = setTimeout(() => { this.paused = true; controller.abort(new DomainError('TIMEOUT')); }, this.limits.timeoutMs);
        });
        // Every supplied port must observe cancellation. Race also bounds uncooperative ports.
        try {
            return await Promise.race([fn(controller.signal), cancelled]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
            if (abort)
                controller.signal.removeEventListener('abort', abort);
            this.stop.signal.removeEventListener('abort', stop);
        }
    }
    async process(event) {
        const id = 'external:' + event.id;
        if (!this.store.begin(id, 'mock-platform', 'public_episode'))
            return { status: 'duplicate', eventId: id };
        if (!this.store.watched(event.projectId)) {
            this.store.finish(id, 'skipped', 'not_watched');
            return { status: 'skipped', eventId: id };
        }
        if (this.store.hasUnresolved()) {
            this.store.finish(id, 'unknown', 'prior_delivery_requires_review');
            return { status: 'unknown', eventId: id };
        }
        // At most two model calls, one read tool and one mock delivery. Budget persists across restarts.
        if (!this.store.reserve(4)) {
            this.store.finish(id, 'skipped', 'budget_exhausted');
            return { status: 'skipped', eventId: id, reason: 'budget_exhausted' };
        }
        const actionId = 'mock-message:' + event.id;
        let calls = 0;
        let deliveryStarted = false;
        try {
            calls++;
            const decision = await this.invoke(s => this.ports.model.decide(this.context(event, 'owner'), s));
            if (decision.kind === 'skip') {
                this.store.settle(4, calls);
                this.store.finish(id, 'skipped', 'model_no_change');
                return { status: 'skipped', eventId: id };
            }
            if (decision.kind !== 'tool' || decision.name !== 'read_project_update' ||
                decision.projectId !== event.projectId)
                throw new DomainError('TOOL_DENIED');
            calls++;
            const update = await this.invoke(s => this.ports.platform.readProjectUpdate(event.projectId, s));
            this.validateUpdate(update, event);
            calls++;
            const description = await this.invoke(s => this.ports.model.compose(update, s));
            assertText(description, 4000);
            const body = '[模拟投递 / 假模型] ' + description;
            this.store.prepare(actionId, id, event.projectId, event.revision, body);
            this.stop.signal.throwIfAborted();
            this.store.markSending(actionId);
            deliveryStarted = true;
            calls++;
            const receipt = await this.invoke(s => this.ports.owner.deliver({
                actionId, ownerUid: this.ownerUid, body, simulation: true,
            }, s));
            if (receipt.kind !== 'accepted' || receipt.simulation !== true)
                throw new DomainError('INVALID_RECEIPT');
            assertId(receipt.id);
            this.store.accept(actionId, receipt.id);
            this.store.settle(4, calls);
            return { status: 'notified', eventId: id };
        }
        catch (error) {
            const code = error instanceof DomainError ? error.code : 'ADAPTER_FAILURE';
            if (deliveryStarted) {
                this.paused = true;
                this.store.markUnknown(actionId);
                this.store.finish(id, 'unknown', 'delivery_requires_review');
                return { status: 'unknown', eventId: id };
            }
            this.store.cancelPending(actionId);
            // Timeout/cancellation keep all reserved calls charged: unknown work is not free.
            if (!this.stop.signal.aborted && !['TIMEOUT', 'ADAPTER_FAILURE'].includes(code))
                this.store.settle(4, calls);
            const status = this.stop.signal.aborted ? 'cancelled' : 'denied';
            this.store.finish(id, status, code);
            return { status, eventId: id, reason: code };
        }
    }
    validateUpdate(update, event) {
        if (update.projectId !== event.projectId || update.revision !== event.revision) {
            throw new DomainError('UPDATE_MISMATCH');
        }
        assertText(update.summary, 3000);
    }
    close() {
        if (!this.closing) {
            this.accepting = false;
            this.stop.abort(new DomainError('CANCELLED'));
            this.closing = this.tail.then(() => this.store.close());
        }
        return this.closing;
    }
}
//# sourceMappingURL=engine.js.map