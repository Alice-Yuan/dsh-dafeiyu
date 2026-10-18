import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { delimiter, dirname, isAbsolute, join, relative } from 'node:path';
import { PilotError } from '../pilot/contracts.js';
export const MEDIA_LIMITS = Object.freeze({ durationSeconds: 600, bytes: 64 * 1024 * 1024, frames: 12,
    frameBytes: 512 * 1024, outputBytes: 6 * 1024 * 1024, downloadMs: 45_000, decodeMs: 45_000 });
export function mediaUrl(value) {
    let u;
    try {
        u = new URL(value);
    }
    catch {
        throw new PilotError('MEDIA_TARGET_DENIED');
    }
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash ||
        !u.hostname.endsWith('.bilivideo.com') || !u.pathname.startsWith('/upgcxcode/'))
        throw new PilotError('MEDIA_TARGET_DENIED');
    return u;
}
export async function downloadMedia(url, signal, fetcher = fetch) {
    signal.throwIfAborted();
    const u = mediaUrl(url);
    const lifetime = AbortSignal.any([signal, AbortSignal.timeout(MEDIA_LIMITS.downloadMs)]);
    let response;
    try {
        response = await fetcher(u, { headers: { Referer: 'https://www.bilibili.com/' }, redirect: 'error', signal: lifetime });
    }
    catch {
        throw new PilotError(signal.aborted ? 'CANCELLED' : 'MEDIA_DOWNLOAD_FAILED');
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new PilotError('MEDIA_DOWNLOAD_FAILED');
    }
    const size = response.headers.get('content-length');
    if (size && (!/^\d+$/.test(size) || Number(size) > MEDIA_LIMITS.bytes)) {
        await response.body?.cancel();
        throw new PilotError('MEDIA_TOO_LARGE');
    }
    const reader = response.body?.getReader();
    if (!reader)
        throw new PilotError('MEDIA_EMPTY');
    const chunks = [];
    let count = 0;
    try {
        while (true) {
            lifetime.throwIfAborted();
            const { value, done } = await reader.read();
            if (done)
                break;
            count += value.byteLength;
            if (count > MEDIA_LIMITS.bytes)
                throw new PilotError('MEDIA_TOO_LARGE');
            chunks.push(value);
        }
    }
    catch (e) {
        if (e instanceof PilotError)
            throw e;
        throw new PilotError(signal.aborted ? 'CANCELLED' : 'MEDIA_DOWNLOAD_FAILED');
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    const bytes = Buffer.concat(chunks);
    // Only MP4 data enters the fixed MOV decoder. Never hand it a URL or playlist.
    if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp')
        throw new PilotError('MEDIA_FORMAT_UNSUPPORTED');
    return bytes;
}
export async function findDecoder(path = process.env.PATH ?? '') {
    for (const entry of path.split(delimiter)) {
        const dir = entry.replace(/^"|"$/g, '');
        if (!isAbsolute(dir))
            continue;
        const ffmpeg = join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        const ffprobe = join(dir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
        try {
            await access(ffmpeg);
            await access(ffprobe);
            if ((await stat(ffmpeg)).isFile() && (await stat(ffprobe)).isFile())
                return { ffmpeg, ffprobe };
        }
        catch { /* Try the next absolute PATH entry. */ }
    }
    throw new PilotError('MEDIA_DECODER_UNAVAILABLE');
}
export function runDecoder(executable, args, signal, maxBytes = MEDIA_LIMITS.outputBytes) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const out = [], err = [];
        let bytes = 0, errors = 0, failure = '';
        const fail = (code) => { failure ||= code; child.kill(); };
        const timer = setTimeout(() => fail('MEDIA_DECODE_TIMEOUT'), MEDIA_LIMITS.decodeMs);
        const cancel = () => fail('CANCELLED');
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted)
            cancel();
        child.stdout.on('data', (b) => { bytes += b.length; if (bytes > maxBytes)
            fail('MEDIA_OUTPUT_TOO_LARGE');
        else
            out.push(b); });
        child.stderr.on('data', (b) => { errors += b.length; if (errors > 128 * 1024)
            fail('MEDIA_DIAGNOSTIC_TOO_LARGE');
        else
            err.push(b); });
        child.once('error', () => { failure ||= 'MEDIA_DECODER_UNAVAILABLE'; });
        child.once('close', code => {
            clearTimeout(timer);
            signal.removeEventListener('abort', cancel);
            if (failure || code !== 0)
                reject(new PilotError(failure || 'MEDIA_DECODE_FAILED'));
            else
                resolve({ out: Buffer.concat(out), err: Buffer.concat(err).toString('utf8') });
        });
    });
}
export function decodedFrames(bytes, diagnostics, duration) {
    const times = [...diagnostics.matchAll(/\bn:\s*\d+\s+pts:\s*\d+\s+pts_time:([\d.]+)/g)].map(m => Number(m[1]));
    const frames = [];
    let offset = 0;
    while (offset < bytes.length) {
        if (bytes[offset] !== 0xff || bytes[offset + 1] !== 0xd8)
            throw new PilotError('MEDIA_FRAME_INVALID');
        const end = bytes.indexOf(Buffer.from([0xff, 0xd9]), offset + 2);
        if (end < 0)
            throw new PilotError('MEDIA_FRAME_INVALID');
        const jpeg = bytes.subarray(offset, end + 2), atSeconds = times[frames.length];
        if (jpeg.length > MEDIA_LIMITS.frameBytes || atSeconds === undefined || !Number.isFinite(atSeconds) || atSeconds < 0 || atSeconds > duration + 1 ||
            (frames.length > 0 && atSeconds <= frames.at(-1).atSeconds))
            throw new PilotError('MEDIA_FRAME_INVALID');
        frames.push({ atSeconds, jpeg, sha256: createHash('sha256').update(jpeg).digest('hex') });
        offset = end + 2;
    }
    if (!frames.length || frames.length > MEDIA_LIMITS.frames || times.length !== frames.length)
        throw new PilotError('MEDIA_FRAME_INVALID');
    return frames;
}
export class FfmpegMediaReader {
    root;
    fetcher;
    constructor(root, fetcher = fetch) {
        this.root = root;
        this.fetcher = fetcher;
    }
    async read(url, duration, signal) {
        if (!Number.isFinite(duration) || duration <= 0 || duration > MEDIA_LIMITS.durationSeconds)
            throw new PilotError('MEDIA_DURATION_LIMIT');
        const decoder = await findDecoder();
        const data = await downloadMedia(url, signal, this.fetcher);
        await mkdir(this.root, { recursive: true });
        const root = await realpath(this.root);
        const dir = await mkdtemp(join(root, 'capture-'));
        const resolved = await realpath(dir);
        if (relative(root, resolved).startsWith('..') || dirname(resolved) !== root)
            throw new PilotError('MEDIA_DIRECTORY_DENIED');
        try {
            const file = join(dir, 'video.mp4');
            await writeFile(file, data, { flag: 'wx' });
            signal.throwIfAborted();
            const probe = await runDecoder(decoder.ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration:format=duration', '-of', 'json', file], signal, 64 * 1024);
            let metadata;
            try {
                metadata = JSON.parse(probe.out.toString());
            }
            catch {
                throw new PilotError('MEDIA_METADATA_INVALID');
            }
            const stream = metadata.streams?.[0], actualDuration = Number(metadata.format?.duration ?? stream?.duration);
            if (!stream || !Number.isFinite(actualDuration) || Math.abs(actualDuration - duration) > 2 || actualDuration > MEDIA_LIMITS.durationSeconds ||
                !Number.isInteger(stream.width) || !Number.isInteger(stream.height) || stream.width <= 0 || stream.height <= 0 || stream.width * stream.height > 3840 * 2160)
                throw new PilotError('MEDIA_METADATA_INVALID');
            // PTS comes from showinfo on selected source frames, not an invented timestamp.
            const interval = Math.max(0.1, (actualDuration - 0.5) / (MEDIA_LIMITS.frames - 1));
            const vf = `select=isnan(prev_selected_t)+gte(t-prev_selected_t\\,${interval.toFixed(6)}),scale=640:640:force_original_aspect_ratio=decrease,showinfo`;
            const decoded = await runDecoder(decoder.ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'info', '-threads', '1', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-i', file,
                '-map', '0:v:0', '-an', '-sn', '-dn', '-t', String(MEDIA_LIMITS.durationSeconds), '-vf', vf, '-frames:v', String(MEDIA_LIMITS.frames), '-fps_mode', 'vfr', '-threads', '1', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2pipe', 'pipe:1'], signal);
            const frames = decodedFrames(decoded.out, decoded.err, actualDuration);
            return { source: 'video-stream', durationSeconds: actualDuration, streamSha256: createHash('sha256').update(data).digest('hex'), downloadedBytes: data.length, frames, audio: 'not-transcribed', coverage: 'sampled-frames' };
        }
        finally {
            // Only this newly-created, checked child directory is removed; no user path is accepted.
            await rm(resolved, { recursive: true, force: true });
        }
    }
}
//# sourceMappingURL=media.js.map