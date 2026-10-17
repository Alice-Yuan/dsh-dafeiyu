import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFreshBundleTarget } from '../scripts/bundle-install-guard.mjs';

test('V-M1-BUNDLE-SAFETY: unrelated names and config data do not claim plugin identity', () => {
  const entries = [{ id: 'another', name: 'dsh-dafeyu-tools', config: { id: 'dafeyu', name: 'dsh-dafeyu' } }];
  const before = structuredClone(entries);
  assert.doesNotThrow(() => assertFreshBundleTarget(entries, ['dsh-dafeyu-tools']));
  assert.deepEqual(entries, before);
});
test('V-M1-BUNDLE-SAFETY: disabled same-ID row is rejected without exposing or changing config', () => {
  const entries = [{ id: 'dafeyu', name: 'another', disabled: true, config: { synthetic: 'never-in-error' } }];
  const before = structuredClone(entries);
  assert.throws(() => assertFreshBundleTarget(entries, []), error => {
    assert.equal(error.code, 'DFY_BUNDLE_CONFLICT');
    assert.deepEqual(error.reasons, ['row-id']);
    assert.doesNotMatch(JSON.stringify(error) + error.message, /never-in-error/);
    return true;
  });
  assert.deepEqual(entries, before);
});
test('V-M1-BUNDLE-SAFETY: same package under a different ID in a nested group is rejected', () => {
  const entries = [{ id: 'group', group: true, config: [{ id: 'alias', name: 'dsh-dafeyu' }] }];
  assert.throws(() => assertFreshBundleTarget(entries, []), error =>
    error.code === 'DFY_BUNDLE_CONFLICT' && error.reasons.includes('row-package'));
});
test('V-M1-BUNDLE-SAFETY: registered package without an active row is still a conflict', () => {
  assert.throws(() => assertFreshBundleTarget([], ['dsh-dafeyu']), error =>
    error.code === 'DFY_BUNDLE_CONFLICT' && error.reasons.includes('registered-package'));
});
test('V-M1-BUNDLE-SAFETY: missing inventory or malformed group cannot silently pass', () => {
  assert.throws(() => assertFreshBundleTarget([], undefined), { code: 'DFY_INVENTORY_REQUIRED' });
  assert.throws(() => assertFreshBundleTarget([{ group: true, config: {} }], []), { code: 'DFY_INVALID_ENTRY_TREE' });
});
test('V-M1-RENAME: both spellings reserve the stable plugin identity', () => {
  for (const name of ['dsh-dafeyu', 'dsh-dafeiyu']) {
    assert.throws(() => assertFreshBundleTarget([], [name]), error =>
      error.code === 'DFY_BUNDLE_CONFLICT' && error.reasons.includes('registered-package'));
    assert.throws(() => assertFreshBundleTarget([{ id: 'alias', name, disabled: true }], []), error =>
      error.code === 'DFY_BUNDLE_CONFLICT' && error.reasons.includes('row-package'));
  }
});
