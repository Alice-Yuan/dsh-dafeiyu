// Explicit opt-in compatibility probe. Importing this module never launches a process.
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { open, readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROJECT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const RUN_BASE = join(PROJECT, 'tmp', 'desktop-core-smoke');
export const ELECTRON = 'E:\\DeepseekHarness\\DeepSeek Harness.exe';
const ASAR = 'E:\\DeepseekHarness\\resources\\app.asar';
const CORE = 'dsh/node_modules/@deepseek-ai/cordis';
const UTILS = 'dsh/node_modules/@deepseek-ai/cosmokit';
const PINNED = Object.freeze({
  'lib/main.js': '6f3d1ddd1106371452c2204be6dfb2e5460a8e8259cdd05cdccb5387b3f9a85a',
  [`${CORE}/lib/index.js`]: '6a9394c0877ff45218818c6e815edd038f8057e1a1deb390a8d43ec81c57691e',
  [`${UTILS}/lib/index.js`]: 'ba44c0871656e4c7cac2c3c8a2ff644e0d2eb9d6bda7f6355866d686d513268e',
});
const PLUGIN_SHA = 'c3605eff550d5111a437c899b0a56d0431ae8d28f53fe728f51632558035ca36';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };

function isWithin(base, target, allowEqual = false) {
  const part = relative(base, target);
  return (allowEqual || part !== '') && !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`);
}

export function validateRunRoot(input = RUN_BASE) {
  if (typeof input !== 'string' || input.includes('\0') || input.split(/[\\/]/).includes('..')) fail('UNSAFE_RUN_ROOT');
  const target = resolve(input);
  if (!isWithin(RUN_BASE, target, true)) fail('UNSAFE_RUN_ROOT');
  return target;
}

// Check each component before descending; never follow an existing junction/symlink.
export async function prepareRunDirectory(input = RUN_BASE) {
  const target = validateRunRoot(input);
  if (await realpath(PROJECT) !== PROJECT) fail('PROJECT_REDIRECTED');
  let cursor = PROJECT;
  for (const part of relative(PROJECT, target).split(sep)) {
    cursor = join(cursor, part);
    try { await mkdir(cursor); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(cursor) !== cursor) fail('RUN_ROOT_REDIRECTED');
  }
  const runDir = join(target, `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  await mkdir(runDir); // Unique, exclusive creation; no cleanup or reuse.
  for (const part of ['home', 'dsh-home', 'temp', 'appdata', 'localappdata']) await mkdir(join(runDir, part));
  return runDir;
}

export function buildChildEnvironment(runDir, source = process.env) {
  if (!isWithin(RUN_BASE, resolve(runDir))) fail('UNSAFE_CHILD_DIRECTORY');
  const windows = source.SystemRoot ?? source.SYSTEMROOT;
  if (typeof windows !== 'string' || !isAbsolute(windows)) fail('SYSTEM_ROOT_MISSING');
  // Read just this OS path, never enumerate or serialize the caller environment.
  return {
    SystemRoot: windows, WINDIR: windows,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: join(runDir, 'dsh-home'),
    HOME: join(runDir, 'home'), USERPROFILE: join(runDir, 'home'),
    APPDATA: join(runDir, 'appdata'), LOCALAPPDATA: join(runDir, 'localappdata'),
    TEMP: join(runDir, 'temp'), TMP: join(runDir, 'temp'),
  };
}

export function validateTimeout(value) {
  if (!Number.isInteger(value) || value < 1 || value > 15000) fail('INVALID_TIMEOUT');
  return value;
}

