import { createHash, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { decimalId, LIMITS, PilotError } from '../pilot/contracts.js';
import { credentialOf } from './vault.js';
import { keywordOf, BROWSE_LIMITS } from '../browse/contracts.js';
function obj(value) { if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PilotError('PLATFORM_SCHEMA_CHANGED'); return value; }
function str(value, max = 4000) { if (typeof value !== 'string')
    throw new PilotError('PLATFORM_SCHEMA_CHANGED'); return value.slice(0, max); }
function list(value) { if (value === null)
    return []; if (!Array.isArray(value))
    throw new PilotError('PLATFORM_SCHEMA_CHANGED'); return value; }
function requireWritable(data) {
    const config = obj(data.config), control = obj(data.control);
    if (config.read_only === true || control.input_disable === true)
        throw new PilotError('COMMENTS_READ_ONLY');
    if (config.read_only !== false || control.input_disable !== false)
        throw new PilotError('COMMENT_CAPABILITY_UNKNOWN');
}
export function parseLossless(text) {
    // Node 24's JSON.parse source context retains integer digits before IEEE-754 conversion.
    return JSON.parse(text, (_key, value, context) => {
        if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
            if (context?.source && /^-?\d+$/.test(context.source))
                return context.source;
            throw new PilotError('UNSAFE_PLATFORM_ID');
        }
        return value;
    });
}
export function commentOf(value, aid) {
    const v = obj(value);
    if (decimalId(v.oid_str ?? v.oid) !== aid || Number(v.type) !== 1)
        throw new PilotError('PLATFORM_TARGET_MISMATCH');
    const member = obj(v.member);
    if (typeof v.ctime !== 'number' || !Number.isSafeInteger(v.ctime))
        throw new PilotError('PLATFORM_SCHEMA_CHANGED');
    const content = obj(v.content);
    return { id: decimalId(v.rpid_str ?? v.rpid), uid: decimalId(member.mid), root: decimalId(v.root_str ?? v.root), parent: decimalId(v.parent_str ?? v.parent), text: str(content.message, 2000), createdAt: v.ctime * 1000,
        mentionedUids: content.members === undefined ? [] : list(content.members).map(m => decimalId(obj(m).mid)) };
}
const API = 'https://api.bilibili.com';
const PASSPORT = 'https://passport.bilibili.com';
// Protocol permutation, not executable code loaded from an external project.
const WBI_ORDER = '46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52'.split(',').map(Number);
export function signWbi(params, img, sub, timestamp) {
    if (!/^[a-f0-9]{32}$/.test(img) || !/^[a-f0-9]{32}$/.test(sub))
        throw new PilotError('PLATFORM_SCHEMA_CHANGED');
    const source = img + sub;
    let key = '';
    for (const n of WBI_ORDER.slice(0, 32))
        key += source.charAt(n);
    const values = { ...params, wts: String(timestamp) };
    const query = Object.keys(values).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(values[k].replace(/[!'()*]/g, ''))).join('&');
    return query + '&w_rid=' + createHash('md5').update(query + key).digest('hex');
}
export class Bilibili {
    vault;
    fetcher;
    now;
    media;
    login = null;
    constructor(vault, fetcher = fetch, now = Date.now, media) {
        this.vault = vault;
        this.fetcher = fetcher;
        this.now = now;
        this.media = media;
    }
    async hasCredential() { const c = await this.vault.read(); return c ? { uid: c.uid, name: '' } : null; }
    async raw(url, signal, credential = null, body) {
        const u = new URL(url);
        if (![API, PASSPORT].includes(u.origin) || u.username || u.password)
            throw new PilotError('NETWORK_TARGET_DENIED');
        const headers = { Referer: 'https://www.bilibili.com/', Accept: 'application/json' };
        if (credential)
            headers.Cookie = `SESSDATA=${credential.sessdata}; bili_jct=${credential.csrf}; DedeUserID=${credential.uid}; buvid3=${credential.buvid3}`;
        if (body)
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        let response;
        try {
            response = await this.fetcher(u, { method: body ? 'POST' : 'GET', headers, ...(body ? { body } : {}), signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), redirect: 'error' });
        }
        catch {
            throw new PilotError(body ? 'SEND_OUTCOME_UNKNOWN' : signal.aborted ? 'CANCELLED' : 'PLATFORM_NETWORK_FAILED');
        }
        if (!response.ok)
            throw new PilotError(body ? 'SEND_OUTCOME_UNKNOWN' : response.status === 429 || response.status === 412 ? 'PLATFORM_RESTRICTED' : 'PLATFORM_HTTP_FAILED');
        let parsed;
        try {
            parsed = obj(parseLossless(await boundedText(response)));
        }
        catch {
            throw new PilotError(body ? 'SEND_OUTCOME_UNKNOWN' : 'PLATFORM_SCHEMA_CHANGED');
        }
        if (parsed.code !== 0) {
            if (parsed.code === -101 || parsed.code === -111)
                throw new PilotError('AUTH_EXPIRED');
            if ([-352, -412, 12002, 12016, 12051, 12061, 12064].includes(Number(parsed.code)))
                throw new PilotError('PLATFORM_RESTRICTED');
            throw new PilotError(body ? 'SEND_REJECTED' : 'PLATFORM_REQUEST_REJECTED');
        }
        return { data: obj(parsed.data), headers: response.headers };
    }
    async credential() { const c = await this.vault.read(); if (!c)
        throw new PilotError('LOGIN_REQUIRED'); return c; }
    async nav(signal) {
        const c = await this.credential();
        const { data } = await this.raw(API + '/x/web-interface/nav', signal, c);
        if (data.isLogin !== true || decimalId(data.mid) !== c.uid)
            throw new PilotError('ACCOUNT_CHANGED');
        return data;
    }
    async account(signal) { const n = await this.nav(signal); return { uid: decimalId(n.mid), name: str(n.uname, 80) }; }
    async signed(path, params, signal) {
        const nav = await this.nav(signal);
        const wbi = obj(nav.wbi_img);
        const key = (v) => new URL(str(v)).pathname.split('/').pop().split('.')[0];
        const query = signWbi(params, key(wbi.img_url), key(wbi.sub_url), Math.floor(this.now() / 1000));
        return (await this.raw(API + path + '?' + query, signal, await this.credential())).data;
    }
    async search(keyword, page, signal) {
        keyword = keywordOf(keyword);
        if (!Number.isSafeInteger(page) || page < 1 || page > BROWSE_LIMITS.pages)
            throw new PilotError('INVALID_SEARCH_PAGE');
        signal.throwIfAborted();
        const data = await this.signed('/x/web-interface/wbi/search/type', { search_type: 'video', keyword, page: String(page), page_size: '20', order: 'totalrank' }, signal);
        signal.throwIfAborted();
        if (data.page !== page || !Number.isSafeInteger(data.numPages) || Number(data.numPages) < 0)
            throw new PilotError('PLATFORM_SCHEMA_CHANGED');
        const videos = list(data.result ?? []).filter(v => obj(v).type === 'video').slice(0, BROWSE_LIMITS.pageSize).map(raw => {
            const v = obj(raw), bvid = str(v.bvid, 30);
            if (!/^BV[1-9A-HJ-NP-Za-km-z]{10}$/.test(bvid))
                throw new PilotError('INVALID_BVID');
            const aid = decimalId(v.aid);
            if (aid === '0')
                throw new PilotError('INVALID_PLATFORM_ID');
            // Search highlighting is display text, never markup or a navigable API URL.
            return { bvid, aid, title: str(v.title, 1000).replace(/<[^>]*>/g, '').slice(0, 300), author: str(v.author, 100) };
        });
        return { videos, hasMore: page < Number(data.numPages) };
    }
    async video(bvid, signal, visualRequested = false) {
        if (!/^BV[1-9A-HJ-NP-Za-km-z]{10}$/.test(bvid))
            throw new PilotError('INVALID_BVID');
        const { data } = await this.raw(API + '/x/web-interface/view?bvid=' + bvid, signal, await this.credential());
        if (data.bvid !== bvid || data.state !== 0)
            throw new PilotError('VIDEO_UNAVAILABLE');
        const aid = decimalId(data.aid), cid = decimalId(data.cid);
        const player = await this.signed('/x/player/wbi/v2', { aid, cid }, signal);
        const subs = list(obj(player.subtitle).subtitles).map(obj);
        const preferred = subs.find(s => typeof s.lan === 'string' && /^zh|^ai-zh/.test(s.lan)) ?? subs[0];
        let subtitle = null;
        if (preferred) {
            const rawUrl = str(preferred.subtitle_url);
            const url = new URL(rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl);
            if (url.protocol !== 'https:' || url.port || url.username || url.password || !(url.hostname === 'hdslb.com' || url.hostname.endsWith('.hdslb.com')))
                throw new PilotError('SUBTITLE_TARGET_DENIED');
            // Subtitle hosts never receive cookies. Only an API-returned HTTPS CDN URL is admitted.
            const response = await this.fetcher(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), redirect: 'error' });
            if (!response.ok)
                throw new PilotError('SUBTITLE_UNAVAILABLE');
            subtitle = list(obj(parseLossless(await boundedText(response))).body).map(v => str(obj(v).content, 2000)).join('\n').slice(0, 20_000);
        }
        const material = { bvid, aid, cid, title: str(data.title, 300), description: str(data.desc, 2000), subtitle };
        if (visualRequested && this.media) {
            if (typeof data.duration !== 'number' || !Number.isFinite(data.duration) || data.duration <= 0 || data.duration > 600)
                throw new PilotError('MEDIA_DURATION_LIMIT');
            // Bind the stream to the server-resolved first-page cid; never take a client URL.
            const playback = (await this.raw(API + `/x/player/playurl?bvid=${bvid}&avid=${aid}&cid=${cid}&qn=16&fnval=16&fourk=0`, signal, await this.credential())).data;
            const dash = obj(playback.dash);
            if (typeof dash.duration !== 'number' || Math.abs(dash.duration - data.duration) > 2 || typeof playback.timelength !== 'number' || Math.abs(playback.timelength / 1000 - data.duration) > 2)
                throw new PilotError('MEDIA_METADATA_INVALID');
            const streams = list(dash.video).map(obj).filter(v => typeof v.codecs === 'string' && v.codecs.startsWith('avc1.') && typeof v.width === 'number' && typeof v.height === 'number' && v.width > 0 && v.height > 0 && v.width * v.height <= 1920 * 1080)
                .sort((a, b) => Number(a.width) * Number(a.height) - Number(b.width) * Number(b.height));
            const stream = streams[0];
            if (!stream)
                throw new PilotError('MEDIA_FORMAT_UNSUPPORTED');
            material.visual = await this.media.read(str(stream.baseUrl ?? stream.base_url, 16_000), playback.timelength / 1000, signal);
        }
        return material;
    }
    async comments(aid, root, cursor, authenticated, signal) {
        decimalId(aid);
        decimalId(root);
        let data;
        if (root !== '0') {
            const page = cursor ?? '1';
            if (!/^[1-9]\d{0,5}$/.test(page))
                throw new PilotError('INVALID_CURSOR');
            data = (await this.raw(API + `/x/v2/reply/reply?type=1&oid=${aid}&root=${root}&ps=20&pn=${page}`, signal, authenticated ? await this.credential() : null)).data;
            if (authenticated)
                requireWritable(data);
            const rows = list(data.replies).map(v => commentOf(v, aid));
            const p = obj(data.page);
            if (rows.some(c => c.root !== root))
                throw new PilotError('PLATFORM_TARGET_MISMATCH');
            if (!Number.isSafeInteger(p.count) || !Number.isSafeInteger(p.num) || !Number.isSafeInteger(p.size) || p.num !== Number(page) || Number(p.size) < 1)
                throw new PilotError('PLATFORM_SCHEMA_CHANGED');
            return { comments: rows, next: Number(p.num) * Number(p.size) < Number(p.count) ? String(Number(page) + 1) : null };
        }
        if (cursor && cursor.length > 2000)
            throw new PilotError('INVALID_CURSOR');
        if (authenticated)
            data = await this.signed('/x/v2/reply/wbi/main', { type: '1', oid: aid, mode: '3', ps: '20', pagination_str: JSON.stringify({ offset: cursor ?? '' }), plat: '1', web_location: '1315875' }, signal);
        else
            data = (await this.raw(API + `/x/v2/reply/main?type=1&oid=${aid}&mode=3&next=${cursor ?? '0'}&ps=20`, signal)).data;
        if (authenticated)
            requireWritable(data);
        const c = obj(data.cursor);
        const next = c.is_end === true ? null : authenticated ? str(obj(c.pagination_reply).next_offset, 2000) : decimalId(c.next);
        return { comments: list(data.replies).map(v => commentOf(v, aid)), next };
    }
    async send(target, text, signal) {
        for (const id of [target.aid, target.root, target.parent])
            decimalId(id);
        if (!text.trim() || [...text].length > LIMITS.textLength)
            throw new PilotError('INVALID_COMMENT');
        signal.throwIfAborted();
        const c = await this.credential();
        signal.throwIfAborted();
        const body = new URLSearchParams({ type: '1', oid: target.aid, root: target.root, parent: target.parent, message: text, csrf: c.csrf });
        const { data } = await this.raw(API + '/x/v2/reply/add', signal, c, body);
        try {
            const r = commentOf(data.reply, target.aid);
            if (r.id === '0' || r.uid !== c.uid || r.root !== target.root || r.parent !== target.parent)
                throw new PilotError('SEND_OUTCOME_UNKNOWN');
            return { id: r.id, root: r.root, parent: r.parent };
        }
        catch {
            throw new PilotError('SEND_OUTCOME_UNKNOWN');
        }
    }
    async verify(target, id, uid, signal) {
        const check = async (authenticated) => {
            try {
                // Root response includes the root itself; no scanning a busy whole video to guess absence.
                const rootId = target.root === '0' ? id : target.root;
                let cursor = '1';
                for (let page = 0; page < LIMITS.pages && cursor; page++) {
                    const { data } = await this.raw(API + `/x/v2/reply/reply?type=1&oid=${target.aid}&root=${rootId}&ps=20&pn=${cursor}`, signal, authenticated ? await this.credential() : null);
                    const candidates = [...list(data.replies), ...(data.root ? [data.root] : [])];
                    for (const raw of candidates) {
                        const c = commentOf(raw, target.aid);
                        if (c.id === id && c.uid === uid && c.root === target.root && c.parent === target.parent)
                            return obj(raw).invisible === true ? null : true;
                    }
                    const p = obj(data.page);
                    cursor = Number(p.num) * Number(p.size) < Number(p.count) ? String(Number(p.num) + 1) : null;
                }
            }
            catch { /* Failure or not found cannot establish remote absence. */ }
            return null;
        };
        return { selfVisible: await check(true), publicVisible: signal.aborted ? null : await check(false) };
    }
    async loginStart(signal) {
        const { data } = await this.raw(PASSPORT + '/x/passport-login/web/qrcode/generate?source=main-fe-header', signal);
        const url = new URL(str(data.url));
        const key = str(data.qrcode_key, 200);
        const accountPage = url.origin === 'https://account.bilibili.com' && url.pathname === '/h5/account-h5/auth/scan-web' && url.searchParams.get('qrcode_key') === key;
        if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash ||
            (url.origin !== PASSPORT && !accountPage) || !key)
            throw new PilotError('LOGIN_SCHEMA_CHANGED');
        this.login = { id: randomUUID(), key, expires: this.now() + 180_000, lastPoll: 0 };
        return { loginId: this.login.id, image: await QRCode.toDataURL(url.href, { width: 240, margin: 2 }), expiresAt: this.login.expires };
    }
    async loginPoll(loginId, signal) {
        const login = this.login;
        if (!login || login.id !== loginId || this.now() >= login.expires) {
            this.login = null;
            return { state: 'expired' };
        }
        if (this.now() - login.lastPoll < 2000)
            return { state: 'waiting' };
        login.lastPoll = this.now();
        const { data, headers } = await this.raw(PASSPORT + '/x/passport-login/web/qrcode/poll?qrcode_key=' + encodeURIComponent(login.key) + '&source=main-fe-header', signal);
        if (data.code === 86101)
            return { state: 'waiting' };
        if (data.code === 86090)
            return { state: 'scanned' };
        if (data.code === 86038) {
            this.login = null;
            return { state: 'expired' };
        }
        if (data.code !== 0)
            throw new PilotError('LOGIN_FAILED');
        const cookies = {};
        for (const header of headers.getSetCookie()) {
            const first = header.split(';')[0];
            const eq = first.indexOf('=');
            if (eq > 0)
                cookies[first.slice(0, eq)] = first.slice(eq + 1);
        }
        // The official HTTPS response's Set-Cookie headers are authoritative.
        // Ignore its cross-site redirect URL entirely: never follow it or import
        // credentials from a query string. Missing cookies fail closed below.
        const spi = await this.raw(API + '/x/frontend/finger/spi', signal);
        const credential = credentialOf({ uid: cookies.DedeUserID, sessdata: cookies.SESSDATA, csrf: cookies.bili_jct, buvid3: spi.data.b_3 });
        const checked = (await this.raw(API + '/x/web-interface/nav', signal, credential)).data;
        if (checked.isLogin !== true || decimalId(checked.mid) !== credential.uid)
            throw new PilotError('ACCOUNT_CHANGED');
        signal.throwIfAborted();
        if (this.login !== login)
            throw new PilotError('LOGIN_CANCELLED');
        await this.vault.write(credential);
        this.login = null;
        return { state: 'authenticated', account: { uid: credential.uid, name: str(checked.uname, 80) } };
    }
    async logout() { this.login = null; await this.vault.remove(); }
}
async function boundedText(response) {
    const reader = response.body?.getReader();
    if (!reader)
        throw new PilotError('PLATFORM_EMPTY_RESPONSE');
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > 2_000_000)
                throw new PilotError('PLATFORM_RESPONSE_TOO_LARGE');
            chunks.push(value);
        }
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    return Buffer.concat(chunks).toString('utf8');
}
//# sourceMappingURL=bilibili.js.map