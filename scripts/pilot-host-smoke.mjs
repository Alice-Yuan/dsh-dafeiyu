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
  let ctx, model, store, clientCtx;
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
    assert.equal(ctx.typert.local.list().filter(d => d.namespace === 'dafeyu').length, 14);
    report.checks.push('installed Typert validator and registry accept all fourteen strict endpoints');
    await ctx.plugin((await module('dsh-attachment-local')).default, { dshHome: join(config.dir, 'attachment-home') }).await();
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
    ctx.systemPrompt.context({ name: 'working-directory:current', order: 1, required: true, text: 'HOST_REQUIRED_DIRECTORY_CANARY' });
    const captures = [];
    const { LlmAdapter } = await module('dsh-llm');
    let vision = true, finishKind = 'stop';
    class Adapter extends LlmAdapter { async resolveModel(provider, id) { return { provider, id, name: id, inputModalities: vision ? ['text', 'image'] : ['text'], reasoning: { efforts: [{id:'low',name:'Low'},{id:'high',name:'High'}] } }; } async *stream(request) { captures.push(request); yield { type: 'text-delta', index: 0, text: 'Synthetic response' }; yield { type: 'finish', reason: { kind: finishKind } }; } }
    ctx.llm.registerAdapter(['synthetic'], new Adapter());
    ctx.on('agent/error', event => { report.agentError = String(event.error?.message); }, { global: true });
    ctx.on('session/event', (_session, event) => { if (event.type === 'turn/end') report.lastTurn = event.data.reason; }, { global: true });
    model = new HostModel(ctx, () => store, () => pilotConfig);
    const sig = AbortSignal.timeout(6000);
    const first = await model.ask({ purpose: 'private', persona: pilotConfig.persona, prompt: 'SYNTHETIC_PRIVATE_CANARY' }, sig);
    assert.equal(first.text, 'Synthetic response'); assert.equal(captures[0].maxTokens, 2048);
    assert.equal(captures[0].provider, 'synthetic'); assert.equal(captures[0].tools?.length ?? 0, 0);
    assert.ok(!JSON.stringify(captures[0]).includes('GLOBAL_PRIVATE_CANARY'));
    assert.ok(!JSON.stringify(captures[0]).includes('HOST_REQUIRED_DIRECTORY_CANARY'));
    report.checks.push('actual Agent loop emits a correlated response; default route and maxTokens=2048 enforced');
    await model.recordReport('SYNTHETIC_RECEIPT'); assert.equal(captures.length, 1);
    await model.dispose();
    model = new HostModel(ctx, () => store, () => pilotConfig);
    const second = await model.ask({ purpose: 'summary', persona: pilotConfig.persona, prompt: 'SYNTHETIC_SUMMARY' }, sig);
    assert.equal(second.sessionId, first.sessionId);
    assert.ok(JSON.stringify(captures[1].messages).includes('SYNTHETIC_PRIVATE_CANARY'));
    assert.ok(JSON.stringify(captures[1].messages).includes('SYNTHETIC_RECEIPT'));
    const frames = [{ atSeconds: 0, sha256: 'synthetic', jpeg: Buffer.from('/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYxLjE5LjEwMQD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABNAAEBAAAAAAAAAAAAAAAAAAAABgEBAQEAAAAAAAAAAAAAAAAAAAYHEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgAIAAgAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AiwEo38AAAAAB/9k=', 'base64') }];
    vision = false;
    await assert.rejects(model.ask({ purpose: 'public', persona: pilotConfig.persona, prompt: 'SYNTHETIC_PUBLIC', frames }, sig), /DEFAULT_MODEL_VISION_UNAVAILABLE/);
    assert.equal(store.budget().used, 2); vision = true;
    const third = await model.ask({ purpose: 'public', persona: pilotConfig.persona, prompt: 'SYNTHETIC_PUBLIC', frames }, sig);
    const image = captures[2].messages.flatMap(m => m.content).find(b => b.type === 'image');
    assert.equal(captures[2].reasoningEffort, 'low');
    assert.match(image?.attachment?.attachmentId, /^sha256:/); assert.equal(image.attachment.width, 32);
    assert.ok((await ctx.attachments.readImage(image.attachment)).data.byteLength > 0);
    report.checks.push('actual attachment store and Agent loop preserve JPEG frame; text-only route rejected before budget reservation');
    assert.notEqual(third.sessionId, first.sessionId); assert.ok(!JSON.stringify(captures[2]).includes('SYNTHETIC_PRIVATE_CANARY'));
    assert.ok(!JSON.stringify(captures[2]).includes('HOST_REQUIRED_DIRECTORY_CANARY'));
    report.checks.push('required working-directory context is shadowed in private/public agent scopes');
    assert.equal(store.budget().used, 3);
    await assert.rejects(model.ask({ purpose: 'private', persona: pilotConfig.persona, prompt: 'OVER_BUDGET' }, sig));
    assert.equal(captures.length, 3);
    report.checks.push('JSONL persisted private session resumes with history; public session isolated; purpose quota refuses excess before dispatch');
    finishKind = 'max-tokens';
    await assert.rejects(model.ask({ purpose: 'public', persona: pilotConfig.persona, prompt: 'OUTPUT_LIMIT', frames }, sig), /MODEL_OUTPUT_LIMIT/);
    assert.equal(store.budget().used, 4); finishKind = 'stop';
    report.checks.push('declared low reasoning applied only to image requests; output exhaustion remains charged and fails closed');
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
    const control = ctx.dafeyuControl, reviewStore = control.store(), reviewRunner = control.runner();
    const previewVideo = { bvid: pilotConfig.bvid, aid: '20001', cid: '20002', title: 'Synthetic evidence', description: '', subtitle: 'Synthetic subtitle' };
    reviewStore.set('videoInspection', JSON.stringify({ accountUid: '30001', material: previewVideo, analysis: { summary: 'Synthetic analysis' } }));
    const reviewRevision = reviewStore.inspectionRevision();
    const invokeReview = decision => ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'reviewVideo', args: { request: { revision: reviewRevision, decision, note: 'Synthetic review' } }, peer });
    await assert.rejects(invokeReview('approved'), /VIDEO_REVIEW_STALE/);
    const realPreflight = reviewRunner.preflight;
    reviewRunner.preflight = async () => ({ account: { uid: '30001' }, video: previewVideo, comments: [] });
    const preview = await ctx.typertGateway.invoke({ namespace: 'dafeyu', method: 'videoEvidence', args: { request: {} }, peer });
    assert.equal(preview.revision, reviewRevision); assert.equal(preview.subtitle, 'Synthetic subtitle');
    await invokeReview('rejected'); assert.throws(() => reviewStore.assertVideoReviewed(), /VIDEO_REVIEW_REQUIRED/);
    await invokeReview('approved'); reviewStore.assertVideoReviewed();
    assert.equal(reviewStore.budget().used, 1); reviewRunner.preflight = realPreflight;
    report.checks.push('authenticated evidence/review endpoints require exact preview revision, preserve rejection and consume no model request');
    // Exercise the actual Client Remote namespace guard, not just a plain-object UI stub.
    clientCtx = new Context();
    await clientCtx.plugin((await module('dsh-typert-registry')).default).await();
    const views = [];
    new class extends Service {
      constructor() { super(clientCtx, 'connection'); }
      interactions = 'none';
      rpc = { open: async function* () {}, call: async (_base, endpoint, payload, signal) => {
        const [namespace, method] = endpoint.split('/');
        return { ok: true, value: await ctx.typertGateway.invoke({ namespace, method, args: payload.args, peer, signal }) };
      } };
    }();
    new class extends Service {
      constructor() { super(clientCtx, 'slots'); }
      inject(_name, factory) { const dispose = factory(); this.ctx.effect(() => dispose); }
      register(_options, component) { views.push(component); return () => { views.splice(views.indexOf(component), 1); }; }
    }();
    const clientGateway = await import(pathToFileURL(join(config.asar, 'dsh/node_modules/@deepseek-ai/dsh-api-gateway/lib/client.node.js')).href);
    await clientCtx.plugin(clientGateway).await();
    const { runInNewContext } = await import('node:vm'), { createRequire } = await import('node:module');
    const require = createRequire(join(config.project, 'package.json')); let clientModule;
    runInNewContext(await fs.readFile(join(config.project, 'dist/client.js'), 'utf8'), { window: { __ModuleLoader__: { load(row) { clientModule = row.factory(require); } } } });
    const clientFiber = clientCtx.plugin(clientModule); await clientFiber.await();
    assert.equal(views.length, 1);
    const view = views[0]({ subject: { kind: 'bundle', pkg: { name: 'dsh-dafeiyu' } } });
    const clientStatus = await view.props.ctx.remote.dafeyu.status({});
    assert.equal(clientStatus.ok, true); assert.equal(clientStatus.value.diagnostic.marker, 'reload-fixture');
    await clientFiber.dispose(); assert.equal(views.length, 0); assert.equal(clientCtx.get('remote.dafeyu'), undefined);
    await clientCtx.fiber.dispose(); clientCtx = null;
    report.checks.push('actual Client Remote mounts namespace before injected view; rendered view context can call authenticated Host status; unload removes view and namespace');
    const summary = await ctx.dafeyuControl.model().ask({ purpose: 'summary', persona: pilotConfig.persona, prompt: 'RESUMED_SUMMARY' }, AbortSignal.timeout(6000));
    assert.equal(summary.sessionId, chat.sessionId); assert.equal(captures.at(-1).tools?.length ?? 0, 0);
    await entry.fiber.dispose(); assert.equal(ctx.get('dafeyuControl'), undefined);
    report.checks.push('actual ConfigEditor writes isolated profile patch; stale revision rejected; volatile update keeps service alive; cold resume retains restrictions and quotas; no HTTP server started');
    report.status = 'PASS';
  } catch (error) { report.error = { message: error.message, stack: error.stack }; }
  finally { await clientCtx?.fiber.dispose(); await model?.dispose(); store?.close(); await ctx?.fiber.dispose(); }
  process.stdout.write(JSON.stringify(report) + '\n'); process.exitCode = report.status === 'PASS' ? 0 : 1;
}
const file = join(dir, 'probe.mjs'); await writeFile(file, `(${probe.toString()})(${JSON.stringify({ asar: ASAR, project: PROJECT, dir })});\n`, { flag: 'wx' });
const child = await superviseChild(ELECTRON, ['--expose-internals', file], { cwd: dir, env, timeoutMs: 15000 });
await writeFile(join(dir, 'result.json'), JSON.stringify({ archive: expected, ...child }, null, 2));
process.stdout.write(JSON.stringify({ dir, ...child }, null, 2) + '\n'); process.exitCode = child.exitCode === 0 && child.terminationConfirmed ? 0 : 1;