// A generic, bounded helper for local fixture tests. The CLI below pins its executable.
export function superviseChild(command, args, { cwd, env, timeoutMs = 15000 }) {
  validateTimeout(timeoutMs);
  return new Promise(resolveResult => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, outputLimited = false;
    let errorCode = null, finished = false, grace;
    const finish = (exitCode, signal, terminationConfirmed) => {
      if (finished) return;
      finished = true; clearTimeout(timer); clearTimeout(grace);
      resolveResult({ pid: child.pid ?? null, exitCode, signal, errorCode, timedOut, outputLimited,
        terminationConfirmed, durationMs: Date.now() - started, stdout, stderr });
    };
    const stopOwnedChild = () => {
      try { child.kill(); } catch { errorCode ??= 'CHILD_KILL_FAILED'; }
      // A failure to confirm termination is reported, never treated as success.
      grace ??= setTimeout(() => {
        child.stdout.destroy(); child.stderr.destroy(); child.unref();
        finish(null, null, false);
      }, 1000);
    };
    const timer = setTimeout(() => { timedOut = true; stopOwnedChild(); }, timeoutMs);
    const capture = (stream, chunk) => {
      if (outputLimited) return;
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + Buffer.byteLength(chunk) > 131072) {
        outputLimited = true; stopOwnedChild(); return;
      }
      if (stream === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => capture('stdout', chunk));
    child.stderr.on('data', chunk => capture('stderr', chunk));
    child.on('error', error => { errorCode = error.code ?? 'SPAWN_ERROR'; });
    child.on('close', (code, signal) => finish(code, signal, true));
  });
}

async function archiveEntries(paths) {
  const file = await open(ASAR, 'r');
  try {
    const size = (await file.stat()).size;
    const head = Buffer.alloc(16); await file.read(head, 0, 16, 0);
    const headerSize = head.readUInt32LE(4), jsonSize = head.readUInt32LE(12);
    if (jsonSize > 16 * 1024 * 1024 || jsonSize < 1 || 8 + headerSize > size || jsonSize + 16 > 8 + headerSize) fail('ASAR_HEADER_INVALID');
    const raw = Buffer.alloc(jsonSize); await file.read(raw, 0, jsonSize, 16);
    const tree = JSON.parse(raw.toString('utf8'));
    const entries = {};
    for (const path of paths) {
      let item = tree;
      for (const part of path.split('/')) item = item?.files?.[part];
      const offset = Number(item?.offset), length = item?.size;
      if (item?.unpacked || item?.link || !Number.isSafeInteger(offset) || offset < 0 ||
        !Number.isSafeInteger(length) || length < 1 || length > 8 * 1024 * 1024 || 8 + headerSize + offset + length > size) fail('ASAR_ENTRY_INVALID');
      const bytes = Buffer.alloc(length);
      const result = await file.read(bytes, 0, length, 8 + headerSize + offset);
      if (result.bytesRead !== length) fail('ASAR_SHORT_READ');
      entries[path] = bytes;
    }
    return entries;
  } finally { await file.close(); }
}

export async function preflight(executable = ELECTRON) {
  if (resolve(executable) !== ELECTRON || await realpath(executable) !== ELECTRON || !(await lstat(executable)).isFile()) fail('UNAPPROVED_EXECUTABLE');
  if (await realpath(ASAR) !== ASAR) fail('ASAR_REDIRECTED');
  const bytes = await archiveEntries([...Object.keys(PINNED), 'package.json', `${CORE}/package.json`, `${UTILS}/package.json`]);
  for (const [path, expected] of Object.entries(PINNED)) if (hash(bytes[path]) !== expected) fail('REVIEWED_SOURCE_CHANGED');
  const manifest = JSON.parse(bytes['package.json']);
  const core = JSON.parse(bytes[`${CORE}/package.json`]);
  const utils = JSON.parse(bytes[`${UTILS}/package.json`]);
  if (manifest.name !== '@deepseek-ai/dsh-desktop' || manifest.version !== '0.2.1-rc.2' ||
    core.name !== '@deepseek-ai/cordis' || core.version !== '4.0.5' || utils.name !== '@deepseek-ai/cosmokit' || utils.version !== '1.8.6') fail('BASELINE_VERSION_CHANGED');
  const pluginPath = join(PROJECT, 'dist', 'host', 'plugin.js');
  if (await realpath(pluginPath) !== pluginPath || hash(await readFile(pluginPath)) !== PLUGIN_SHA) fail('REVIEWED_PLUGIN_CHANGED');
  return { desktop: manifest.version, core: core.version, utils: utils.version, sourceHashes: PINNED,
    pluginHash: PLUGIN_SHA, coreUrl: pathToFileURL(join(ASAR, CORE, 'lib/index.js')).href,
    utilsUrl: pathToFileURL(join(ASAR, UTILS, 'lib/index.js')).href, pluginUrl: pathToFileURL(pluginPath).href };
}

