import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { PilotStore } from '../dist/pilot/store.js';
import { DaFeiYuControl } from '../dist/host/plugin.js';
import { DEFAULT_CONFIG } from '../dist/pilot/contracts.js';
import { HostModel } from '../dist/host/model.js';

export const ownerUid = '10001', botUid = '30001';
export const configuration = (extra = {}) => ({ ...DEFAULT_CONFIG, ownerUid, bvid: 'BV1GJ411x7h7', ...extra });
export function isolatedStore(t) {
  const parent = resolve('tmp/tests'); mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, 'decoupling-')), path = join(dir, 'test.sqlite');
  const store = new PilotStore(path); t.after(() => store.close()); return { dir, path, store };
}
export async function controlFixture(t, config = configuration(), principal = 'owner') {
  const data = isolatedStore(t), values = { ...config }, root = new Context();
  const owner = root.extend({ profileContext: { dir: data.dir }, invocation: { peer: { principal: { kind: principal } } },
    configEditor: { async edit(_entry, change) { Object.assign(values, change(values)); } } });
  Object.defineProperty(owner.fiber, 'entry', { value: {}, configurable: true });
  const live = Object.fromEntries(Object.keys(values).map(key => [key, { get: () => values[key] }]));
  const control = new DaFeiYuControl(owner, live); control.storeValue = data.store;
  t.after(() => root.fiber.dispose());
  return { ...data, control, values, root };
}
export function fakeModelHost(store, config) {
  const listeners = new Map(), handles = new Map(), captures = [], policies = [];
  let model, nextTurn = 1, waitForAnswer = false, afterReservation = () => {};
  const host = {
    on(name, fn) { listeners.set(name, fn); return () => listeners.delete(name); },
    agentDefaultModel: { currentSelection: () => ({ provider: 'synthetic', model: 'synthetic' }) },
    agentPresets: { async mount(ctx, id) { model.installPolicy(ctx, id.endsWith('private') ? 'private' : 'public'); } },
    agents: {
      get: id => handles.get(id)?.agent,
      create: options => makeHandle(options, options.sessionId),
      resume: options => makeHandle(options, options.resumeSessionId),
    },
  };
  async function makeHandle(options, id) {
    const handlers = new Map(), sections = []; let release = () => {}, cancelled = false, operation = Promise.resolve();
    const policy = { handlers, sections, tools: [] }; policies.push(policy);
    const ctx = {
      tools: { restrict: value => policy.tools.push(value), guard: fn => policy.guard = fn },
      systemPrompt: { suppressRuntimeContext() {}, context() {}, section: s => sections.push(s) },
      on: (name, fn) => { handlers.set(name, fn); return () => handlers.delete(name); },
    };
    const agent = { id, ctx, session: { id, append() {} },
      followup(message) {
        const turn = nextTurn++, controller = new AbortController(); policy.controller = controller;
        operation = Promise.resolve().then(async () => {
          const event = { agent, turn, step: 1, signal: controller.signal, messages: [message] };
          if (handlers.get('agent/pre-step')(event).kind !== 'enter') throw new Error('ADMISSION_REJECTED');
          const route = await handlers.get('agent/request')(event, async () => ({}));
          captures.push({ route, system: sections.map(s => s.text()).join('\n'), prompt: message.content });
          afterReservation();
          if (waitForAnswer) await new Promise(resolve => { release = resolve; if (cancelled) resolve(); });
          if (cancelled) return;
          listeners.get('session/event')?.({ id }, { type: 'assistant/message', data: { turn, message: { content: [{ type: 'text', text: 'synthetic answer' }] } } });
          listeners.get('session/event')?.({ id }, { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
        }).catch(error => {
          policy.error = error;
          listeners.get('session/event')?.({ id }, { type: 'turn/end', data: { turn, reason: { kind: 'failed' } } });
        });
      },
      cancel() { cancelled = true; policy.controller?.abort(); release(); },
      whenIdle: () => operation,
    };
    const handle = { agent, async dispose() { agent.cancel(); await operation; handles.delete(id); } };
    handles.set(id, handle); await options.setup(ctx); return handle;
  }
  model = new HostModel(host, () => store, () => config);
  return { model, host, captures, policies, blockAnswer(fn = () => {}) { waitForAnswer = true; afterReservation = fn; },
    verifyRestricted() { for (const p of policies) { assert.deepEqual(p.tools, [{ allow: [] }]); assert.match(p.guard(), /cannot execute tools/); } } };
}
