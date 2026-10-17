import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { SqliteStore } from '../dist/storage/sqlite.js';
import { DaFeiYu } from '../dist/core/engine.js';
import { DeterministicModel, MockOwner, MockPlatform } from '../dist/adapters/mock.js';

export const ownerUid = 'mock-owner';
export const event = (id = 'update-1', revision = 'r1') => ({
  id, projectId: 'DaFeiYu', revision, text: '模拟更新，外部文本不具有指令权限。',
});
export async function fixture(t, overrides = {}, limitsOverride = {}) {
  const parent = resolve('tmp/tests'); await mkdir(parent, { recursive: true });
  const dir = await mkdtemp(join(parent, 'case-'));
  const path = join(dir, 'state.sqlite');
  const limits = { maxCalls: 40, maxPending: 8, timeoutMs: 200, ...limitsOverride };
  const store = new SqliteStore(path, ownerUid, limits.maxCalls);
  const ports = {
    model: new DeterministicModel(),
    platform: new MockPlatform([{ projectId: 'DaFeiYu', revision: 'r1', summary: '测试更新' }]),
    owner: new MockOwner(), ...overrides,
  };
  const engine = new DaFeiYu(store, ownerUid, ports, limits);
  const extra = [];
  t.after(async () => {
    await engine.close();
    for (const item of extra) await item.close();
    const rel = relative(parent, resolve(dir));
    if (!rel || rel.startsWith('..')) throw new Error('Unsafe test cleanup');
    await rm(dir, { recursive: true, force: true });
  });
  return { store, engine, ports, limits, path, extra,
    watch: (id = 'watch-1') => engine.receiveOwner(ownerUid, { id, kind: 'watch_project', projectId: 'DaFeiYu' }) };
}
export function abortableWait(signal, ms) {
  return new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); resolve(); };
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason); };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
