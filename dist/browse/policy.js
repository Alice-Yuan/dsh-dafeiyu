import { z } from 'zod';
// dsh-bili-scroll 3064e081: perDay counts PICKS, not reads or model calls.
// Sending switches cannot be enabled through this preview-only control plane.
export const browsePolicySchema = z.object({
    perDay: z.number().int().min(0).max(50),
    commentPerRound: z.number().int().min(0).max(20),
    replyPerRound: z.number().int().min(1).max(10),
    autoComment: z.literal(false),
    replyToComments: z.literal(false),
}).strict();
export const DEFAULT_BROWSE_POLICY = Object.freeze({ perDay: 5, commentPerRound: 1, replyPerRound: 1, autoComment: false, replyToComments: false });
export const REFERENCE_LIMITS = Object.freeze({ commentChars: 150, replyChars: 100, threadDays: 7, threads: 8 });
export const REPLY_DESIGN = '只处理直接回复自己评论的新消息。简短有用的问题可用一两句回答；夸奖、调侃、接梗、道谢、祝福用一句轻松的话收住。代码、作品或方案索取、代表作者承诺、争吵、隐私或内部设置、无关请求、需要长篇解释或连续追问，一律跳过。同人同话题只回复一次；不为了凑数互动。回复最多100字。';
export function dayOf(at) {
    if (!Number.isSafeInteger(at) || at < 0)
        throw new Error('BROWSE_CLOCK_INVALID');
    return new Date(at + 8 * 3600_000).toISOString().slice(0, 10);
}
//# sourceMappingURL=policy.js.map