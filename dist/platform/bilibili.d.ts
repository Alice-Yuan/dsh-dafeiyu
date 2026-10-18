import { type Account, type BiliPort, type Comment, type CommentPage, type SendReceipt, type SendTarget, type VideoMaterial, type Visibility } from '../pilot/contracts.js';
import { type Vault } from './vault.js';
import { type MediaReader } from './media.js';
import { type SearchPage } from '../browse/contracts.js';
export declare function parseLossless(text: string): unknown;
export declare function commentOf(value: unknown, aid: string): Comment;
export declare function signWbi(params: Record<string, string>, img: string, sub: string, timestamp: number): string;
export declare class Bilibili implements BiliPort {
    private readonly vault;
    private readonly fetcher;
    private readonly now;
    private readonly media?;
    private readonly acceptAccount?;
    private login;
    constructor(vault: Vault, fetcher?: typeof fetch, now?: () => number, media?: MediaReader | undefined, acceptAccount?: ((account: Account) => void) | undefined);
    hasCredential(): Promise<Account | null>;
    private raw;
    private credential;
    private nav;
    account(signal: AbortSignal): Promise<Account>;
    private signed;
    search(keyword: string, page: number, signal: AbortSignal): Promise<SearchPage>;
    video(bvid: string, signal: AbortSignal, visualRequested?: boolean): Promise<VideoMaterial>;
    comments(aid: string, root: string, cursor: string | null, authenticated: boolean, signal: AbortSignal): Promise<CommentPage>;
    send(target: SendTarget, text: string, signal: AbortSignal): Promise<SendReceipt>;
    verify(target: SendTarget, id: string, uid: string, signal: AbortSignal): Promise<Visibility>;
    loginStart(signal: AbortSignal): Promise<{
        loginId: string;
        image: string;
        expiresAt: number;
    }>;
    loginPoll(loginId: string, signal: AbortSignal): Promise<{
        state: string;
        account?: Account;
    }>;
    logout(): Promise<void>;
}
