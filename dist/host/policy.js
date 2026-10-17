import s from '@deepseek-ai/schemastery';
export const name = 'dafeyu-agent-policy';
export const inject = ['dafeyuControl', 'tools', 'systemPrompt'];
export const Config = s.object({ audience: s.union(['private', 'public']).required() });
export function apply(ctx, config) {
    ctx.dafeyuControl.installPolicy(ctx, config.audience);
}
//# sourceMappingURL=policy.js.map