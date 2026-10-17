import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { PROJECT, RUN_BASE, validateRunRoot, prepareRunDirectory, buildChildEnvironment, validateTimeout, superviseChild, preflight } from '../scripts/desktop-core-smoke.mjs';

test('V-M1-LAUNCHER: output scope rejects traversal, siblings and project root', () => {
  assert.equal(validateRunRoot(RUN_BASE), RUN_BASE);
  assert.equal(validateRunRoot(join(RUN_BASE, 'checks')), join(RUN_BASE, 'checks'));
  for (const value of [PROJECT, dirname(PROJECT), RUN_BASE + '-sibling', RUN_BASE + '/child/../escape', '\0']) {
    assert.throws(() => validateRunRoot(value), /UNSAFE_RUN_ROOT/);
  }
});

test('V-M1-LAUNCHER: each run has an exclusive directory and never overwrites an earlier result', async () => {
  const first = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  await writeFile(join(first, 'preserve.txt'), 'synthetic retained fixture', { flag: 'wx' });
  const second = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  assert.notEqual(first, second);
});

test('V-M1-LAUNCHER: an existing directory junction is rejected before descending', async t => {
  if (process.env.DFY_TEST_JUNCTION !== '1') {
    t.skip('Junction fixture creation was denied on this host; explicit opt-in required for a later authorized environment');
    return;
  }
  const fixture = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  const target = join(fixture, 'target'); await mkdir(target);
  const link = join(fixture, 'redirect');
  try { await symlink(target, link, 'junction'); } catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('OS/sandbox denies junction fixture creation; no escalation; actual junction rejection NOT_RUN');
      return;
    }
    throw error;
  }
  await assert.rejects(prepareRunDirectory(join(link, 'new-directory')), /RUN_ROOT_REDIRECTED/);
});

test('V-M1-LAUNCHER: a file cannot replace a directory component', async () => {
  const fixture = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  const file = join(fixture, 'not-directory'); await writeFile(file, 'synthetic');
  await assert.rejects(prepareRunDirectory(join(file, 'child')), /RUN_ROOT_REDIRECTED/);
});

test('V-M1-LAUNCHER: environment is an explicit whitelist and drops caller secrets/options', () => {
  const env = buildChildEnvironment(join(RUN_BASE, 'synthetic-run'), {
    SystemRoot: process.env.SystemRoot, MODEL_API_KEY: 'SYNTHETIC-NOT-A-SECRET',
    NODE_OPTIONS: '--require=untrusted', DSH_HOME: 'original-home', PATH: 'original-path',
  });
  assert.deepEqual(Object.keys(env).sort(), ['APPDATA', 'DSH_HOME', 'ELECTRON_RUN_AS_NODE', 'HOME', 'LOCALAPPDATA', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'WINDIR'].sort());
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(env.DSH_HOME, join(RUN_BASE, 'synthetic-run', 'dsh-home'));
  assert.equal(env.NODE_OPTIONS, undefined); assert.equal(env.MODEL_API_KEY, undefined); assert.equal(env.PATH, undefined);
});

test('V-M1-LAUNCHER: deadline cannot be disabled or exceed 15 seconds', () => {
  assert.equal(validateTimeout(15000), 15000);
  for (const value of [0, -1, 15001, Infinity, NaN, 1.5, '100']) assert.throws(() => validateTimeout(value), /INVALID_TIMEOUT/);
});

test('V-M1-LAUNCHER: unapproved executable is rejected without launching it', async () => {
  await assert.rejects(preflight(process.execPath), /UNAPPROVED_EXECUTABLE/);
});

test('V-M1-LAUNCHER: successful local child reports exit and bounded captured output', async () => {
  const dir = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  const result = await superviseChild(process.execPath, ['-e', 'process.stdout.write("fixture");'], {
    cwd: dir, env: buildChildEnvironment(dir), timeoutMs: 3000,
  });
  assert.equal(result.exitCode, 0); assert.equal(result.stdout, 'fixture');
  assert.equal(result.terminationConfirmed, true); assert.equal(result.timedOut, false);
});

test('V-M1-LAUNCHER: timeout stops only the owned child and confirms its exit', async () => {
  const dir = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  const options = { cwd: dir, env: buildChildEnvironment(dir), windowsHide: true, stdio: 'ignore' };
  const sibling = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], options);
  const siblingClosed = once(sibling, 'close');
  try {
    const result = await superviseChild(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { ...options, timeoutMs: 250 });
    assert.equal(result.timedOut, true); assert.equal(result.terminationConfirmed, true);
    assert.equal(result.errorCode, null); assert.notEqual(result.pid, sibling.pid);
    assert.doesNotThrow(() => process.kill(sibling.pid, 0));
    assert.equal(sibling.exitCode, null);
  } finally { sibling.kill(); await siblingClosed; }
});

test('V-M1-LAUNCHER: excess output stops the owned child rather than growing evidence unbounded', async () => {
  const dir = await prepareRunDirectory(join(RUN_BASE, 'regressions'));
  const result = await superviseChild(process.execPath, ['-e', 'process.stdout.write("x".repeat(200000));setInterval(() => {}, 1000);'], {
    cwd: dir, env: buildChildEnvironment(dir), timeoutMs: 3000,
  });
  assert.equal(result.outputLimited, true); assert.equal(result.terminationConfirmed, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 131072);
});
