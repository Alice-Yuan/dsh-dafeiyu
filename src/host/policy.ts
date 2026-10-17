import s from '@deepseek-ai/schemastery';
import type { PolicyContext } from './model.js';

export const name = 'dafeyu-agent-policy';
export const inject = ['dafeyuControl', 'tools', 'systemPrompt'];
export const Config = s.object({ audience: s.union(['private', 'public']).required() });
export function apply(ctx: PolicyContext & { dafeyuControl: { installPolicy(ctx: PolicyContext, audience: 'private' | 'public'): void } }, config: { audience: 'private' | 'public' }): void {
  ctx.dafeyuControl.installPolicy(ctx, config.audience);
}
