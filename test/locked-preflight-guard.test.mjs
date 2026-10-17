import test from 'node:test';
import assert from 'node:assert/strict';
import { shadowInputs, verifyOnlyCandidateAdded, lockedMetadataRequests, encodeOfficialMetadata } from '../scripts/locked-preflight-guard.mjs';

const inputs = () => ({ manifest: { name: 'dsh-profile-desktop', private: true,
  dsh: { syntheticPrivateMarker: 'DO_NOT_COPY' }, dependencies: { existing: '^1.2.3' } },
workspace: { packages: ['.'], nodeLinker: 'hoisted', autoInstallPeers: false,
  minimumReleaseAgeExclude: ['existing@1.2.3'], allowBuilds: { existing: true } } });
function fixture() {
  const before = { lockfileVersion: '9.0', settings: { autoInstallPeers: false },
    importers: { '.': { dependencies: { existing: { specifier: '^1.2.3', version: '1.2.3' } } } },
    packages: { 'existing@1.2.3': { resolution: { integrity: 'synthetic-existing' } } }, snapshots: { 'existing@1.2.3': {} } };
  const after = structuredClone(before);
  const spec = 'file:../../../artifacts/dsh-dafeyu-0.0.1-mock.1.tgz';
  const key = `dsh-dafeyu@${spec}`;
  after.importers['.'].dependencies['dsh-dafeyu'] = { specifier: spec, version: spec };
  after.packages[key] = { resolution: { integrity: 'synthetic-candidate', tarball: spec }, version: '0.0.1-mock.1', engines: { node: '>=24.0.0 <25' } };
  after.snapshots[key] = {};
  const manifestBefore = { name: 'synthetic', private: true, dependencies: { existing: '^1.2.3' } };
  const manifestAfter = structuredClone(manifestBefore);
  manifestAfter.dependencies['dsh-dafeyu'] = spec;
  return { before, after, manifestBefore, manifestAfter, key, candidate: { specifiers: [spec], integrity: 'synthetic-candidate' } };
}
const check = f => verifyOnlyCandidateAdded(f.before, f.after, f.manifestBefore, f.manifestAfter, f.candidate);

test('metadata request scope comes only from exact old lock pins, including scoped packages', () => {
  const lock = { packages: { '@example/one@1.2.3': { resolution: { integrity: 'one' } },
    '@example/one@1.2.4': { resolution: { integrity: 'two' } } } };
  assert.deepEqual(lockedMetadataRequests(lock), [{ name: '@example/one', pins: [{ version: '1.2.3', integrity: 'one' }, { version: '1.2.4', integrity: 'two' }] }]);
  for (const key of ['../escape@1.0.0', 'extra@file:outside', 'extra@latest']) {
    assert.throws(() => lockedMetadataRequests({ packages: { [key]: { resolution: { integrity: 'synthetic' } } } }), { code: 'UNREVIEWED_LOCK_RESOLUTION' });
  }
});

test('metadata body and times are preserved; mismatched name, hash, time or origin are refused', () => {
  const request = { name: 'existing', pins: [{ version: '1.2.3', integrity: 'synthetic' }] };
  const meta = { name: 'existing', versions: { '1.2.3': { dist: { integrity: 'synthetic', tarball: 'https://registry.npmjs.org/existing/-/existing-1.2.3.tgz' } } }, time: { '1.2.3': '2026-01-01T00:00:00.000Z' } };
  const body = JSON.stringify(meta, null, 2);
  const encoded = encodeOfficialMetadata(request, body, 'synthetic-etag');
  for (const text of Object.values(encoded)) assert.equal(text.slice(text.indexOf('\n') + 1), body);
  for (const change of [m => { m.name = 'other'; }, m => { m.versions['1.2.3'].dist.integrity = 'different'; },
    m => { delete m.time['1.2.3']; }, m => { m.versions['1.2.3'].dist.tarball = 'https://unapproved.invalid/package.tgz'; }]) {
    const wrong = structuredClone(meta); change(wrong);
    assert.throws(() => encodeOfficialMetadata(request, JSON.stringify(wrong), null));
  }
});

