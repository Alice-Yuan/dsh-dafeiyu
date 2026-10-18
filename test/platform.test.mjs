import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Bilibili, parseLossless, commentOf, signWbi } from '../dist/platform/bilibili.js';
import { WindowsVault, credentialOf } from '../dist/platform/vault.js';

// Synthetic credentials, never read from any browser or account.
const credential = { uid: '30001', sessdata: 'synthetic-session-value', csrf: 'synthetic-csrf-value', buvid3: 'synthetic-device-value' };
const signal = () => new AbortController().signal;
const ok = (data, headers) => new Response(JSON.stringify({ code: 0, data }), { headers });
const vault = () => ({ value: credential, read: async function () { return this.value; }, write: async function (c) { this.value = c; }, remove: async function () { this.value = null; } });
const row = { oid: '20001', type: 1, rpid: '90071992547409931234', root: '0', parent: '0', member: { mid: '30001' }, content: { message: '合成文本' }, ctime: 100 };
const nav = { isLogin: true, mid: '30001', uname: '合成机器人', wbi_img: { img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png', sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png' } };
const target = { bvid: 'BV1GJ411x7h7', aid: '20001', root: '0', parent: '0' };

test('platform preserves integer digits and rejects mismatched resources', () => {
  assert.equal(parseLossless('{"id":90071992547409931234}').id, row.rpid);
  assert.equal(commentOf(row, '20001').id, row.rpid);
  assert.throws(() => commentOf({ ...row, oid: '2' }, '20001'), /TARGET_MISMATCH/);
  assert.throws(() => commentOf({ ...row, rpid: Number(row.rpid) }, '20001'), /INVALID_PLATFORM_ID/);
  assert.throws(() => credentialOf({ ...credential, sessdata: 'injected\r\nCookie' }));
});

test('WBI signer has a fixed regression vector for ordering and digest', () => {
  assert.equal(signWbi({ foo: '114', bar: '514', baz: '1919810' }, '7cd084941338484aae1ad9425b84077c', '4932caff0ff746eab6f01bf08b70ac45', 1702204169), 'bar=514&baz=1919810&foo=114&wts=1702204169&w_rid=6149fdadf571698ca7e6a567265cd0ee');
});

test('platform account identity comes from authenticated server response', async () => {
  const adapter = new Bilibili(vault(), async () => ok({ ...nav, mid: '30002' }));
  await assert.rejects(adapter.account(signal()), /ACCOUNT_CHANGED/);
});
test('authenticated pagination requires an explicitly writable comment area and preserves cursors', async () => {
  let writable = false; let cursor;
  const adapter = new Bilibili(vault(), async url => {
    const u = new URL(url);
    if (u.pathname === '/x/web-interface/nav') return ok(nav);
    assert.equal(u.searchParams.get('ps'), '20'); cursor = JSON.parse(u.searchParams.get('pagination_str')).offset;
    return ok({ config: { read_only: !writable }, control: { input_disable: !writable }, replies: [row], cursor: { is_end: false, pagination_reply: { next_offset: 'opaque-next' } } });
  });
  await assert.rejects(adapter.comments('20001', '0', null, true, signal()), /COMMENTS_READ_ONLY/);
  writable = true; const page = await adapter.comments('20001', '0', 'opaque-before', true, signal());
  assert.equal(cursor, 'opaque-before'); assert.equal(page.next, 'opaque-next'); assert.equal(page.comments[0].id, row.rpid);
});
test('send accepts only a receipt bound to the exact resource, account and thread', async () => {
  let returned = row;
  const adapter = new Bilibili(vault(), async () => ok({ reply: returned }));
  assert.deepEqual(await adapter.send(target, '合成发言', signal()), { id: row.rpid, root: '0', parent: '0' });
  for (const value of [{ ...row, oid: '99' }, { ...row, member: { mid: '99' } }, { ...row, parent: '99' }]) {
    returned = value; await assert.rejects(adapter.send(target, '合成发言', signal()), /SEND_OUTCOME_UNKNOWN/);
  }
});

