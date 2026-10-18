import test from 'node:test';
import assert from 'node:assert/strict';
import { PilotStore } from '../dist/pilot/store.js';
import { PrivateChatBudget } from '../dist/pilot/private-chat.js';
import { Bilibili } from '../dist/platform/bilibili.js';
import { referenceDraftStyle, referenceDraftPrompts } from '../dist/browse/draft-design.js';
import { samePublicAuthorization } from '../dist/pilot/contracts.js';
import { isolatedStore, controlFixture, fakeModelHost, configuration, ownerUid, botUid } from './decoupling-helpers.mjs';

const signal = () => new AbortController().signal;
const historical = store => JSON.stringify({ meta: store.db.prepare("SELECT * FROM pilot_meta WHERE key NOT IN ('botUid','privateSession') ORDER BY key").all(),
  requests: store.db.prepare('SELECT * FROM pilot_requests ORDER BY rowid').all(), runs: store.runs(), actions: store.actions() });
function consumePublicTrial(store) {
  const run = store.begin(configuration(), botUid, 1); store.saveRun({ ...run, state: 'cancelled', reason: 'OWNER_STOPPED' });
  for (const purpose of ['private', 'public', 'public', 'public', 'summary']) store.reserveRequest(purpose, 2);
  return run;
}
test('independent private grants start closed, survive restart and preserve exhausted public history', t => {
  const { store, path } = isolatedStore(t); consumePublicTrial(store); const before = historical(store);
  let budget = new PrivateChatBudget(store);
  assert.deepEqual([budget.status(ownerUid).limit, budget.status(ownerUid).remaining], [0, 0]);
  assert.throws(() => budget.reserve(ownerUid, 3), /PRIVATE_CHAT_BUDGET_EXHAUSTED/);
  budget.authorize(ownerUid, 'synthetic-approved-grant', 2, 3); budget.reserve(ownerUid, 4);
  assert.throws(() => budget.authorize(ownerUid, 'another-grant', 2, 4), /PRIVATE_CHAT_GRANT_ACTIVE/);
  assert.throws(() => budget.reserve('20002', 4), /STORE_CONFIG_MISMATCH/);
  assert.equal(historical(store), before); store.close();
  const reopened = new PilotStore(path); t.after(() => reopened.close()); budget = new PrivateChatBudget(reopened);
  assert.equal(budget.status(ownerUid).remaining, 1); budget.reserve(ownerUid, 5);
  assert.throws(() => budget.reserve(ownerUid, 6), /PRIVATE_CHAT_BUDGET_EXHAUSTED/);
  assert.equal(historical(reopened), before); assert.equal(budget.status(ownerUid).lifetimeUsed, 2);
});
test('private grant rejects malformed, unlimited and replayed authorization; revocation never refunds', t => {
  const { store } = isolatedStore(t), b = new PrivateChatBudget(store);
  for (const value of [0, -1, Infinity, NaN, 21, 1.5]) assert.throws(() => b.authorize(ownerUid, 'grant', value, 1), /PRIVATE_CHAT_GRANT_INVALID/);
  b.authorize(ownerUid, 'grant', 1, 1); b.reserve(ownerUid, 2); b.revoke(ownerUid);
  assert.equal(b.status(ownerUid).remaining, 0); assert.equal(b.status(ownerUid).used, 1);
  assert.throws(() => b.authorize(ownerUid, 'grant', 1, 3), /PRIVATE_CHAT_GRANT_EXISTS/);
});
test('chat RPC authenticates owner and needs neither BV, platform login nor unused trial', async t => {
  const { store, control } = await controlFixture(t, configuration({ bvid: '' }));
  consumePublicTrial(store); const before = historical(store), budget = new PrivateChatBudget(store);
  budget.authorize(ownerUid, 'chat-grant', 1, 3);
  control.platformValue = new Proxy({}, { get() { throw new Error('PLATFORM_MUST_NOT_BE_USED'); } });
  control.modelValue = { busy: false, async ask(request, s) { s.throwIfAborted(); budget.reserve(ownerUid, 4); assert.equal(request.purpose, 'private'); return { text: 'synthetic answer', sessionId: 'synthetic' }; }, async dispose() {} };
  assert.equal((await control.chat({ text: 'hello' }, signal())).text, 'synthetic answer');
  assert.equal(historical(store), before);
  await assert.rejects(control.chat({ text: 'again' }, signal()), /PRIVATE_CHAT_BUDGET_EXHAUSTED/);
  const denied = await controlFixture(t, configuration({ bvid: '' }), 'model');
  await assert.rejects(denied.control.chat({ text: 'hello' }, signal()), /OWNER_REQUIRED/);
});
test('model private calls use independent reservations and captured persona; public snapshots remain authoritative', async t => {
  const { store } = isolatedStore(t); consumePublicTrial(store); const before = historical(store);
  const config = configuration({ bvid: '', persona: 'CURRENT_PERSONA' }), b = new PrivateChatBudget(store); b.authorize(ownerUid, 'model-grant', 1, 3);
  const fake = fakeModelHost(store, config); t.after(() => fake.model.dispose());
  const result = await fake.model.ask({ purpose: 'private', persona: config.persona, prompt: 'hello' }, signal());
  assert.equal(result.text, 'synthetic answer'); assert.equal(b.status(ownerUid).used, 1);
  assert.equal(historical(store), before); assert.match(fake.captures[0].system, /CURRENT_PERSONA/);
  assert.equal(fake.captures[0].route.maxTokens, 2048); fake.verifyRestricted();
});
test('chat stop cancels in-flight work and concurrent RPC never queues another request behind it', async t => {
  const { store, control } = await controlFixture(t, configuration({ bvid: '' }));
  const budget = new PrivateChatBudget(store); budget.authorize(ownerUid, 'rpc-cancel', 2, 1);
  let calls = 0, entered; const started = new Promise(resolve => { entered = resolve; });
  control.modelValue = { busy: false, async ask(_request, s) {
    calls++; budget.reserve(ownerUid, 2); entered();
    return new Promise((_resolve, reject) => s.addEventListener('abort', () => reject(new Error('synthetic abort')), { once: true }));
  }, cancelPrivate() {}, async dispose() {} };
  const first = control.chat({ text: 'first' }, signal()); await started;
  await assert.rejects(control.chat({ text: 'parallel' }, signal()), /MODEL_BUSY/);
  await control.stop({}, signal()); await assert.rejects(first);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1); assert.equal(budget.status(ownerUid).remaining, 1);
});
test('private cancellation consumes only actual reservation; concurrent calls and restart cannot reset it', async t => {
  const { store, path } = isolatedStore(t); store.bindOwner(ownerUid);
  const b = new PrivateChatBudget(store); b.authorize(ownerUid, 'cancel-grant', 2, 1);
  const config = configuration({ bvid: '' }), fake = fakeModelHost(store, config), controller = new AbortController();
  let reserved; const started = new Promise(resolve => { reserved = resolve; }); fake.blockAnswer(reserved);
  const first = fake.model.ask({ purpose: 'private', persona: config.persona, prompt: 'hello' }, controller.signal);
  await started;
  await assert.rejects(fake.model.ask({ purpose: 'private', persona: config.persona, prompt: 'concurrent' }, signal()), /MODEL_BUSY/);
  controller.abort(); await assert.rejects(first, /MODEL_CANCELLED/); assert.equal(b.status(ownerUid).used, 1);
  await fake.model.dispose(); store.close();
  const reopened = new PilotStore(path); t.after(() => reopened.close()); assert.equal(new PrivateChatBudget(reopened).status(ownerUid).remaining, 1);
});
test('aborted private operation before admission consumes no request', async t => {
  const { store } = isolatedStore(t); store.bindOwner(ownerUid); const b = new PrivateChatBudget(store); b.authorize(ownerUid, 'abort-first', 1, 1);
  const fake = fakeModelHost(store, configuration({ bvid: '' })); t.after(() => fake.model.dispose());
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fake.model.ask({ purpose: 'private', persona: configuration().persona, prompt: 'hello' }, controller.signal));
  assert.equal(b.status(ownerUid).used, 0); assert.equal(fake.captures.length, 0);
});
test('native private policy validates owner binding, admitted turn and independent budget', async t => {
  const { store } = isolatedStore(t); store.bindOwner(ownerUid); store.set('privateSession', 'native-session');
  const b = new PrivateChatBudget(store); b.authorize(ownerUid, 'native-grant', 1, 1);
  const config = configuration({ bvid: '' }), fake = fakeModelHost(store, config); t.after(() => fake.model.dispose());
  const handlers = new Map(), ctx = { tools: { restrict() {}, guard() {} }, systemPrompt: { suppressRuntimeContext() {}, context() {}, section() {} }, on: (name, fn) => { handlers.set(name, fn); return () => {}; } };
  fake.model.installPolicy(ctx, 'private');
  const event = { agent: { id: 'native-session' }, turn: 1, step: 1, signal: signal(), messages: [{ source: { kind: 'user' } }] };
  const before = handlers.get('agent/pre-step'), request = handlers.get('agent/request');
  await assert.rejects(request(event, async () => ({})), /MODEL_REQUEST_DENIED/);
  assert.equal(before({ ...event, messages: [{ source: { kind: 'user', principal: { kind: 'model' } } }] }).kind, 'reject');
  assert.equal(before(event).kind, 'enter'); await request(event, async () => ({})); assert.equal(b.status(ownerUid).used, 1);
  config.ownerUid = '20002'; assert.equal(before({ ...event, turn: 2 }).kind, 'reject');
  assert.equal(b.status(ownerUid).used, 1);
});
test('same UID QR reauthentication after logout preserves run, request budget and consumed state; changed UID is rejected before vault write', async t => {
  const { store } = isolatedStore(t); consumePublicTrial(store);
  store.db.prepare("DELETE FROM pilot_meta WHERE key='botUid'").run(); // Legacy DB has only historical run identity.
  const before = historical(store); assert.equal(store.boundAccountUid(), botUid);
  let uid = botUid, value = null, writes = 0, clock = 10_000;
  const vault = { async read() { return value; }, async write(v) { writes++; value = v; }, async remove() { value = null; } };
  const ok = (data, headers) => new Response(JSON.stringify({ code: 0, data }), { headers });
  const fetcher = async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/generate')) return ok({ url: 'https://passport.bilibili.com/qrcode/synthetic', qrcode_key: 'synthetic-key' });
    if (path.endsWith('/poll')) { const headers = new Headers(); for (const item of [`DedeUserID=${uid}`, 'SESSDATA=synthetic-session', 'bili_jct=synthetic-csrf']) headers.append('Set-Cookie', item); return ok({ code: 0 }, headers); }
    if (path.endsWith('/spi')) return ok({ b_3: 'synthetic-device' });
    assert.ok(path.endsWith('/nav')); return ok({ isLogin: true, mid: uid, uname: 'synthetic bot' });
  };
  const adapter = new Bilibili(vault, fetcher, () => clock, undefined, account => store.bindAccount(ownerUid, account.uid));
  let qr = await adapter.loginStart(signal()); assert.equal((await adapter.loginPoll(qr.loginId, signal())).state, 'authenticated');
  await adapter.logout(); assert.equal(value, null); assert.equal(store.boundAccountUid(), botUid);
  clock += 3000; qr = await adapter.loginStart(signal()); await adapter.loginPoll(qr.loginId, signal()); assert.equal(writes, 2);
  uid = '40001'; clock += 3000; qr = await adapter.loginStart(signal());
  await assert.rejects(adapter.loginPoll(qr.loginId, signal()), /ACCOUNT_CHANGED/);
  assert.equal(writes, 2); assert.equal(value.uid, botUid); assert.equal(historical(store), before);
});
test('login RPC is allowed after trial consumption and logout retains its binding without adding quota', async t => {
  const { control, store } = await controlFixture(t); consumePublicTrial(store); const before = historical(store);
  let starts = 0, polls = 0, removed = 0;
  control.platformValue = { async loginStart() { starts++; return { loginId: 'synthetic' }; }, async loginPoll() { polls++; return { state: 'waiting' }; }, async logout() { removed++; } };
  await control.loginStart({}, signal()); await control.loginPoll({ loginId: '00000000-0000-4000-8000-000000000001' }, signal()); await control.logout({}, signal());
  assert.deepEqual([starts, polls, removed], [1, 1, 1]); assert.equal(historical(store), before); assert.equal(store.boundAccountUid(), botUid);
});
test('persona and marker may change after consumption while owner and BV remain locked; historical grant snapshots do not change', async t => {
  const { control, store, values } = await controlFixture(t); consumePublicTrial(store); const before = historical(store);
  const config = { ...values, persona: 'NEW_PERSONA', diagnosticMarker: 'new-marker' };
  const result = await control.saveConfig({ config, revision: control.revision() }, signal());
  assert.equal(result.config.persona, 'NEW_PERSONA'); assert.equal(historical(store), before);
  assert.ok(samePublicAuthorization(config, configuration()));
  await assert.rejects(control.saveConfig({ config: { ...config, bvid: 'BV1GJ411x7h8' }, revision: result.revision }, signal()), /TRIAL_CONFIG_LOCKED/);
  await assert.rejects(control.saveConfig({ config: { ...config, ownerUid: '20002' }, revision: result.revision }, signal()), /STORE_CONFIG_MISMATCH/);
  assert.match(referenceDraftStyle(values.persona), /^NEW_PERSONA/);
  assert.match(referenceDraftPrompts([{ bvid: config.bvid, title: 'synthetic', author: 'synthetic', subtitle: 'synthetic' }], values.persona).system, /^NEW_PERSONA/);
});
test('public Agent uses the immutable request persona rather than a later live edit', async t => {
  const { store } = isolatedStore(t), config = configuration({ persona: 'LIVE_PERSONA' }), fake = fakeModelHost(store, config); t.after(() => fake.model.dispose());
  await fake.model.ask({ purpose: 'public', persona: 'GRANT_SNAPSHOT_PERSONA', prompt: 'public synthetic material' }, signal());
  assert.match(fake.captures[0].system, /^GRANT_SNAPSHOT_PERSONA/); assert.doesNotMatch(fake.captures[0].system, /LIVE_PERSONA/);
});
test('editing non-authorizing settings never changes the initial grant or renews a consumed media grant', t => {
  const { store } = isolatedStore(t), original = configuration(), first = store.begin(original, botUid, 1);
  store.saveRun({ ...first, state: 'completed', reason: 'MODEL_SKIPPED' });
  const savedFirst = store.run(first.id);
  store.set('videoInspection', JSON.stringify({ accountUid: botUid, material: { bvid: original.bvid, subtitle: 'synthetic' }, analysis: { summary: 'synthetic' } }));
  const revision = store.inspectionRevision(); store.set('videoEvidenceViewed', revision); store.recordVideoReview(revision, 'approved', 'synthetic');
  const edited = { ...original, persona: 'EDITED_PERSONA', diagnosticMarker: 'edited' };
  const second = store.begin(edited, botUid, 2, 'media-trial-2');
  assert.deepEqual(store.run(first.id), savedFirst); assert.equal(second.config.persona, 'EDITED_PERSONA');
  assert.throws(() => store.begin(edited, botUid, 3, 'media-trial-2'), /TRIAL_ALREADY_CONSUMED/);
  assert.equal(store.budget('initial').used, 0); assert.equal(store.get('trialConsumed'), first.id);
});
