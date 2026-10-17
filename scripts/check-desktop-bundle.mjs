// Explicit, bounded validation against the installed Desktop's patch parser.
// No boot/profile-loader/CLI install function is called; importing this file does not run it.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT, RUN_BASE, ELECTRON, preflight, prepareRunDirectory,
  buildChildEnvironment, superviseChild } from './desktop-core-smoke.mjs';
import { assertFreshBundleTarget } from './bundle-install-guard.mjs';

const ASAR = 'E:\\DeepseekHarness\\resources\\app.asar';
const ARCHIVE_SHA = '47874618bf5b3011fcaac10cd4c85f69da333e70d4f99b921207c78d0999512a';
const BOOT_ENTRY = 'dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js';
const BOOT_SHA = '5135179ac810e4f626f32ec3bdc3293dc7d2028e8aa92e5e0c006f1a33b78e76';

async function probe(config, assertFreshBundleTarget) {
  const report = { status: 'FAIL', desktopVersion: '0.2.1-rc.2', checks: [] };
  try {
    const { strict: assert } = await import('node:assert');
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    assert.equal(process.env.DSH_HOME, config.dshHome);
    assert.equal(process.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(process.send, undefined);
    assert.equal(createHash('sha256').update(readFileSync(new URL(config.bootUrl))).digest('hex'), config.bootSha);
    const { bundlePatchPaths, loadOverlayPatches, composeEntries } = await import(config.bootUrl);
    const manifest = JSON.parse(readFileSync(config.manifest, 'utf8'));
    const { parseInstallSpec } = await import(config.managerUrl);
    assert.deepEqual(parseInstallSpec('https://github.com/Alice-Yuan/dsh-dafeiyu.git'), {
      kind: 'git', spec: 'https://github.com/Alice-Yuan/dsh-dafeiyu.git', host: 'github.com',
    });
    assert.equal(manifest.name, 'dsh-dafeiyu');
    assert.match(manifest.description, /大肥鱼.*模拟原型/);
    report.checks.push('official GitHub spec parser accepts repository URL', 'Chinese package description present');
    const paths = bundlePatchPaths(config.project, manifest.dsh.bundle);
    assert.deepEqual(paths, [config.patch]);
    const patches = paths.map(file => loadOverlayPatches('dafeyu-contract', file));
    const warnings = [];
    const compose = layers => composeEntries(layers, message => warnings.push(message));
    const entries = compose(patches);
    assert.deepEqual(entries, [{ id: 'dafeyu', name: 'dsh-dafeiyu' }]);
    report.checks.push('exactly one inert plugin row');
    const disable = [{ id: 'dafeyu', disabled: true }];
    assert.equal(compose([...patches, disable])[0].disabled, true);
    assert.equal(compose([...patches, disable, [{ id: 'dafeyu', disabled: false }]])[0].disabled, false);
    assert.deepEqual(compose(patches), entries); // Composition must not mutate reusable patch inputs.
    assert.deepEqual(warnings, []);
    report.checks.push('disable/enable overlay composition', 'no input mutation or warnings');
    assert.throws(() => bundlePatchPaths(config.project, { patch: 42 }));
    assert.throws(() => loadOverlayPatches('dafeyu-contract', config.badPatch));
    report.checks.push('invalid declaration and non-list YAML rejected');

    // Parse every synthetic fixture using the same official parser as the real bundle.
    const fixture = name => loadOverlayPatches('dafeyu-contract', config.fixtures[name]);
    const existing = [fixture('existing.patch.yml'), fixture('existing-overrides.patch.yml')];
    const existingInput = structuredClone(existing);
    const existingRows = compose(existing);
    assert.equal(existingRows[0].disabled, true);
    assert.equal(existingRows[1].config[0].config.count, 7);
    let mergeCalls = 0;
    const checkedMerge = (layers, packageNames) => {
      const before = compose(layers);
      assertFreshBundleTarget(before, packageNames); // Reject before adding any new layer.
      mergeCalls++;
      return compose([...layers, ...patches]);
    };
    const merged = checkedMerge(existing, ['example-alpha', 'example-beta']);
    assert.deepEqual(merged, [...existingRows, ...entries]);
    assert.deepEqual(existing, existingInput);
    assert.deepEqual(patches, paths.map(file => loadOverlayPatches('dafeyu-contract', file)));
    report.checks.push('existing rows, order, nested config and prior overrides preserved');
    report.checks.push('existing and candidate patch inputs unchanged');
    const cases = [
      ['conflict-id.patch.yml', [], ['row-id']],
      ['conflict-package.patch.yml', [], ['row-package']],
      ['conflict-disabled.patch.yml', [], ['row-id', 'row-package']],
      ['conflict-nested-id.patch.yml', [], ['row-id']],
      ['conflict-nested-package.patch.yml', [], ['row-package']],
      ['existing.patch.yml', ['dsh-dafeyu'], ['registered-package']],
      ['existing.patch.yml', ['dsh-dafeiyu'], ['registered-package']],
    ];
    report.conflicts = [];
    for (const [name, packageNames, reasons] of cases) {
      const layers = [fixture(name)];
      const saved = structuredClone(layers);
      const callsBefore = mergeCalls;
      assert.throws(() => checkedMerge(layers, packageNames), error => {
        assert.equal(error.code, 'DFY_BUNDLE_CONFLICT');
        assert.deepEqual(error.reasons, reasons);
        return true;
      });
      assert.equal(mergeCalls, callsBefore); // No combined composition or candidate application.
      assert.deepEqual(layers, saved);
      report.conflicts.push({ fixture: name, reasons, status: 'REJECTED_BEFORE_MERGE', inputUnchanged: true });
    }
    assert.deepEqual(warnings, []);
    report.checks.push('same ID, same package, disabled, nested and registered-only conflicts rejected');
    report.package = { name: manifest.name, version: manifest.version, entries };
    report.versions = { electron: process.versions.electron, node: process.versions.node };
    report.status = 'PASS';
  } catch (error) {
    report.error = { name: error?.name ?? 'Error', code: error?.code ?? 'BUNDLE_CONTRACT_FAILED' };
  }
  process.stdout.write(JSON.stringify(report) + '\n');
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

export async function checkDesktopBundle() {
  await preflight(); // Checks executable path, Desktop/core baseline and unchanged empty host entry.
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(ASAR)) digest.update(chunk);
  if (digest.digest('hex') !== ARCHIVE_SHA) throw new Error('REVIEWED_ARCHIVE_CHANGED');
  const runDir = await prepareRunDirectory(join(RUN_BASE, 'bundle-contract'));
  const env = buildChildEnvironment(runDir);
  const fixtureNames = ['existing.patch.yml', 'existing-overrides.patch.yml', 'conflict-id.patch.yml',
    'conflict-package.patch.yml', 'conflict-disabled.patch.yml', 'conflict-nested-id.patch.yml',
    'conflict-nested-package.patch.yml'];
  const config = { project: PROJECT, manifest: join(PROJECT, 'package.json'),
    patch: join(PROJECT, 'cordis.patch.yml'), badPatch: join(runDir, 'invalid.patch.yml'),
    fixtures: Object.fromEntries(fixtureNames.map(name => [name, join(PROJECT, 'test', 'fixtures', 'bundle', name)])),
    bootUrl: pathToFileURL(join(ASAR, BOOT_ENTRY)).href, bootSha: BOOT_SHA, dshHome: env.DSH_HOME,
    managerUrl: pathToFileURL(join(ASAR, 'dsh/node_modules/@deepseek-ai/dsh-plugin-manager/lib/index.js')).href };
  await writeFile(config.badPatch, 'not_a_patch_list: true\n', { flag: 'wx' });
  const probePath = join(runDir, 'bundle-probe.mjs');
  await writeFile(probePath, `(${probe.toString()})(${JSON.stringify(config)}, ${assertFreshBundleTarget.toString()});\n`, { flag: 'wx' });
  const startedUtc = new Date().toISOString();
  const child = await superviseChild(ELECTRON, ['--expose-internals', probePath], { cwd: runDir, env, timeoutMs: 15000 });
  let parsed;
  try { parsed = JSON.parse(child.stdout.trim()); } catch { parsed = { status: 'FAIL', error: { code: 'INVALID_CHILD_REPORT' } }; }
  const status = child.terminationConfirmed && child.exitCode === 0 && !child.timedOut &&
    !child.outputLimited && !child.errorCode && parsed.status === 'PASS' ? 'PASS' : 'FAIL';
  const result = { task: 'DFY-M1-016', test: 'V-M1-RENAME-BUNDLE', status, startedUtc, finishedUtc: new Date().toISOString(),
    runDir, executable: ELECTRON, args: ['--expose-internals', probePath], environmentKeys: Object.keys(env).sort(),
    sourceHashes: { archive: ARCHIVE_SHA, appBoot: BOOT_SHA },
    projectHashes: Object.fromEntries(await Promise.all(['package.json', 'cordis.patch.yml', 'dist/host/plugin.js',
      'scripts/check-desktop-bundle.mjs', 'scripts/bundle-install-guard.mjs',
      ...fixtureNames.map(name => `test/fixtures/bundle/${name}`)].map(async name =>
      [name, createHash('sha256').update(await readFile(join(PROJECT, name))).digest('hex')]))),
    child: { ...child, stdout: undefined, stderr: undefined }, probe: parsed,
    scope: { method: 'installed official parser and composition functions, synthetic overlays only',
      notRun: ['boot', 'profile load or install', 'plugin lifecycle', 'GUI', 'config persistence', 'session', 'model', 'Bilibili'],
      limits: ['clean environment and bounded child; not OS-level filesystem/network tracing'] } };
  await writeFile(join(runDir, 'child.stdout.json'), child.stdout, { flag: 'wx' });
  await writeFile(join(runDir, 'child.stderr.txt'), child.stderr, { flag: 'wx' });
  await writeFile(join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error('UNEXPECTED_ARGUMENTS');
    const result = await checkDesktopBundle();
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch (error) {
    process.stderr.write(JSON.stringify({ status: 'FAIL', stage: 'preflight', code: error?.code ?? error?.message ?? 'FAILED' }) + '\n');
    process.exitCode = 1;
  }
}
