import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DaFeiYu } from './core/engine.js';
import { SqliteStore } from './storage/sqlite.js';
import { DeterministicModel, MockOwner, MockPlatform } from './adapters/mock.js';
const parent = resolve('tmp/demo');
mkdirSync(parent, { recursive: true });
const dir = await mkdtemp(join(parent, 'run-'));
const dbPath = join(dir, 'state.sqlite');
const ownerUid = 'mock-owner';
const limits = { maxCalls: 12, maxPending: 8, timeoutMs: 1000 };
const event = { id: 'update-1', projectId: 'DaFeiYu', revision: 'r1', text: '模拟项目有更新' };
function open() {
    const store = new SqliteStore(dbPath, ownerUid, limits.maxCalls);
    const owner = new MockOwner();
    const platform = new MockPlatform([{ projectId: 'DaFeiYu', revision: 'r1', summary: '新增状态保存与去重。' }]);
    const engine = new DaFeiYu(store, ownerUid, { model: new DeterministicModel(), platform, owner }, limits);
    return { store, owner, platform, engine };
}
let app = open();
try {
    const watch = await app.engine.receiveOwner(ownerUid, { id: 'watch-1', kind: 'watch_project', projectId: 'DaFeiYu' });
    const first = await app.engine.receiveExternal(event);
    const duplicate = await app.engine.receiveExternal(event);
    const messages = [...app.owner.messages];
    const snapshot = app.store.snapshot();
    await app.engine.close();
    app = open();
    const afterRestart = await app.engine.receiveExternal(event);
    console.log(JSON.stringify({
        label: 'SIMULATION ONLY / 假模型与模拟投递，不是真实 DSH',
        watch, first, duplicate, afterRestart, messages, snapshot,
        restartDeliveryCount: app.owner.messages.length,
    }, null, 2));
}
finally {
    await app.engine.close();
    const safeRelative = relative(parent, resolve(dir));
    if (!safeRelative || safeRelative.startsWith('..'))
        throw new Error('Unsafe demo cleanup');
    await rm(dir, { recursive: true, force: true });
}
//# sourceMappingURL=demo.js.map