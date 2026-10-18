import { type VideoFrame, type VisualMaterial } from '../pilot/contracts.js';
export declare const MEDIA_LIMITS: Readonly<{
    durationSeconds: 600;
    bytes: number;
    frames: 12;
    frameBytes: number;
    outputBytes: number;
    downloadMs: 45000;
    decodeMs: 45000;
}>;
export interface MediaReader {
    read(url: string, duration: number, signal: AbortSignal): Promise<VisualMaterial>;
}
export declare function mediaUrl(value: string): URL;
export declare function downloadMedia(url: string, signal: AbortSignal, fetcher?: typeof fetch): Promise<Buffer>;
export declare function findDecoder(path?: string): Promise<{
    ffmpeg: string;
    ffprobe: string;
}>;
export declare function runDecoder(executable: string, args: string[], signal: AbortSignal, maxBytes?: number): Promise<{
    out: Buffer;
    err: string;
}>;
export declare function decodedFrames(bytes: Buffer, diagnostics: string, duration: number): VideoFrame[];
export declare class FfmpegMediaReader implements MediaReader {
    private readonly root;
    private readonly fetcher;
    constructor(root: string, fetcher?: typeof fetch);
    read(url: string, duration: number, signal: AbortSignal): Promise<VisualMaterial>;
}
