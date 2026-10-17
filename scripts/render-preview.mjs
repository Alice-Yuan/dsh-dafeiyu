import { readFile, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
let registration;
const code = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8');
runInNewContext(code, { window: { __ModuleLoader__: { load: value => { registration = value; } } } });
const client = registration.factory(name => {
  if (!['react', 'zod'].includes(name)) throw new Error('Unexpected dependency');
  return require(name);
});
const markup = renderToStaticMarkup(createElement(client.SettingsPanel));
const html = '<!doctype html><html lang="zh-CN"><meta charset="UTF-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>大肥鱼 · 未连接宿主的设置预览</title>'
  + '<style>body{margin:40px;background:#f3f5f8;color:#182333;font:16px/1.7 system-ui,sans-serif}'
  + 'section{margin:auto;background:white}small{color:#556478}input,button{padding:7px;margin:6px}</style>'
  + '<body>' + markup + '</body></html>\n';
await writeFile(new URL('../dist/settings-preview.html', import.meta.url), html);
console.log('Created dist/settings-preview.html (static mock preview; no server or DSH launched)');
