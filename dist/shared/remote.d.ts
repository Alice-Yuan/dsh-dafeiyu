import { z } from 'zod';
export declare const REQUESTS: {
    readonly status: z.ZodObject<{}, z.core.$strict>;
    readonly saveConfig: z.ZodObject<{
        config: z.ZodObject<{
            ownerUid: z.ZodString;
            bvid: z.ZodString;
            persona: z.ZodString;
            diagnosticMarker: z.ZodString;
        }, z.core.$strict>;
        revision: z.ZodString;
    }, z.core.$strict>;
    readonly loginStart: z.ZodObject<{}, z.core.$strict>;
    readonly loginPoll: z.ZodObject<{
        loginId: z.ZodString;
    }, z.core.$strict>;
    readonly logout: z.ZodObject<{}, z.core.$strict>;
    readonly preflight: z.ZodObject<{}, z.core.$strict>;
    readonly inspectVideo: z.ZodObject<{}, z.core.$strict>;
    readonly videoEvidence: z.ZodObject<{}, z.core.$strict>;
    readonly reviewVideo: z.ZodObject<{
        revision: z.ZodString;
        decision: z.ZodEnum<{
            approved: "approved";
            rejected: "rejected";
        }>;
        note: z.ZodString;
    }, z.core.$strict>;
    readonly chat: z.ZodObject<{
        text: z.ZodString;
    }, z.core.$strict>;
    readonly start: z.ZodObject<{
        revision: z.ZodString;
        accountUid: z.ZodString;
    }, z.core.$strict>;
    readonly startMediaTrial: z.ZodObject<{
        revision: z.ZodString;
        accountUid: z.ZodString;
    }, z.core.$strict>;
    readonly stop: z.ZodObject<{}, z.core.$strict>;
    readonly reconcile: z.ZodObject<{}, z.core.$strict>;
};
export type Method = keyof typeof REQUESTS;
export declare const REMOTE: import("@deepseek-ai/dsh-typert-protocol/types").TypertRemoteInfo<Readonly<Record<string, import("@deepseek-ai/dsh-typert-protocol/types").TypertRemoteMethod<object, unknown, "unary", never, unknown> | import("@deepseek-ai/dsh-typert-protocol/types").TypertRemoteMethod<object, unknown, "stream", unknown, unknown>>>>;
