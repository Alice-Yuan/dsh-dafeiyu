export const name = 'dafeyu';
export const inject: readonly string[] = [];

// Narrow structural boundary. No claims of a full SDK typing or real host integration.
export interface HostContext {
  logger: { info(message: string): void };
}
export function apply(ctx: HostContext): void {
  ctx.logger.info('DaFeiYu 模拟原型已加载：真实模型、账号及自动活动均未接通。');
  // Loading this package does not open a database, create an Agent, schedule work or access a network.
}