test('video lookup binds BV/aid and sends no cookies to the subtitle CDN', async () => {
  let subtitleCalls = 0;
  const adapter = new Bilibili(vault(), async (url, options) => {
    const u = new URL(url); assert.equal(options.redirect, 'error');
    if (u.pathname === '/x/web-interface/view') return ok({ bvid: target.bvid, aid: target.aid, cid: '20002', state: 0, title: '合成', desc: '' });
    if (u.pathname === '/x/web-interface/nav') return ok(nav);
    if (u.pathname === '/x/player/wbi/v2') { assert.equal(u.searchParams.get('aid'), target.aid); return ok({ subtitle: { subtitles: [{ lan: 'zh-CN', subtitle_url: '//i0.hdslb.com/synthetic.json' }] } }); }
    assert.equal(u.hostname, 'i0.hdslb.com'); assert.equal(options.headers, undefined); subtitleCalls++;
    return new Response('{"body":[{"content":"字幕内容是外部数据"}]}');
  });
  const material = await adapter.video(target.bvid, signal()); assert.equal(material.aid, target.aid); assert.equal(subtitleCalls, 1);
  const wrong = new Bilibili(vault(), async () => ok({ bvid: 'BV1xx411c7mD', state: 0 }));
  await assert.rejects(wrong.video(target.bvid, signal()), /VIDEO_UNAVAILABLE/);
});

test('subtitle absence is explicit and untrusted subtitle URLs are rejected', async () => {
  let sub = [];
  const adapter = new Bilibili(vault(), async url => {
    if (new URL(url).pathname === '/x/web-interface/nav') return ok(nav);
    if (new URL(url).pathname === '/x/web-interface/view') return ok({ bvid: target.bvid, aid: '20001', cid: '20002', state: 0, title: '合成', desc: '' });
    return ok({ subtitle: { subtitles: sub } });
  });
  assert.equal((await adapter.video(target.bvid, signal())).subtitle, null);
  sub = [{ lan: 'zh', subtitle_url: 'https://hdslb.com.evil.test/private' }];
  await assert.rejects(adapter.video(target.bvid, signal()), /SUBTITLE_TARGET_DENIED/);
});

test('send disconnect, malformed receipt and HTTP rejection never trigger a retry', async () => {
  for (const result of [() => { throw new Error('synthetic network failure'); }, () => ok({ reply: { rpid: '88', root: 'wrong', parent: '0' } }), () => new Response('', { status: 503 })]) {
    let calls = 0; const adapter = new Bilibili(vault(), async (_url, options) => { calls++; assert.equal(options.method, 'POST'); assert.equal(options.body.get('oid'), '20001'); return result(); });
    await assert.rejects(adapter.send(target, '合成发言', signal()), /SEND_OUTCOME_UNKNOWN/); assert.equal(calls, 1);
  }
});

