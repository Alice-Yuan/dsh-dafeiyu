import { z } from 'zod';
export declare const browsePolicySchema: z.ZodObject<{
    perDay: z.ZodNumber;
    commentPerRound: z.ZodNumber;
    replyPerRound: z.ZodNumber;
    autoComment: z.ZodLiteral<false>;
    replyToComments: z.ZodLiteral<false>;
}, z.core.$strict>;
export type BrowsePolicy = z.infer<typeof browsePolicySchema>;
export declare const DEFAULT_BROWSE_POLICY: BrowsePolicy;
export declare const REFERENCE_LIMITS: Readonly<{
    commentChars: 150;
    replyChars: 100;
    threadDays: 7;
    threads: 8;
}>;
export declare const REPLY_DESIGN = "\u53EA\u5904\u7406\u76F4\u63A5\u56DE\u590D\u81EA\u5DF1\u8BC4\u8BBA\u7684\u65B0\u6D88\u606F\u3002\u7B80\u77ED\u6709\u7528\u7684\u95EE\u9898\u53EF\u7528\u4E00\u4E24\u53E5\u56DE\u7B54\uFF1B\u5938\u5956\u3001\u8C03\u4F83\u3001\u63A5\u6897\u3001\u9053\u8C22\u3001\u795D\u798F\u7528\u4E00\u53E5\u8F7B\u677E\u7684\u8BDD\u6536\u4F4F\u3002\u4EE3\u7801\u3001\u4F5C\u54C1\u6216\u65B9\u6848\u7D22\u53D6\u3001\u4EE3\u8868\u4F5C\u8005\u627F\u8BFA\u3001\u4E89\u5435\u3001\u9690\u79C1\u6216\u5185\u90E8\u8BBE\u7F6E\u3001\u65E0\u5173\u8BF7\u6C42\u3001\u9700\u8981\u957F\u7BC7\u89E3\u91CA\u6216\u8FDE\u7EED\u8FFD\u95EE\uFF0C\u4E00\u5F8B\u8DF3\u8FC7\u3002\u540C\u4EBA\u540C\u8BDD\u9898\u53EA\u56DE\u590D\u4E00\u6B21\uFF1B\u4E0D\u4E3A\u4E86\u51D1\u6570\u4E92\u52A8\u3002\u56DE\u590D\u6700\u591A100\u5B57\u3002";
export declare function dayOf(at: number): string;
