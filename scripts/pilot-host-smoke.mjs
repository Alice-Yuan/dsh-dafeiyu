// Explicit isolated integration probe: installed Desktop SDK, synthetic model only.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT, RUN_BASE, ELECTRON, prepareRunDirectory, buildChildEnvironment, superviseChild } from './desktop-core-smoke.mjs';
const ASAR = 'E:\\DeepseekHarness\\resources\\app.asar';
const expected = '47874618bf5b3011fcaac10cd4c85f69da333e70d4f99b921207c78d0999512a';
const hash = createHash('sha256'); for await (const bytes of createReadStream(ASAR)) hash.update(bytes);
if (hash.digest('hex') !== expected) throw new Error('DESKTOP_BASELINE_CHANGED');
const dir = await prepareRunDirectory(join(RUN_BASE, 'pilot-host'));
const env = buildChildEnvironment(dir);
async function probe(config) {
  const { strict: assert } = await import('node:assert');
  const { pathToFileURL } = await import('node:url');
  const { join } = await import('node:path');
  const fs = await import('node:fs/promises');
  const module = pkg => import(pathToFileURL(join(config.asar, 'dsh/node_modules/@deepseek-ai', pkg, 'lib/index.js')).href);
  const report = { status: 'FAIL', checks: [], electron: process.versions.electron, node: process.versions.node, model: 'synthetic-only' };
  let ctx, model, store;
  try {
    // No real profile, provider credentials, HTTP or browser state enters this process.
    globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN_IN_PROBE'); };
    const { Context, Service } = await module('cordis'); ctx = new Context();
    for (const pkg of ['dsh-typert-registry', 'dsh-session-projection', 'dsh-session', 'dsh-system-prompt', 'dsh-tools', 'dsh-llm', 'dsh-agent', 'dsh-agent-loop']) {
      const m = await module(pkg); await ctx.plugin(m.default).await();
    }
    const persist = await module('dsh-session-persistence-jsonl'); await ctx.plugin(persist, { root: join(config.dir, 'sessions') }).await();
    const { TYPERT } = await import(pathToFileURL(join(config.project, 'dist/host/typert.js')).href);
    const { validateTypertManifest } = await module('dsh-typert-loader'); validateTypertManifest('dsh-dafeiyu', TYPERT); ctx.typert.register(TYPERT);
    assert.equal(ctx.typert.local.list().filter(d => d.namespace === 'dafeyu').length, 10);
    report.checks.push('installed Typert validator and registry accept all ten strict endpoints');
    const { HostModel } = await import(pathToFileURL(join(config.project, 'dist/host/model.js')).href);
    const { PilotStore } = await import(pathToFileURL(join(config.project, 'dist/pilot/store.js')).href);
    const { DEFAULT_CONFIG } = await import(pathToFileURL(join(config.project, 'dist/pilot/contracts.js')).href);
    store = new PilotStore(join(config.dir, 'pilot.sqlite'));
    const pilotConfig = { ...DEFAULT_CONFIG, ownerUid: '10001', bvid: 'BV1GJ411x7h7' };
    new class extends Service { constructor() { super(ctx, 'agentDefaultModel'); } currentSelection() { return { provider: 'synthetic', model: 'synthetic' }; } }();
    const presetStub = ctx.plugin(child => { new class extends Service { constructor() { super(child, 'agentPresets'); } async mount(agentCtx, id) { model.installPolicy(agentCtx, id.endsWith('private') ? 'private' : 'public'); } }(); }); await presetStub.await();
    const { defineContentToolFixture } = await module('dsh-tools');
    ctx.tools.register(defineContentToolFixture({ name: 'forbidden_shell_fixture', description: 'Synthetic tool that must never be available', parameters: {}, execute() { throw new Error('TOOL_EXECUTED'); } }));
    ctx.systemPrompt.context({ name: 'synthetic:private', order: 0, text: 'GLOBAL_PRIVATE_CANARY' });
    const captures = [];
    const { LlmAdapter } = await module('dsh-llm');
    class Adapter extends LlmAdapter { async *stream(request) { captures.push(request); yield { type: 'text-delta', index: 0, text: 'Synthetic response' }; yield { type: 'finish', reason: { kind: 'stop' } }; } }
    ctx.llm.registerAdapter(['synthetic'], new Adapter());
    ctx.on('agent/error', event => { report.agentError = String(event.error?.message); }, { global: true });
    ctx.on('session/event', (_session, event) => { if (event.type === 'turn/end') report.lastTurn = event.data.reason; }, { global: true });
    model = new HostModel(ctx, () => store, () => pilotConfig);
    const sig = AbortSignal.timeout(6000);
    const first = await model.ask({ purpose: 'private', persona: pilotConfig.persona, prompt: 'SYNTHETIC_PRIVATE_CANARY' }, sig);
    assert.equal(first.text, 'Synthetic response'); assert.equal(captures[0].maxTokens, 2048);
    assert.equal(captures[0].provider, 'synthetic'); assert.equal(captures[0].tools?.length ?? 0, 0);
    assert.ok(!JSON.stringify(captures[0]).includes('GLOBAL_PRIVATE_CANARY'));
    report.checks.push('actual Agent loop emits a correlated response; default route and maxTokens=2048 enforced');
    await model.recordReport('SYNTHETIC_RECEIPT'); assert.equal(captures.length, 1);
    await model.dispose();
    model = new HostModel(ctx, () => store, () => pilotConfig);
    const second = await model.ask({ purpose: 'summary', persona: pilotConfig.persona, prompt: 'SYNTHETIC_SUMMARY' }, sig);
    assert.equal(second.sessionId, first.sessionId);
    assert.ok(JSON.stringify(captures[1].messages).includes('SYNTHETIC_PRIVATE_CANARY'));
    assert.ok(JSON.stringify(captures[1].messages).includes('SYNTHETIC_RECEIPT'));
    const third = await model.ask({ purpose: 'public', persona: pilotConfig.persona, prompt: 'SYNTHETIC_PUBLIC' }, sig);
    assert.notEqual(third.sessionId, first.sessionId); assert.ok(!JSON.stringify(captures[2]).includes('SYNTHETIC_PRIVATE_CANARY'));
    assert.equal(store.budget().used, 3);
    await assert.rejects(model.ask({ purpose: 'private', persona: pilotConfig.persona, prompt: 'OVER_BUDGET' }, sig));
    assert.equal(captures.length, 3);
    report.checks.push('JSONL persisted private session resumes with history; public session isolated; purpose quota refuses excess before dispatch');
    await model.dispose(); model = null; await presetStub.dispose();
    await ctx.plugin((await module('dsh-agent-preset-registry')).default, { default: 'dafeyu-private' }).await();
    for (const pkg of ['dsh-api-remote-access', 'dsh-api-gateway']) await ctx.plugin((await module(pkg)).default).await();
    const profileDir = join(config.dir, 'profile'); await fs.mkdir(profileDir);
    const patchPath = join(profileDir, 'cordis.patch.yml'), basePath = join(profileDir, 'base.yml');
    const installAnchor = join(config.asar, 'dsh/node_modules/@deepseek-ai/dsh/package.json');
    await fs.writeFile(join(profileDir, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: {}, dsh: { profile: { bundles: [] } } }));
    await fs.writeFile(patchPath, '[]\n');
    new class extends Service { constructor() { super(ctx, 'profileContext'); } dir = profileDir; patchPath = patchPath; installAnchor = installAnchor; home = process.env.DSH_HOME; overlays = []; }();
    await ctx.plugin((await module('dsh-config-editor')).default).await();
    await ctx.plugin((await module('cordis-plugin-loader')).default, { baseUrl: pathToFileURL(config.project + '/').href }).await();
    for (const audience of ['private', 'public']) await ctx.loader.create({ id: 'dafeyu-preset-' + audience,
      name: pathToFileURL(join(config.asar, 'dsh/node_modules/@deepseek-ai/dsh-agent-preset/lib/index.js')).href,
      config: { id: 'dafeyu-' + audience, name: audience, description: 'Synthetic test preset', plugins: [{ name: pathToFileURL(join(config.project, 'dist/host/policy.js')).href, config: { audience } }] } });
    const initialPatches = [{ insert: [{ id: 'dafeyu', name: pathToFileURL(join(config.project, 'dist/host/plugin.js')).href, config: pilotConfig }] }];
    await fs.writeFile(basePath, '[]\n'); await fs.writeFile(patchPath, JSON.stringify(initialPatches));
    await (await module('dsh-app-boot')).mountRootInclude(ctx, basePath, initialPatches, undefined, 'dsh');
    await ctx.loader.await(); const entry = ctx.loader.resolve('include:dafeyu'), mounted = entry.fiber;
    report.mount = { state: mounted.state, available: ['profileContext', 'configEditor', 'agents', 'agentDefaultModel', 'agentPresets', 'typert', 'dafeyuControl'].map(k => [k, !!ctx.get(k)]), gatewaySeesControl: !!ctx.typertGateway.ctx.get('dafeyuControl'), controlType: typeof ctx.get('dafeyuControl') };
    const peer = { principal: { kind: 'owner' }, signal: new AbortController().signal };
    const receiverCtx = await ctx.typertGateway.resolveReceiverContext(ctx.typert.local.get('dafeyu/status'), { request: {} }, 'dafeyu/status');
    report.mount.resolved = !!receiverCtx.get('dafeyuControl');
    const status = await ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'status', args: { request: {} }, peer });
    assert.equal(status.config.ownerUid, '10001');
    const chat = await ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'chat', args: { request: { text: 'ACTUAL_PRESET_CHAT' } }, peer, signal: AbortSignal.timeout(6000) });
    assert.equal(chat.text, 'Synthetic response'); assert.equal(captures.at(-1).tools?.length ?? 0, 0);
    report.checks.push('actual AgentPreset registry mounts the packaged policy through Loader; Gateway chat completes');
    await assert.rejects(ctx.dafeyuControl.status({}, new AbortController().signal), /OWNER_REQUIRED/);
    await assert.rejects(ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'status', args: { request: { force: true } }, peer }));
    const priorUid = mounted.uid;
    const edit = ctx.configEditor.edit; ctx.configEditor.edit = async function (...args) { try { return await edit.apply(this, args); } catch (error) { report.configError = error.stack; throw error; } };
    await ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'saveConfig', args: { request: { config: { ...pilotConfig, diagnosticMarker: 'reload-fixture' }, revision: status.revision } }, peer });
    assert.ok((await fs.readFile(patchPath, 'utf8')).includes('reload-fixture'));
    await assert.rejects(ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'saveConfig', args: { request: { config: pilotConfig, revision: status.revision } }, peer }), /CONFIG_REVISION_CONFLICT/);
    assert.equal(entry.fiber.uid, priorUid);
    const updated = await ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'status', args: { request: {} }, peer });
    assert.equal(updated.diagnostic.marker, 'reload-fixture');
    await entry.update({ disabled: true }); await ctx.loader.await(); assert.equal(ctx.get('dafeyuControl'), undefined);
    await entry.update({ disabled: false }); await ctx.loader.await();
    const resumed = await ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'status', args: { request: {} }, peer });
    assert.equal(resumed.budget.used, 1); assert.equal(resumed.privateSessionId, chat.sessionId);
    const summary = await ctx.dafeyuControl.model().ask({ purpose: 'summary', persona: pilotConfig.persona, prompt: 'RESUMED_SUMMARY' }, AbortSignal.timeout(6000));
    assert.equal(summary.sessionId, chat.sessionId); assert.equal(captures.at(-1).tools?.length ?? 0, 0);
    await entry.fiber.dispose(); assert.equal(ctx.get('dafeyuControl'), undefined);
    report.checks.push('actual ConfigEditor writes isolated profile patch; stale revision rejected; volatile update keeps service alive; cold resume retains restrictions and quotas; no HTTP server started');
    report.status = 'PASS';
  } catch (error) { report.error = { message: error.message, stack: error.stack }; }
  finally { await model?.dispose(); store?.close(); await ctx?.fiber.dispose(); }
  process.stdout.write(JSON.stringify(report) + '\n'); process.exitCode = report.status === 'PASS' ? 0 : 1;
}
const file = join(dir, 'probe.mjs'); await writeFile(file, `(${probe.toString()})(${JSON.stringify({ asar: ASAR, project: PROJECT, dir })});\n`, { flag: 'wx' });
const child = await superviseChild(ELECTRON, ['--expose-internals', file], { cwd: dir, env, timeoutMs: 15000 });
await writeFile(join(dir, 'result.json'), JSON.stringify({ archive: expected, ...child }, null, 2));
process.stdout.write(JSON.stringify({ dir, ...child }, null, 2) + '\n'); process.exitCode = child.exitCode === 0 && child.terminationConfirmed ? 0 : 1;
