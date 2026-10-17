// Pure guards for the reviewed Desktop profile. Unknown configuration fails closed.
import { isDeepStrictEqual } from 'node:util';

const fail = code => { throw Object.assign(new Error(code), { code }); };
const same = (a, b, code) => { if (!isDeepStrictEqual(a, b)) fail(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function lockedMetadataRequests(lock) {
  if (!object(lock.packages)) fail('INVALID_LOCK_SECTION');
  const requests = new Map();
  for (const [key, value] of Object.entries(lock.packages)) {
    const match = /^((?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+)@(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)$/.exec(key);
    if (!match || typeof value.resolution?.integrity !== 'string') fail('UNREVIEWED_LOCK_RESOLUTION');
    const [, name, version] = match;
    if (!requests.has(name)) requests.set(name, { name, pins: [] });
    requests.get(name).pins.push({ version, integrity: value.resolution.integrity });
  }
  return [...requests.values()];
}

export function encodeOfficialMetadata(request, text, etag) {
  const meta = JSON.parse(text);
  if (meta.name !== request.name) fail('REGISTRY_NAME_MISMATCH');
  for (const pin of request.pins) {
    const published = meta.versions?.[pin.version];
    if (published?.dist?.integrity !== pin.integrity || !Number.isFinite(Date.parse(meta.time?.[pin.version]))) fail('REGISTRY_PIN_MISMATCH');
    if (new URL(published.dist.tarball).origin !== 'https://registry.npmjs.org') fail('UNREVIEWED_TARBALL_ORIGIN');
  }
  // pnpm 11.28.5 loadMeta/parseNdjsonMeta accepts this two-line format.
  // Preserve the complete official body; do not synthesize publication times or versions.
  const modified = meta.modified ?? meta.time?.modified;
  return { full: JSON.stringify({ etag, modified }) + '\n' + text,
    abbreviated: JSON.stringify({ fullEtag: etag, modified }) + '\n' + text };
}

export function shadowInputs(manifest, workspace) {
  if (!object(manifest) || !object(workspace)) fail('INVALID_PROFILE_INPUT');
  // Do not silently discard future package-manager configuration in package.json.
  if (Object.keys(manifest).some(key => !['name', 'private', 'dsh', 'dependencies'].includes(key))) fail('UNREVIEWED_MANIFEST_FIELD');
  if (!object(manifest.dependencies) || Object.hasOwn(manifest.dependencies, 'dsh-dafeyu')) fail('INVALID_BASE_DEPENDENCIES');
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    if (!/^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(name) || typeof version !== 'string' || !/^[\d^~][\d.a-zA-Z^~+*-]*$/.test(version)) fail('UNREVIEWED_DEPENDENCY');
  }
  const fields = ['packages', 'nodeLinker', 'autoInstallPeers', 'minimumReleaseAgeExclude', 'allowBuilds'];
  if (Object.keys(workspace).some(key => !fields.includes(key))) fail('UNREVIEWED_WORKSPACE_FIELD');
  same(workspace.packages, ['.'], 'UNREVIEWED_WORKSPACE_MEMBERS');
  if (workspace.nodeLinker !== 'hoisted' || workspace.autoInstallPeers !== false) fail('UNREVIEWED_RESOLUTION_POLICY');
  if (!Array.isArray(workspace.minimumReleaseAgeExclude) || workspace.minimumReleaseAgeExclude.some(value =>
    typeof value !== 'string' || !/^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+@\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value))) fail('UNREVIEWED_AGE_EXCEPTION');
  if (!object(workspace.allowBuilds) || Object.values(workspace.allowBuilds).some(value => typeof value !== 'boolean')) fail('UNREVIEWED_BUILD_POLICY');
  return { name: 'dafeyu-locked-preflight', private: true, dependencies: structuredClone(manifest.dependencies) };
}

export function verifyOnlyCandidateAdded(before, after, manifestBefore, manifestAfter, { specifiers, integrity }) {
  if (![before, after, manifestBefore, manifestAfter].every(object)) fail('INVALID_COMPARISON_INPUT');
  const name = 'dsh-dafeyu';
  const expectedImporter = before.importers?.['.'];
  const actualImporter = after.importers?.['.'];
  if (!object(expectedImporter) || !object(actualImporter) || !object(actualImporter.dependencies)) fail('INVALID_IMPORTER');
  const added = actualImporter.dependencies[name];
  if (!object(added) || !specifiers.includes(added.specifier) || !specifiers.includes(added.version)) fail('UNEXPECTED_CANDIDATE_REFERENCE');
  const expectedImporters = structuredClone(before.importers);
  if (Object.hasOwn(expectedImporters['.'].dependencies ?? {}, name)) fail('CANDIDATE_ALREADY_PRESENT');
  expectedImporters['.'].dependencies ??= {};
  expectedImporters['.'].dependencies[name] = added;
  same(after.importers, expectedImporters, 'OLD_IMPORTER_CHANGED');
  const key = `${name}@${added.version}`;
  for (const section of ['packages', 'snapshots']) {
    if (!object(before[section]) || !object(after[section]) || Object.hasOwn(before[section], key)) fail('INVALID_LOCK_SECTION');
    const expected = structuredClone(after[section]);
    if (!Object.hasOwn(expected, key)) fail('CANDIDATE_LOCK_ENTRY_MISSING');
    delete expected[key];
    same(expected, before[section], 'OLD_LOCK_ENTRIES_CHANGED');
  }
  same(after.snapshots[key], {}, 'UNEXPECTED_CANDIDATE_DEPENDENCIES');
  same(after.packages[key], { resolution: { integrity, tarball: added.version }, version: '0.0.1-mock.1',
    engines: { node: '>=24.0.0 <25' } }, 'UNEXPECTED_CANDIDATE_METADATA');
  const beforeRest = { ...before }, afterRest = { ...after };
  for (const section of ['packages', 'snapshots', 'importers']) { delete beforeRest[section]; delete afterRest[section]; }
  same(afterRest, beforeRest, 'LOCK_SETTINGS_CHANGED');
  const expectedManifest = structuredClone(manifestBefore);
  expectedManifest.dependencies[name] = added.specifier;
  same(manifestAfter, expectedManifest, 'MANIFEST_UNRELATED_CHANGE');
  return { oldPackages: Object.keys(before.packages).length, oldSnapshots: Object.keys(before.snapshots).length,
    oldImporters: Object.keys(before.importers).length, addedPackages: 1, addedSnapshots: 1,
    candidateSpecifier: added.specifier, allOldEntriesUnchanged: true };
}