// This function is serialized as the entire probe. It has no dependency on the launcher.
async function probeMain(config) {
  const report = { status: 'FAIL', stage: 'bootstrap', versions: { ...process.versions },
    platform: process.platform, arch: process.arch,
    modules: [], blocked: { imports: 0, globalCalls: 0 }, plugin: {}, sqlite: {} };
  let root, db, hooks;
  try {
    const { strict: assert } = await import('node:assert');
    const { createHash } = await import('node:crypto');
    const { registerHooks } = await import('node:module');
    const { DatabaseSync } = await import('node:sqlite');
    assert.equal(process.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(process.env.DSH_HOME, config.dshHome);
    assert.equal(process.send, undefined);
    assert.equal(typeof process.versions.electron, 'string');
    const allowed = new Map([
      [config.baseline.coreUrl, config.baseline.sourceHashes[config.coreEntry]],
      [config.baseline.utilsUrl, config.baseline.sourceHashes[config.utilsEntry]],
      [config.baseline.pluginUrl, config.baseline.pluginHash],
    ]);
    // Deliberately no generic Node imports after bootstrap and no profile loader.
    hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === '@deepseek-ai/cosmokit' && context.parentURL === config.baseline.coreUrl) specifier = config.baseline.utilsUrl;
        if (!allowed.has(specifier)) {
          report.blocked.imports++;
          throw Object.assign(new Error('Unexpected import'), { code: 'UNEXPECTED_IMPORT' });
        }
        return nextResolve(specifier, context);
      },
      load(url, context, nextLoad) {
        if (!allowed.has(url)) {
          report.blocked.imports++;
          throw Object.assign(new Error('Unexpected module'), { code: 'UNEXPECTED_MODULE' });
        }
        const result = nextLoad(url, context);
        assert.equal(createHash('sha256').update(result.source).digest('hex'), allowed.get(url));
        report.modules.push({ url, sha256: allowed.get(url) });
        return result;
      },
    });
    for (const name of ['fetch', 'WebSocket', 'Worker', 'setTimeout', 'setInterval', 'setImmediate']) {
      if (typeof globalThis[name] === 'function') globalThis[name] = function () {
        report.blocked.globalCalls++;
        throw Object.assign(new Error('Unexpected global call'), { code: 'UNEXPECTED_GLOBAL_CALL' });
      };
    }
    report.stage = 'plugin-load';
    const { Context } = await import(config.baseline.coreUrl);
    const plugin = await import(config.baseline.pluginUrl);
    assert.equal(plugin.name, 'dafeyu'); assert.deepEqual(plugin.inject, []);
    root = new Context();
    let loadedLogs = 0, errorLogs = 0;
    root.logger.exporter({ levels: { default: 9 }, export(message) {
      if (message.type === 'error') errorLogs++;
      if (message.args[0] === 'DaFeiYu 模拟原型已加载：真实模型、账号及自动活动均未接通。') loadedLogs++;
    } });
    const fiber = root.plugin(plugin); await fiber;
    assert.equal(fiber.state, 2); assert.equal(loadedLogs, 1); assert.equal(errorLogs, 0);
    report.plugin = { loaded: true, loadedLogs, errorLogs, loadedState: fiber.state };
    report.stage = 'sqlite';
    db = new DatabaseSync(config.database);
    db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    db.prepare('INSERT INTO probe(id,value) VALUES (?,?)').run(1, 'synthetic-dafeyu');
    assert.equal(db.prepare('SELECT value FROM probe WHERE id = 1').get().value, 'synthetic-dafeyu');
    db.close(); db = undefined;
    db = new DatabaseSync(config.database);
    assert.equal(db.prepare('SELECT value FROM probe WHERE id = 1').get().value, 'synthetic-dafeyu');
    db.close(); db = undefined;
    report.sqlite = { writeRead: 'PASS', closeReopen: 'PASS', closed: true };
    report.stage = 'plugin-dispose';
    await fiber.dispose(); assert.equal(fiber.uid, null); assert.equal(fiber.state, 4);
    report.plugin.disposed = true; report.plugin.disposedState = fiber.state;
    await root.fiber.dispose(); root = undefined;
    report.plugin.rootDisposed = true;
    assert.equal(errorLogs, 0);
    assert.equal(report.modules.length, 3);
    assert.equal(report.blocked.imports, 0); assert.equal(report.blocked.globalCalls, 0);
    report.status = 'PASS'; report.stage = 'complete';
  } catch (error) {
    report.error = { name: error?.name ?? 'Error', code: error?.code ?? 'PROBE_FAILED' };
  } finally {
    try { db?.close(); } catch { report.cleanupError = true; }
    try { if (root) await root.fiber.dispose(); } catch { report.cleanupError = true; }
    hooks?.deregister();
    if (report.cleanupError) report.status = 'FAIL';
    process.stdout.write(JSON.stringify(report) + '\n');
    process.exitCode = report.status === 'PASS' ? 0 : 1;
  }
}

