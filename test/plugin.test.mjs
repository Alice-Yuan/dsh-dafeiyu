import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { apply as hostApply } from '../dist/host/plugin.js';
import { Context } from '@deepseek-ai/cordis';

const require = createRequire(import.meta.url);
test('V-M1-PACKAGE: lazy client registration, scoped settings and cleanup contract', async () => {
  const code = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8');
  const rows = []; let requires = 0; const dependencies = new Set();
  runInNewContext(code, { window: { __ModuleLoader__: { load: row => rows.push(row) } } });
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 'dsh-dafeiyu');
  assert.equal(requires, 0);
  const client = rows[0].factory(name => {
    requires++; dependencies.add(name); assert.ok(['react', 'zod'].includes(name)); return require(name);
  });
  assert.deepEqual([...dependencies].sort(), ['react', 'zod']);
  const effects = []; const registered = [];
  const fakeContext = { remote: { async $mount(value) { assert.equal(value.package, 'dsh-dafeiyu'); return async () => {}; }, dafeyu: {} },
    inject(names, apply) { assert.deepEqual(Array.from(names), ['slots', 'remote.dafeyu']); apply(this); return { dispose: async () => { effects.forEach(dispose => dispose()); } }; }, slots: {
    inject(slot, fn) { assert.equal(slot, 'plugins.detail.section'); effects.push(fn()); },
    register(options, component) {
      registered.push({ options, component });
      return () => { registered.pop(); };
    },
  } };
  const disposeClient = await client.apply(fakeContext);
  assert.equal(registered[0].options.id, 'dafeyu-pilot');
  const component = registered[0].component;
  assert.equal(renderToStaticMarkup(component({ subject: { kind: 'bundle', pkg: { name: 'unrelated' } } })), '');
  assert.equal(renderToStaticMarkup(component({})), '');
  const html = renderToStaticMarkup(component({ subject: { kind: 'bundle', pkg: { name: 'dsh-dafeiyu' } } }));
  assert.match(html, /尚未连接 Desktop 运行状态/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(code, /node:|fetch\(|XMLHttpRequest|child_process/);
  await disposeClient();
  assert.equal(registered.length, 0);
});
test('V-M1-BOUNDARY: mounting the control service does not activate models or accounts', async () => {
  const root = new Context();
  const live = Object.fromEntries(Object.entries({ ownerUid: '', bvid: '', persona: 'Synthetic persona', diagnosticMarker: '' }).map(([k,v]) => [k, { get: () => v }]));
  const fiber = root.plugin(ctx => { hostApply(ctx, live); });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(root.dafeyuControl);
  assert.equal(root.dafeyuControl.storeValue, null);
  assert.equal(root.dafeyuControl.modelValue, null);
  assert.equal(root.dafeyuControl.platformValue, null);
  await fiber.dispose();
});
test('V-M1-PACKAGE: manifest exports exist and package remains private', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.name, 'dsh-dafeiyu');
  assert.match(pkg.description, /大肥鱼.*实验插件/);
  assert.equal(pkg.repository.url, 'git+https://github.com/Alice-Yuan/dsh-dafeiyu.git');
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack']) {
    assert.equal(pkg.scripts[hook], undefined);
  }
  assert.equal(pkg.dsh.client.platform, 'web'); // Host carrier vocabulary, not product launch target.
  for (const target of Object.values(pkg.exports)) await readFile(new URL('../' + target, import.meta.url));
});
test('V-M1-BUNDLE: package self-resolution exposes manifest, patch and host entry', async () => {
  const manifestUrl = import.meta.resolve('dsh-dafeiyu/package.json');
  const pkg = JSON.parse(await readFile(new URL(manifestUrl), 'utf8'));
  assert.equal(pkg.name, 'dsh-dafeiyu');
  assert.equal(typeof pkg.dsh.bundle.patch, 'string');
  const patchUrl = import.meta.resolve(`${pkg.name}/${pkg.dsh.bundle.patch.replace(/^\.\//, '')}`);
  assert.equal(patchUrl, new URL(pkg.dsh.bundle.patch, manifestUrl).href);
  assert.ok((await readFile(new URL(patchUrl), 'utf8')).trim());
  assert.ok(pkg.files.includes(pkg.dsh.bundle.patch.replace(/^\.\//, '')));
  assert.equal(import.meta.resolve(pkg.name), new URL('../dist/host/plugin.js', import.meta.url).href);
  assert.equal(import.meta.resolve(`${pkg.name}/client`), new URL('../dist/client.js', import.meta.url).href);
});