test('cancelled sends never reach transport and oversized responses fail closed', async () => {
  let calls = 0; const adapter = new Bilibili(vault(), async () => { calls++; return new Response('x'.repeat(2_000_001)); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(adapter.send(target, '合成', controller.signal)); assert.equal(calls, 0);
  await assert.rejects(adapter.account(signal()), /PLATFORM_SCHEMA_CHANGED/);
});

test('visibility distinguishes authenticated and anonymous read-back; absence stays unknown', async () => {
  const calls = []; const adapter = new Bilibili(vault(), async (_url, options) => { const auth = !!options.headers.Cookie; calls.push(auth); return ok({ root: auth ? row : null, replies: [], page: { num: 1, count: 0, size: 20 } }); });
  assert.deepEqual(await adapter.verify(target, row.rpid, credential.uid, signal()), { selfVisible: true, publicVisible: null });
  assert.deepEqual(calls, [true, false]);
});

test('QR result exposes only account identity; credentials pass server validation before storage', async () => {
  const storage = vault(); storage.value = null; let now = 10000; let polls = 0;
  const adapter = new Bilibili(storage, async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/generate')) return ok({ url: 'https://passport.bilibili.com/qrcode/synthetic', qrcode_key: 'synthetic-qr-key' });
    if (path.endsWith('/poll')) { polls++; return ok({ code: 0, url: 'https://untrusted.invalid/cross-domain' }, [
      ['Set-Cookie', 'SESSDATA=synthetic-session-value; HttpOnly; Secure'],
      ['Set-Cookie', 'bili_jct=synthetic-csrf-value; Secure'],
      ['Set-Cookie', 'DedeUserID=30001; Secure'],
    ]); }
    if (path.endsWith('/spi')) return ok({ b_3: credential.buvid3 });
    return ok(nav);
  }, () => now);
  const qr = await adapter.loginStart(signal()); assert.match(qr.image, /^data:image\/png;base64,/); assert.equal(qr.key, undefined);
  const result = await adapter.loginPoll(qr.loginId, signal()); assert.deepEqual(result, { state: 'authenticated', account: { uid: '30001', name: '合成机器人' } });
  assert.deepEqual(storage.value, credential); assert.equal(polls, 1); assert.ok(!JSON.stringify(result).includes(credential.sessdata));
  await adapter.logout(); assert.equal(storage.value, null);
  const next = await adapter.loginStart(signal()); now += 180001;
  assert.equal((await adapter.loginPoll(next.loginId, signal())).state, 'expired'); assert.equal(polls, 1);
});

test('QR login admits the current official account page and rejects URL or key substitution', async () => {
  const key = 'synthetic-current-key';
  const official = 'https://account.bilibili.com/h5/account-h5/auth/scan-web?qrcode_key=' + key;
  const make = url => new Bilibili(vault(), async () => ok({ url, qrcode_key: key }));
  assert.match((await make(official).loginStart(signal())).image, /^data:image\/png;base64,/);
  for (const url of [official.replace('https:', 'http:'), official.replace('account.bilibili.com', 'account.bilibili.com.evil.test'),
    official.replace('/scan-web', '/other'), official.replace(key, 'wrong-key'), official.replace('https://', 'https://user@'), official + '#fragment']) {
    await assert.rejects(make(url).loginStart(signal()), /LOGIN_SCHEMA_CHANGED/);
  }
});

test('QR success without response cookies refuses URL credentials and does not save a login', async () => {
  const storage = vault(); storage.value = null;
  const adapter = new Bilibili(storage, async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/generate')) return ok({ url: 'https://passport.bilibili.com/qrcode/synthetic', qrcode_key: 'synthetic-key' });
    if (path.endsWith('/poll')) return ok({ code: 0, url: 'https://www.bilibili.com/?SESSDATA=synthetic-session-value&bili_jct=synthetic-csrf-value&DedeUserID=30001' });
    assert.ok(path.endsWith('/spi')); return ok({ b_3: credential.buvid3 });
  });
  const qr = await adapter.loginStart(signal());
  await assert.rejects(adapter.loginPoll(qr.loginId, signal()), /INVALID_CREDENTIAL/);
  assert.equal(storage.value, null);
});

test('Windows CurrentUser DPAPI vault persists only ciphertext, reopens and deletes synthetic material', { skip: process.platform !== 'win32' }, async () => {
  await mkdir(resolve('tmp/tests'), { recursive: true }); const dir = await mkdtemp(resolve('tmp/tests/vault-')); const file = join(dir, 'synthetic.dpapi');
  const storage = new WindowsVault(file); assert.equal(await storage.read(), null);
  await storage.write(credential); const bytes = await readFile(file);
  assert.ok(!bytes.includes(Buffer.from(credential.sessdata)));
  assert.deepEqual(await new WindowsVault(file).read(), credential);
  await storage.remove(); assert.equal(await storage.read(), null);
});
