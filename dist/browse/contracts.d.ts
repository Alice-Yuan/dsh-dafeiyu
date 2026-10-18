import { type Account, type VideoMaterial } from '../pilot/contracts.js';
import type { BrowsePolicy } from './policy.js';
export interface PreviewRound {
    id: string;
    source: string;
    account: string;
    day: string;
    at: number;
    kind: 'curation' | 'replies';
    state: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
    requested: boolean;
    capacity: number;
    policy: BrowsePolicy;
    result: unknown;
    reason: string;
}
export interface CurationResult {
    videos: {
        bvid: string;
        pick: boolean;
        reason: string;
        thought: string;
        comment: string;
    }[];
}
export declare const BROWSE_LIMITS: Readonly<{
    pages: 2;
    pageSize: 20;
    videos: 3;
    durationMs: 120000;
    cooldownMs: 60000;
    history: 200;
    runs: 20;
}>;
export declare function keywordOf(value: unknown): string;
export interface SearchVideo {
    bvid: string;
    aid: string;
    title: string;
    author: string;
}
export interface SearchPage {
    videos: SearchVideo[];
    hasMore: boolean;
}
export interface BrowsePort {
    account(signal: AbortSignal): Promise<Account>;
    search(keyword: string, page: number, signal: AbortSignal): Promise<SearchPage>;
    read(bvid: string, signal: AbortSignal): Promise<VideoMaterial>;
}
export interface BrowseItem {
    bvid: string;
    title: string;
    state: 'subtitle' | 'no-subtitle' | 'seen' | 'deferred' | 'failed';
    reason: string;
}
export interface BrowseRun {
    id: string;
    accountUid: string;
    keyword: string;
    startedAt: number;
    finishedAt: number | null;
    state: 'running' | 'completed' | 'cancelled' | 'interrupted' | 'failed';
    reason: string;
    pages: number;
    read: number;
    items: BrowseItem[];
}
export interface Reading {
    accountUid: string;
    bvid: string;
    aid: string;
    title: string;
    author: string;
    subtitle: string | null;
    truncated: boolean;
    state: 'subtitle' | 'no-subtitle';
    at: number;
}