test('shadow retains dependencies without private DSH settings and does not mutate inputs', () => {
  const { manifest, workspace } = inputs(), saved = structuredClone({ manifest, workspace });
  const result = shadowInputs(manifest, workspace);
  assert.deepEqual(result.dependencies, manifest.dependencies);
  assert.equal(JSON.stringify(result).includes('DO_NOT_COPY'), false);
  assert.deepEqual({ manifest, workspace }, saved);
});

test('unknown or broadened policy, extra members and manifest policy fail closed', () => {
  for (const mutate of [w => { w.trustLockfile = true; }, w => { w.minimumReleaseAge = 0; },
    w => { w.minimumReleaseAgeExclude = ['existing@*']; }, w => { w.packages.push('../outside'); },
    w => { w.nodeLinker = 'isolated'; }, w => { w.allowBuilds.existing = 'yes'; }]) {
    const { manifest, workspace } = inputs(); mutate(workspace);
    assert.throws(() => shadowInputs(manifest, workspace), { code: /^UNREVIEWED_/ });
  }
  const { manifest, workspace } = inputs(); manifest.pnpm = { overrides: { existing: '2.0.0' } };
  assert.throws(() => shadowInputs(manifest, workspace), { code: 'UNREVIEWED_MANIFEST_FIELD' });
});

test('only the exact fixed candidate is accepted without changing comparison inputs', () => {
  const f = fixture(), saved = structuredClone(f);
  assert.deepEqual(check(f), { oldPackages: 1, oldSnapshots: 1, oldImporters: 1, addedPackages: 1,
    addedSnapshots: 1, candidateSpecifier: f.candidate.specifiers[0], allOldEntriesUnchanged: true });
  assert.deepEqual(f, saved);
});

test('old package deletion, metadata change, added unrelated package or snapshot change are rejected', () => {
  for (const mutate of [f => { delete f.after.packages['existing@1.2.3']; },
    f => { f.after.packages['existing@1.2.3'].resolution.integrity = 'changed'; },
    f => { f.after.packages['extra@1.0.0'] = {}; },
    f => { f.after.snapshots['existing@1.2.3'].dependencies = { extra: '1.0.0' }; }]) {
    const f = fixture(); mutate(f); assert.throws(() => check(f), { code: 'OLD_LOCK_ENTRIES_CHANGED' });
  }
});

test('old importer ranges, versions, other importers and lock settings cannot drift', () => {
  for (const mutate of [f => { f.after.importers['.'].dependencies.existing.specifier = '1.2.3'; },
    f => { f.after.importers['.'].dependencies.existing.version = '2.0.0'; },
    f => { f.after.importers.extra = {}; }]) {
    const f = fixture(); mutate(f); assert.throws(() => check(f), { code: 'OLD_IMPORTER_CHANGED' });
  }
  const f = fixture(); f.after.settings.autoInstallPeers = true;
  assert.throws(() => check(f), { code: 'LOCK_SETTINGS_CHANGED' });
});

test('candidate references, integrity and dependencies are verified', () => {
  const normalized = fixture();
  const absolute = 'file:D:/synthetic/dsh-dafeyu-0.0.1-mock.1.tgz';
  normalized.candidate.specifiers.push(absolute);
  normalized.after.importers['.'].dependencies['dsh-dafeyu'].specifier = absolute;
  normalized.manifestAfter.dependencies['dsh-dafeyu'] = absolute;
  assert.equal(check(normalized).allOldEntriesUnchanged, true);
  const f = fixture(); f.after.importers['.'].dependencies['dsh-dafeyu'].version = 'file:unreviewed.tgz';
  assert.throws(() => check(f), { code: 'UNEXPECTED_CANDIDATE_REFERENCE' });
  const g = fixture(); g.after.packages[g.key].resolution.integrity = 'unreviewed';
  assert.throws(() => check(g), { code: 'UNEXPECTED_CANDIDATE_METADATA' });
  const h = fixture(); h.after.snapshots[h.key].dependencies = { extra: '1.0.0' };
  assert.throws(() => check(h), { code: 'UNEXPECTED_CANDIDATE_DEPENDENCIES' });
});

test('manifest changes are rejected without exposing changed contents in errors', () => {
  const f = fixture(); f.manifestAfter.syntheticSecret = 'PRIVATE_TEST_MARKER';
  assert.throws(() => check(f), error => error.code === 'MANIFEST_UNRELATED_CHANGE' && !error.message.includes('PRIVATE_TEST_MARKER'));
});
