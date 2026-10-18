import { PilotError, type Account, type VideoMaterial } from '../pilot/contracts.js';

export const BROWSE_LIMITS = Object.freeze({ pages: 2, pageSize: 20, videos: 3, durationMs: 120_000, cooldownMs: 60_000, history: 200, runs: 20 });
export function keywordOf(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\x00-\x1f\x7f]/.test(value)) throw new PilotError('INVALID_SEARCH_KEYWORD');
  return value.trim();
}
export interface SearchVideo { bvid: string; aid: string; title: string; author: string }
export interface SearchPage { videos: SearchVideo[]; hasMore: boolean }
// No model, send, media reader or arbitrary URL capability is exposed to browsing.
export interface BrowsePort {
  account(signal: AbortSignal): Promise<Account>;
  search(keyword: string, page: number, signal: AbortSignal): Promise<SearchPage>;
  read(bvid: string, signal: AbortSignal): Promise<VideoMaterial>;
}
export interface BrowseItem { bvid: string; title: string; state: 'subtitle' | 'no-subtitle' | 'seen' | 'deferred' | 'failed'; reason: string }
export interface BrowseRun { id: string; accountUid: string; keyword: string; startedAt: number; finishedAt: number | null; state: 'running' | 'completed' | 'cancelled' | 'interrupted' | 'failed'; reason: string; pages: number; read: number; items: BrowseItem[] }
export interface Reading { accountUid: string; bvid: string; aid: string; title: string; author: string; subtitle: string | null; truncated: boolean; state: 'subtitle' | 'no-subtitle'; at: number }
