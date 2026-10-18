export declare class PilotError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare const LIMITS: Readonly<{
    requests: 5;
    outputTokens: 2048;
    durationMs: 900000;
    comments: 1;
    replies: 2;
    textLength: 150;
    pages: 3;
    pageSize: 20;
    polls: 15;
    pollMs: 60000;
}>;
export declare const DEFAULT_PERSONA = "\u4F60\u662F\u5927\u80A5\u9C7C\uFF0C\u4E00\u4E2A AI\u3002\u4F7F\u7528\u4E2D\u6587\uFF0C\u6E29\u548C\u3001\u597D\u5947\uFF0C\u8868\u8FBE\u5177\u4F53\u800C\u514B\u5236\uFF1B\u4E0D\u5047\u88C5\u4EBA\u7C7B\uFF0C\u4E0D\u7F16\u9020\u770B\u8FC7\u7684\u5185\u5BB9\u3002";
export interface PilotConfig {
    ownerUid: string;
    bvid: string;
    persona: string;
    diagnosticMarker: string;
}
export declare const DEFAULT_CONFIG: PilotConfig;
export declare function decimalId(value: unknown): string;
export declare function configOf(input: unknown, complete?: boolean): PilotConfig;
export interface Account {
    uid: string;
    name: string;
}
export interface VideoFrame {
    atSeconds: number;
    sha256: string;
    jpeg: Uint8Array;
}
export interface VisualMaterial {
    source: 'video-stream';
    durationSeconds: number;
    streamSha256: string;
    downloadedBytes: number;
    frames: VideoFrame[];
    audio: 'not-transcribed';
    coverage: 'sampled-frames';
}
export interface VideoMaterial {
    bvid: string;
    aid: string;
    cid: string;
    title: string;
    description: string;
    subtitle: string | null;
    visual?: VisualMaterial;
}
export interface Comment {
    id: string;
    uid: string;
    root: string;
    parent: string;
    text: string;
    createdAt: number;
}
export interface CommentPage {
    comments: Comment[];
    next: string | null;
}
export interface SendTarget {
    bvid: string;
    aid: string;
    root: string;
    parent: string;
}
export interface SendReceipt {
    id: string;
    root: string;
    parent: string;
}
export interface Visibility {
    selfVisible: boolean | null;
    publicVisible: boolean | null;
}
export interface BiliPort {
    account(signal: AbortSignal): Promise<Account>;
    video(bvid: string, signal: AbortSignal): Promise<VideoMaterial>;
    comments(aid: string, root: string, cursor: string | null, authenticated: boolean, signal: AbortSignal): Promise<CommentPage>;
    send(target: SendTarget, text: string, signal: AbortSignal): Promise<SendReceipt>;
    verify(target: SendTarget, id: string, uid: string, signal: AbortSignal): Promise<Visibility>;
}
export type Purpose = 'private' | 'public' | 'summary';
export interface ModelRequest {
    purpose: Purpose;
    prompt: string;
    persona: string;
    frames?: VideoFrame[] | undefined;
}
export interface PilotModel {
    ask(request: ModelRequest, signal: AbortSignal): Promise<{
        text: string;
        sessionId: string;
    }>;
    recordReport(text: string): Promise<void>;
    dispose(): Promise<void>;
}
export type Intent = {
    kind: 'skip';
    reason: string;
} | {
    kind: 'comment' | 'reply';
    text: string;
};
export declare function intentOf(text: string, expected: 'comment' | 'reply'): Intent;
export declare function safeError(error: unknown): string;
