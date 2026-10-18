import { PilotError } from '../pilot/contracts.js';
export const BROWSE_LIMITS = Object.freeze({ pages: 2, pageSize: 20, videos: 3, durationMs: 120_000, cooldownMs: 60_000, history: 200, runs: 20 });
export function keywordOf(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\x00-\x1f\x7f]/.test(value))
        throw new PilotError('INVALID_SEARCH_KEYWORD');
    return value.trim();
}
//# sourceMappingURL=contracts.js.map