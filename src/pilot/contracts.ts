export class PilotError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'PilotError'; }
}
export const LIMITS = Object.freeze({ requests: 5, outputTokens: 2048, durationMs: 900_000,
  comments: 1, replies: 2, textLength: 150, pages: 3, pageSize: 20, polls: 15, pollMs: 60_000 });
export const DEFAULT_PERSONA = '你是大肥鱼，一个 AI。使用中文，温和、好奇，表达具体而克制；不假装人类，不编造看过的内容。';
export interface PilotConfig { ownerUid: string; bvid: string; persona: string; diagnosticMarker: string }
export const DEFAULT_CONFIG: PilotConfig = { ownerUid: '', bvid: '', persona: DEFAULT_PERSONA, diagnosticMarker: '' };
export function decimalId(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^(0|[1-9]\d{0,24})$/.test(value)) return value;
  throw new PilotError('INVALID_PLATFORM_ID');
}
export function configOf(input: unknown, complete = false): PilotConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PilotError('INVALID_CONFIG');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(k => !Object.hasOwn(DEFAULT_CONFIG, k))) throw new PilotError('INVALID_CONFIG');
  const out = { ...DEFAULT_CONFIG, ...data } as PilotConfig;
  if (typeof out.ownerUid !== 'string' || (out.ownerUid !== '' && !/^[1-9]\d{0,24}$/.test(out.ownerUid))) throw new PilotError('INVALID_OWNER_UID');
  if (typeof out.bvid !== 'string' || (out.bvid !== '' && !/^BV[1-9A-HJ-NP-Za-km-z]{10}$/.test(out.bvid))) throw new PilotError('INVALID_BVID');
  if (typeof out.persona !== 'string' || !out.persona.trim() || out.persona.length > 2000 || /\0/.test(out.persona)) throw new PilotError('INVALID_PERSONA');
  if (typeof out.diagnosticMarker !== 'string' || !/^[\w .:-]{0,80}$/.test(out.diagnosticMarker)) throw new PilotError('INVALID_MARKER');
  if (complete && (!out.ownerUid || !out.bvid)) throw new PilotError('CONFIG_INCOMPLETE');
  return out;
}
export interface Account { uid: string; name: string }
export interface VideoFrame { atSeconds: number; sha256: string; jpeg: Uint8Array }
export interface VisualMaterial { source: 'video-stream'; durationSeconds: number; streamSha256: string; downloadedBytes: number; frames: VideoFrame[]; audio: 'not-transcribed'; coverage: 'sampled-frames' }
export interface VideoMaterial { bvid: string; aid: string; cid: string; title: string; description: string; subtitle: string | null; visual?: VisualMaterial }
export interface Comment { id: string; uid: string; root: string; parent: string; text: string; createdAt: number; mentionedUids?: string[] }
export interface CommentPage { comments: Comment[]; next: string | null }
export interface SendTarget { bvid: string; aid: string; root: string; parent: string }
export interface SendReceipt { id: string; root: string; parent: string }
export interface Visibility { selfVisible: boolean | null; publicVisible: boolean | null }
export interface BiliPort {
  account(signal: AbortSignal): Promise<Account>;
  video(bvid: string, signal: AbortSignal, visualRequested?: boolean): Promise<VideoMaterial>;
  comments(aid: string, root: string, cursor: string | null, authenticated: boolean, signal: AbortSignal): Promise<CommentPage>;
  send(target: SendTarget, text: string, signal: AbortSignal): Promise<SendReceipt>;
  verify(target: SendTarget, id: string, uid: string, signal: AbortSignal): Promise<Visibility>;
}
export type Purpose = 'private' | 'public' | 'summary';
export interface ModelRequest { purpose: Purpose; prompt: string; persona: string; frames?: VideoFrame[] | undefined; calibrationRevision?: string | undefined }
export interface PilotModel {
  ask(request: ModelRequest, signal: AbortSignal): Promise<{ text: string; sessionId: string }>;
  recordReport(text: string): Promise<void>;
  dispose(): Promise<void>;
}
export type Intent = { kind: 'skip'; reason: string } | { kind: 'comment' | 'reply'; text: string };
export function intentOf(text: string, expected: 'comment' | 'reply'): Intent {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new PilotError('INVALID_MODEL_INTENT'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PilotError('INVALID_MODEL_INTENT');
  const v = value as Record<string, unknown>;
  if (v.kind === 'skip' && typeof v.reason === 'string' && v.reason.length <= 300 && Object.keys(v).every(k => ['kind', 'reason'].includes(k))) return { kind: 'skip', reason: v.reason };
  if (v.kind !== expected || typeof v.text !== 'string' || !v.text.trim() || [...v.text].length > LIMITS.textLength || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v.text) || Object.keys(v).some(k => !['kind', 'text'].includes(k))) throw new PilotError('INVALID_MODEL_INTENT');
  return { kind: expected, text: v.text.trim() };
}
export function safeError(error: unknown): string {
  return error instanceof PilotError ? error.code : error instanceof Error && error.name === 'AbortError' ? 'CANCELLED' : 'OPERATION_FAILED';
}
