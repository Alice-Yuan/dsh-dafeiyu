import s from '@deepseek-ai/schemastery';
import type { PolicyContext } from './model.js';
export declare const name = "dafeyu-agent-policy";
export declare const inject: string[];
export declare const Config: s<Schemastery.ObjectS<NoInfer<{
    audience: s<"public" | "private", "public" | "private", "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    audience: s<"public" | "private", "public" | "private", "defined">;
}>>, "plain">;
export declare function apply(ctx: PolicyContext & {
    dafeyuControl: {
        installPolicy(ctx: PolicyContext, audience: 'private' | 'public'): void;
    };
}, config: {
    audience: 'private' | 'public';
}): void;
