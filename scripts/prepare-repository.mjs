// Build an explicit public source distribution; never export local profiles or evidence.
import { readFile, writeFile, readdir, mkdir, copyFile, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'tmp', 'repository-export');
const files = ['.gitignore', 'README.md', 'package.json', 'package-lock.json',
  'tsconfig.json', 'tsconfig.client.json', 'cordis.patch.yml', 'docs/desktop-install.md',
  'scripts/build-client.mjs', 'scripts/render-preview.mjs', 'scripts/check-desktop-bundle.mjs',
  'scripts/desktop-core-smoke.mjs', 'scripts/bundle-install-guard.mjs', 'scripts/pilot-host-smoke.mjs',
  'scripts/locked-preflight-guard.mjs', 'scripts/prepare-repository.mjs'];
async function collect(path) {
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error('SYMLINK_IN_DISTRIBUTION');
    if (entry.isDirectory()) await collect(child);
    else if (entry.isFile() && child !== 'dist/settings-preview.html') files.push(child);
  }
}
for (const path of ['src', 'dist', 'test']) await collect(path);
await mkdir(output, { recursive: true });
const tree = [];
for (const path of files.sort()) {
  const source = join(root, path);
  if (!(await lstat(source)).isFile()) throw new Error('NOT_A_FILE');
  const content = await readFile(source, 'utf8');
  // Reject concrete personal paths and secret-like payloads, not generic security vocabulary.
  if (/C:[\\/]+Users[\\/]+(?!Public\b|example\b|test\b)/i.test(content) ||
      /(?:gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|SESSDATA\s*[:=]\s*['"][^'"]+)/.test(content)) {
    throw new Error(`PRIVATE_CONTENT: ${path}`);
  }
  const target = join(output, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  tree.push({ path, mode: '100644', type: 'blob', content });
}
// Every relative Markdown link in the exported documentation must also be exported.
const names = new Set(files);
for (const entry of tree.filter(item => item.path.endsWith('.md'))) {
  for (const match of entry.content.matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^[a-z]+:|^#/i.test(link)) continue;
    const target = join(dirname(entry.path), link.split('#')[0]).replaceAll('\\', '/');
    if (!names.has(target)) throw new Error(`BROKEN_PUBLIC_LINK: ${entry.path}`);
  }
}
await mkdir(join(root, 'tmp/rename-contract'), { recursive: true });
await writeFile(join(root, 'tmp/rename-contract/repository-tree.json'), JSON.stringify(tree));
const report = { count: tree.length, totalBytes: tree.reduce((n, item) => n + Buffer.byteLength(item.content), 0),
  output, privateContentScan: 'PASS', relativeMarkdownLinks: 'PASS',
  files: tree.map(({ path, content }) => ({ path, sha256: createHash('sha256').update(content).digest('hex') })) };
await writeFile(join(root, 'tmp/rename-contract/repository-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({count: report.count, totalBytes: report.totalBytes, privateContentScan: report.privateContentScan, relativeMarkdownLinks: report.relativeMarkdownLinks}));
