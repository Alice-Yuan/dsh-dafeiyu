import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { apply as hostApply } from '../dist/host/plugin.js';

const require = createRequire(import.meta.url);
test('V-M1-PACKAGE: lazy client registration, scoped settings and cleanup contract', async () => {
  const code = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8');
  const rows = []; let requires = 0;
  runInNewContext(code, { window: { __ModuleLoader__: { load: row => rows.push(row) } } });
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 'dsh-dafeiyu');
  assert.equal(requires, 0);
  const client = rows[0].factory(name => {
    requires++; assert.equal(name, 'react'); return require(name);
  });
  assert.equal(requires, 1);
  const effects = []; const registered = [];
  client.apply({ slots: {
    inject(slot, fn) { assert.equal(slot, 'plugins.detail.section'); effects.push(fn()); },
    register(options, component) {
      registered.push({ options, component });
      return () => { registered.pop(); };
    },
  } });
  assert.equal(registered[0].options.id, 'dafeyu-simulation');
  const component = registered[0].component;
  assert.equal(component({ subject: { kind: 'bundle', pkg: { name: 'unrelated' } } }), null);
  assert.equal(component({}), null);
  const html = renderToStaticMarkup(component({ subject: { kind: 'bundle', pkg: { name: 'dsh-dafeiyu' } } }));
  assert.match(html, /假模型、假平台、模拟主人消息/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(code, /node:|fetch\(|XMLHttpRequest|child_process/);
  effects.forEach(dispose => dispose());
  assert.equal(registered.length, 0);
});
test('V-M1-BOUNDARY: host entry creates no model, storage, timers or network', () => {
  const logs = [];
  hostApply({ logger: { info: text => logs.push(text) } });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /真实模型、账号及自动活动均未接通/);
});
test('V-M1-PACKAGE: manifest exports exist and package remains private', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.name, 'dsh-dafeiyu');
  assert.match(pkg.description, /大肥鱼.*模拟原型/);
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
