import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CONFIG } from '../dist/pilot/contracts.js';

const require = createRequire(import.meta.url);
async function panel(privateEnabled) {
  const code = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8'), rows = [];
  runInNewContext(code, { window: { __ModuleLoader__: { load: row => rows.push(row) } } });
  const snapshot = { config: { ...DEFAULT_CONFIG, ownerUid: '10001', bvid: '' }, revision: 'synthetic',
    budget: { used: 4, total: 4, lifetimeUsed: 9, grant: 'media-trial-2', byPurpose: { private: 1, public: 3, summary: 1 } },
    privateBudget: { grantId: privateEnabled ? 'synthetic-authorized-grant' : null, limit: privateEnabled ? 2 : 0,
      used: 0, remaining: privateEnabled ? 2 : 0, lifetimeUsed: 0, outputTokens: 2048, enabled: privateEnabled },
    account: null, busy: false, trialConsumed: true, configError: '', credentialError: '', privateSessionId: null,
    report: null, reportError: null, run: null, actions: [], diagnostic: { version: '0.1.0-alpha.12', marker: '' } };
  let index = 0;
  // Render a saved-state fixture without mounting effects, contacting the host,
  // logging in, granting quota or requesting a model.
  const react = { createElement, useState(initial) { return [index++ === 0 ? snapshot : initial, () => {}]; },
    useRef: value => ({ current: value }), useEffect() {} };
  const client = rows[0].factory(name => name === 'react' ? react : require(name));
  const tree = client.SettingsPanel({ ctx: {} });
  const nodes = [];
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node && typeof node === 'object' && node.props) { nodes.push(node); visit(node.props.children); }
  };
  visit(tree); return { nodes, html: renderToStaticMarkup(tree) };
}
test('compiled settings keep persona and same-account login available after public trial consumption', async () => {
  const { nodes, html } = await panel(false);
  const login = nodes.find(n => n.type === 'button' && n.props.children === '扫码登录 / 同账号重新认证');
  const settings = nodes.find(n => n.type === 'fieldset' && n.props.children?.[0]?.props?.children === '身份、目标与人格（历史公开授权不变）');
  assert.equal(login.props.disabled, false); assert.equal(settings.props.disabled, false);
  assert.match(html, /不需要目标 BV 或 B站登录|独立私聊额度/); assert.match(html, /默认规则待主人确认/);
  const chat = nodes.find(n => n.type === 'button' && n.props.children === '发送到大肥鱼会话');
  assert.equal(chat.props.disabled, true); assert.match(html, /已用 0 \/ 0/);
});
test('compiled chat button follows only its independent finite budget despite empty BV and exhausted public quota', async () => {
  const { nodes, html } = await panel(true);
  const chat = nodes.find(n => n.type === 'button' && n.props.children === '发送到大肥鱼会话');
  assert.equal(chat.props.disabled, false); assert.match(html, /剩余 2/); assert.match(html, /2048/);
});
