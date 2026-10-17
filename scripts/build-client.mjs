import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const result = await build({ entryPoints: [fileURLToPath(new URL('../src/client/index.ts', import.meta.url))], bundle: true, platform: 'browser', format: 'cjs', target: 'es2023', external: ['react', 'zod'], write: false });
const code = result.outputFiles[0].text;
// The installed 0.2.1-rc.2 carrier uses this exact lazy factory registration form.
// Pure Remote descriptor code is bundled; React and Zod are supplied by the host.
if (/require\(["'](?!(?:react|zod)["'])/.test(code)) throw new Error('Unexpected client dependency');
const { name } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const bundle = 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(name) + ', factory: (require) => {\n'
  + 'const module = { exports: {} }; const exports = module.exports;\n'
  + code + '\nreturn module.exports;\n} });\n';
await writeFile(new URL('../dist/client.js', import.meta.url), bundle);
