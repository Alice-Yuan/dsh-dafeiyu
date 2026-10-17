import { readFile, writeFile } from 'node:fs/promises';

const code = await readFile(new URL('../build/client/index.js', import.meta.url), 'utf8');
// The installed 0.2.1-rc.2 carrier uses this exact lazy factory registration form.
// No dependencies are copied into the bundle; React is supplied by the host baseline.
if (/require\(["'](?!react["'])/.test(code)) throw new Error('Unexpected client dependency');
const { name } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const bundle = 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(name) + ', factory: (require) => {\n'
  + 'const module = { exports: {} }; const exports = module.exports;\n'
  + code + '\nreturn module.exports;\n} });\n';
await writeFile(new URL('../dist/client.js', import.meta.url), bundle);
