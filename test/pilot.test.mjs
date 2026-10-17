import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PilotStore } from '../dist/pilot/store.js';
import { PilotRunner } from '../dist/pilot/runner.js';
import { configOf, DEFAULT_CONFIG, intentOf, PilotError } from '../dist/pilot/contracts.js';

const config = { ...DEFAULT_CONFIG, ownerUid: '10001', bvid: 'BV1GJ411x7h7', diagnosticMarker: 'PRIVATE_MARKER_DO_NOT_PUBLISH' };
mkdirSync(resolve('tmp/tests'), { recursive: true });
function fixture(t, cleanup = true) {
  const path = join(mkdtempSync(resolve('tmp/tests/pilot-')), 'test.sqlite'); const store = new PilotStore(path);
  if (cleanup) t.after(() => store.close()); return { store, path };
}
function setup(t, changes = {}) {
  const { store, path } = fixture(t, false); let now = 100000; const inputs = []; const sent = [];
  const video = { bvid: config.bvid, aid: '20001', cid: '20002', title: '合成视频', description: '合成测试', subtitle: '这是无真实账号的测试材料。' };
  const platform = {
    account: async () => ({ uid: '30001', name: '合成机器人' }), video: async () => video,
    comments: async (_aid, root) => ({ comments: root === '0' ? [] : [1, 2].map(n => ({ id: '900719925474099' + n, uid: '40001', root, parent: root, text: '合成问题 ' + n, createdAt: now })), next: null }),
    send: async (target, text) => { sent.push({ target, text }); return { id: String(50000 + sent.length), root: target.root, parent: target.parent }; },
    verify: async () => ({ selfVisible: true, publicVisible: null }), ...changes,
  };
  const model = { recordReport: async text => { store.set('testReport', text); }, ask: async (req, signal) => { signal.throwIfAborted(); store.reserveRequest(req.purpose, now); inputs.push(req); return { text: req.purpose === 'summary' ? '合成汇报' : JSON.stringify({ kind: req.prompt.includes('"kind":"reply"') ? 'reply' : 'comment', text: '合成试验发言' }), sessionId: 'synthetic-session' }; }, dispose: async () => {} };
  const mutable = { ...config };
  const runner = new PilotRunner(store, platform, model, () => mutable, { now: () => now, sleep: async ms => { now += ms; } });
  t.after(async () => { await runner.stop(); store.close(); }); return { store, path, model, platform, runner, sent, inputs, mutable, advance: ms => { now += ms; } };
}
test('pilot config rejects malformed IDs, unknown fields and unbounded persona', () => {
  assert.deepEqual(configOf(config, true), config);
  for (const value of [{ ...config, ownerUid: 'nickname' }, { ...config, bvid: 'https://bad.test' }, { ...config, persona: 'x'.repeat(2001) }, { ...config, force: true }]) assert.throws(() => configOf(value));
  assert.throws(() => configOf(DEFAULT_CONFIG, true), /CONFIG_INCOMPLETE/);
});
test('pilot structured intentions do not accept force, other target, long output or tool actions', () => {
  for (const value of [{ kind: 'comment', text: 'x', force: true }, { kind: 'comment', text: 'x', bvid: 'other' }, { kind: 'comment', text: '鱼'.repeat(151) }, { kind: 'shell', command: 'fake' }, { kind: 'reply', text: 'x' }]) assert.throws(() => intentOf(JSON.stringify(value), 'comment'));
  assert.deepEqual(intentOf('{"kind":"skip","reason":"材料不足"}', 'comment'), { kind: 'skip', reason: '材料不足' });
});
test('pilot store preserves owner and request quotas across restarts and refuses concurrent writer', t => {
  const { store, path } = fixture(t); store.bindOwner(config.ownerUid);
  assert.throws(() => new PilotStore(path), /STORE_LOCKED/);
  store.reserveRequest('private', 1); for (let i = 0; i < 3; i++) store.reserveRequest('public', i); store.reserveRequest('summary', 1);
  assert.throws(() => store.reserveRequest('public', 4), /MODEL_BUDGET_EXHAUSTED/);
  assert.throws(() => store.assertOwner('999'), /STORE_CONFIG_MISMATCH/);
  store.close(); const reopened = new PilotStore(path); t.after(() => reopened.close());
  assert.equal(reopened.budget().used, 5); assert.throws(() => reopened.reserveRequest('private', 5));
});
test('pilot hard limits: one comment and two direct replies; no private marker in public input', async t => {
  const f = setup(t); await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.sent.length, 3); assert.equal(f.sent[0].target.root, '0');
  assert.equal(f.sent[1].target.root, '50001'); assert.equal(f.sent[1].target.parent, '9007199254740991');
  assert.equal(f.sent[2].target.parent, '9007199254740992');
  assert.ok(f.inputs.filter(x => x.purpose === 'public').every(x => !x.prompt.includes(config.diagnosticMarker)));
  assert.ok(f.inputs[1].prompt.includes('"threadRoot":{"id":"50001","text":"合成试验发言"}'));
  assert.equal(f.store.budget().used, 4); assert.equal(f.store.runs()[0].state, 'completed');
  assert.ok(f.store.actions().every(x => x.publicVisible === null));
  await assert.rejects(f.runner.start('30001', new AbortController().signal), /TRIAL_ALREADY_CONSUMED/);
});
test('pilot unknown send is never retried, occupies quota, and blocks the run', async t => {
  let calls = 0; const f = setup(t, { send: async () => { calls++; throw new PilotError('SEND_OUTCOME_UNKNOWN'); } });
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(calls, 1); assert.equal(f.store.actions()[0].state, 'unknown'); assert.equal(f.store.runs()[0].state, 'paused');
  await f.runner.reconcile(new AbortController().signal); assert.equal(calls, 1);
});
test('pilot visibility failure retains positive send receipt instead of reclassifying it', async t => {
  const f = setup(t, { verify: async () => { throw new Error('synthetic failure'); } });
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.store.actions()[0].state, 'accepted'); assert.equal(f.store.actions()[0].remoteId, '50001');
});
test('pilot reports untriggered replies without inventing interactions', async t => {
  let polls = 0;
  const f = setup(t, { comments: async (_aid, root) => { if (root !== '0') polls++; return { comments: [], next: null }; } });
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.sent.length, 1); assert.ok(polls <= 15);
  const report = JSON.parse(f.store.get('testReport'));
  assert.equal(report.replyStatus, '未触发'); assert.equal(report.requests, 2);
});
test('pilot rejects owner-as-bot and account changes before consuming a trial', async t => {
  const f = setup(t, { account: async () => ({ uid: config.ownerUid, name: 'same' }) });
  await assert.rejects(f.runner.start(config.ownerUid, new AbortController().signal), /BOT_EQUALS_OWNER/); assert.equal(f.store.get('trialConsumed'), null);
  f.platform.account = async () => ({ uid: '30002', name: 'changed' });
  await assert.rejects(f.runner.start('30001', new AbortController().signal), /CONFIG_OR_ACCOUNT_CHANGED/); assert.equal(f.sent.length, 0);
});
test('pilot cancellation during generation prevents any send and additional summary request', async t => {
  const f = setup(t); let entered; const started = new Promise(r => { entered = r; });
  f.model.ask = async (_r, signal) => { entered(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); return { text: '{"kind":"comment","text":"must not send"}', sessionId: 'fake' }; };
  await f.runner.start('30001', new AbortController().signal); await started; await f.runner.stop();
  assert.equal(f.sent.length, 0); assert.equal(f.store.runs()[0].state, 'cancelled');
  assert.equal(JSON.parse(f.store.get('testReport')).state, 'cancelled');
});
test('pilot expires after slow generation and does not send', async t => {
  const f = setup(t); const ask = f.model.ask;
  f.model.ask = async (r, signal) => { const result = await ask(r, signal); if (r.purpose === 'public') f.advance(900001); return result; };
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.sent.length, 0); assert.equal(f.store.runs()[0].state, 'expired');
});
test('pilot rejects changed configuration after generation', async t => {
  const f = setup(t); const ask = f.model.ask;
  f.model.ask = async (r, signal) => { const result = await ask(r, signal); f.mutable.ownerUid = '999'; return result; };
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.sent.length, 0); assert.equal(f.store.runs()[0].reason, 'CONFIG_CHANGED');
});
test('pilot ignores self, historical, indirect and duplicate replies', async t => {
  const f = setup(t, { comments: async (_aid, root) => ({ comments: root === '0' ? [] : [
    { id: '1', uid: '30001', root, parent: root, text: 'self', createdAt: 100001 },
    { id: '2', uid: '40001', root, parent: root, text: 'old', createdAt: 1 },
    { id: '3', uid: '40001', root, parent: 'unrelated', text: 'indirect', createdAt: 100001 },
    { id: '4', uid: '40001', root, parent: root, text: 'direct', createdAt: 100001 },
  ], next: null }) });
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.sent.length, 2); assert.equal(f.sent[1].target.parent, '4');
});
test('pilot limits thread pagination without losing events past the unread gap', async t => {
  const f = setup(t, { comments: async (_aid, root, cursor) => ({ comments: [], next: root === '0' ? null : String(Number(cursor ?? 0) + 1) }) });
  await f.runner.start('30001', new AbortController().signal); await f.runner.idle();
  assert.equal(f.sent.length, 1); assert.equal(f.store.runs()[0].reason, 'THREAD_PAGE_LIMIT');
});
test('pilot restart marks running and sending as interrupted/unknown and never renews authorization', t => {
  const { store, path } = fixture(t); const run = store.begin(config, '30001', 100);
  store.reserveAction(run.id, 'initial', 'comment', { bvid: config.bvid, aid: '1', root: '0', parent: '0' }, 'synthetic', 100);
  store.close(); const reopened = new PilotStore(path); t.after(() => reopened.close());
  assert.equal(reopened.runs()[0].state, 'interrupted'); assert.equal(reopened.actions()[0].state, 'unknown');
  assert.throws(() => reopened.begin(config, '30001', 200), /TRIAL_ALREADY_CONSUMED/);
});
test('pilot concurrent start admits only one run', async t => {
  const f = setup(t); const first = f.runner.start('30001', new AbortController().signal);
  await assert.rejects(f.runner.start('30001', new AbortController().signal), /RUN_BUSY/);
  await first; await f.runner.idle(); assert.equal(f.store.runs().length, 1);
});
test('pilot dead writer recovery is atomic across competing processes', { timeout: 10000 }, async t => {
  const { store, path } = fixture(t); store.close();
  const source = `import { PilotStore } from ${JSON.stringify(pathToFileURL(resolve('dist/pilot/store.js')).href)};
    let store;
    process.on('message', message => {
      if (message === 'acquire') {
        try { store = new PilotStore(${JSON.stringify(path)}); process.send('acquired'); }
        catch (error) { process.send(error.message); }
      }
      if (message === 'crash') process.exit(0);
      if (message === 'release') { store?.close(); process.exit(0); }
    }); process.send('ready');`;
  const start = async () => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    assert.equal((await once(child, 'message'))[0], 'ready'); return child;
  };
  const request = async (child, command) => { const result = once(child, 'message'); child.send(command); return (await result)[0]; };
  const dead = await start(); assert.equal(await request(dead, 'acquire'), 'acquired');
  const ended = once(dead, 'exit'); dead.send('crash'); await ended;
  const children = await Promise.all([start(), start()]);
  const outcomes = await Promise.all(children.map(child => request(child, 'acquire')));
  assert.deepEqual(outcomes.sort(), ['STORE_LOCKED', 'acquired']);
  await Promise.all(children.map(async child => { const exit = once(child, 'exit'); child.send('release'); await exit; }));
  const reopened = new PilotStore(path); reopened.close();
});
