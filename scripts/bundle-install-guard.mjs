// Pure pre-install check for an already parsed, composed entry tree and a known
// inventory of dependency/selected-bundle package names. Never reads a profile.
export function assertFreshBundleTarget(entries, existingPackageNames) {
  const fail = code => { throw Object.assign(new Error(code), { code }); };
  if (!Array.isArray(entries) || !Array.isArray(existingPackageNames) ||
    !existingPackageNames.every(name => typeof name === 'string')) fail('DFY_INVENTORY_REQUIRED');
  const reasons = new Set();
  // The spelling changed in mock.2; both packages reserve the same stable row ID.
  const names = ['dsh-dafeyu', 'dsh-dafeiyu'];
  if (existingPackageNames.some(name => names.includes(name))) reasons.add('registered-package');
  const visit = rows => {
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail('DFY_INVALID_ENTRY_TREE');
      if (row.id === 'dafeyu') reasons.add('row-id');
      if (names.includes(row.name)) reasons.add('row-package');
      if (row.group) {
        if (!Array.isArray(row.config)) fail('DFY_INVALID_ENTRY_TREE');
        visit(row.config);
      }
    }
  };
  visit(entries); // Disabled rows still reserve their identity.
  if (reasons.size) {
    throw Object.assign(new Error('DFY_BUNDLE_CONFLICT'), {
      code: 'DFY_BUNDLE_CONFLICT', reasons: [...reasons].sort(),
    }); // Do not attach plugin configuration or private values to errors.
  }
}