export async function runSmoke(options = {}) {
  const timeoutMs = validateTimeout(options.timeoutMs ?? 15000);
  const runRoot = validateRunRoot(options.runRoot ?? RUN_BASE);
  const baseline = await preflight(options.electron ?? ELECTRON);
  const runDir = await prepareRunDirectory(runRoot);
  const env = buildChildEnvironment(runDir);
  const probePath = join(runDir, 'probe.mjs');
  const config = { baseline, coreEntry: `${CORE}/lib/index.js`, utilsEntry: `${UTILS}/lib/index.js`,
    dshHome: env.DSH_HOME, database: join(runDir, 'probe.sqlite') };
  await writeFile(probePath, `(${probeMain.toString()})(${JSON.stringify(config)});\n`, { flag: 'wx' });
  const startedUtc = new Date().toISOString();
  const child = await superviseChild(ELECTRON, ['--expose-internals', probePath], { cwd: runDir, env, timeoutMs });
  let probe;
  try { probe = JSON.parse(child.stdout.trim()); } catch { probe = { status: 'FAIL', error: { code: 'NO_VALID_PROBE_REPORT' } }; }
  const status = child.terminationConfirmed && !child.timedOut && !child.outputLimited && !child.errorCode && child.exitCode === 0 && probe.status === 'PASS' ? 'PASS' : 'FAIL';
  const result = { task: 'DFY-M1-008', test: 'V-M1-CORE-SMOKE', status, startedUtc, finishedUtc: new Date().toISOString(),
    runDir, executable: ELECTRON, args: ['--expose-internals', probePath], cwd: runDir, timeoutMs,
    environmentKeys: Object.keys(env).sort(), baseline,
    child: { ...child, stdout: undefined, stderr: undefined }, probe,
    detectionScope: {
      enforced: ['reviewed source hashes', 'three imported application modules only', 'listed JS global-call guards', 'clean child environment', 'bounded owned child'],
      limits: ['not OS-level network or filesystem tracing', 'native runtime internals not instrumented', 'not an adversarial-code sandbox'],
      notRun: ['full GUI', 'desktop profile', 'settings page', 'Agent/model', 'owner session', 'Bilibili'],
    } };
  await writeFile(join(runDir, 'child.stdout.json'), child.stdout, { flag: 'wx' });
  await writeFile(join(runDir, 'child.stderr.txt'), child.stderr, { flag: 'wx' });
  await writeFile(join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}

function parseOptions(args) {
  const options = {}, seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!['--electron', '--run-root', '--timeout-ms'].includes(key) || value === undefined || seen.has(key)) fail('INVALID_ARGUMENTS');
    seen.add(key);
    if (key === '--electron') options.electron = value;
    if (key === '--run-root') options.runRoot = value;
    if (key === '--timeout-ms') options.timeoutMs = Number(value);
  }
  return options;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runSmoke(parseOptions(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({ status: result.status, evidence: join(result.runDir, 'result.json'), child: result.child, probe: result.probe }, null, 2) + '\n');
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch (error) {
    process.stderr.write(JSON.stringify({ status: 'FAIL', stage: 'launcher-preflight', code: error?.code ?? 'LAUNCHER_FAILED' }) + '\n');
    process.exitCode = 1;
  }
}
