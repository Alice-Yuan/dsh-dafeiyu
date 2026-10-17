export class PilotError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'PilotError';
    }
}
export const LIMITS = Object.freeze({ requests: 5, outputTokens: 2048, durationMs: 900_000,
    comments: 1, replies: 2, textLength: 150, pages: 3, pageSize: 20, polls: 15, pollMs: 60_000 });
export const DEFAULT_PERSONA = '你是大肥鱼，一个 AI。使用中文，温和、好奇，表达具体而克制；不假装人类，不编造看过的内容。';
export const DEFAULT_CONFIG = { ownerUid: '', bvid: '', persona: DEFAULT_PERSONA, diagnosticMarker: '' };
export function decimalId(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
        return String(value);
    if (typeof value === 'string' && /^(0|[1-9]\d{0,24})$/.test(value))
        return value;
    throw new PilotError('INVALID_PLATFORM_ID');
}
export function configOf(input, complete = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new PilotError('INVALID_CONFIG');
    const data = input;
    if (Object.keys(data).some(k => !Object.hasOwn(DEFAULT_CONFIG, k)))
        throw new PilotError('INVALID_CONFIG');
    const out = { ...DEFAULT_CONFIG, ...data };
    if (typeof out.ownerUid !== 'string' || (out.ownerUid !== '' && !/^[1-9]\d{0,24}$/.test(out.ownerUid)))
        throw new PilotError('INVALID_OWNER_UID');
    if (typeof out.bvid !== 'string' || (out.bvid !== '' && !/^BV[1-9A-HJ-NP-Za-km-z]{10}$/.test(out.bvid)))
        throw new PilotError('INVALID_BVID');
    if (typeof out.persona !== 'string' || !out.persona.trim() || out.persona.length > 2000 || /\0/.test(out.persona))
        throw new PilotError('INVALID_PERSONA');
    if (typeof out.diagnosticMarker !== 'string' || !/^[\w .:-]{0,80}$/.test(out.diagnosticMarker))
        throw new PilotError('INVALID_MARKER');
    if (complete && (!out.ownerUid || !out.bvid))
        throw new PilotError('CONFIG_INCOMPLETE');
    return out;
}
export function intentOf(text, expected) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new PilotError('INVALID_MODEL_INTENT');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new PilotError('INVALID_MODEL_INTENT');
    const v = value;
    if (v.kind === 'skip' && typeof v.reason === 'string' && v.reason.length <= 300 && Object.keys(v).every(k => ['kind', 'reason'].includes(k)))
        return { kind: 'skip', reason: v.reason };
    if (v.kind !== expected || typeof v.text !== 'string' || !v.text.trim() || [...v.text].length > LIMITS.textLength || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v.text) || Object.keys(v).some(k => !['kind', 'text'].includes(k)))
        throw new PilotError('INVALID_MODEL_INTENT');
    return { kind: expected, text: v.text.trim() };
}
export function safeError(error) {
    return error instanceof PilotError ? error.code : error instanceof Error && error.name === 'AbortError' ? 'CANCELLED' : 'OPERATION_FAILED';
}
//# sourceMappingURL=contracts.js.map