import { createElement as h, type ReactElement } from 'react';

export const name = 'dafeyu-settings';
export const inject = ['slots'];
interface Subject { kind: string; id?: string; pkg?: { name?: string } }
interface DetailProps { subject?: Subject }
export interface ClientContext {
  slots: {
    inject(name: string, factory: () => unknown): unknown;
    register(options: { name: string; id: string; order: number },
      component: (props: DetailProps) => ReactElement | null): unknown;
  };
}
export function SettingsPanel(): ReactElement {
  const row = (label: string, value: string) => h('div', { style: { marginBlock: 12 } },
    h('strong', null, label + '：'), h('span', null, value));
  return h('section', {
    'aria-label': '大肥鱼设置', 'data-mode': 'mock',
    style: { padding: 24, border: '1px solid #71809666', borderRadius: 16, maxWidth: 620 },
  },
  h('small', null, 'DaFeiYu · M1 本地原型'),
  h('h2', null, '大肥鱼'),
  h('p', { role: 'status' }, '模拟模式：假模型、假平台、模拟主人消息。'),
  h('p', null, '已具备本地演示闭环；本页面为只读骨架，尚未连接桌面运行状态。'),
  row('主人会话', '尚未绑定'),
  row('允许动作', '读取模拟项目更新'),
  row('公开互动', '关闭'),
  row('自动活动', '关闭'),
  h('fieldset', { disabled: true },
    h('legend', null, '真实连接（尚未接通）'),
    h('label', null, '主人 UID ', h('input', { value: '', readOnly: true, placeholder: '未绑定' })),
    h('button', { type: 'button', disabled: true }, '保存设置')),
  h('p', null, '此原型不会调用真实模型、发送聊天消息或访问 B站。'));
}
export function DetailSection({ subject }: DetailProps): ReactElement | null {
  if (!subject) return null;
  const matches = (subject.kind === 'bundle' || subject.kind === 'row')
    ? subject.pkg?.name === 'dsh-dafeiyu'
    : subject.kind === 'item' && subject.id === 'dafeyu';
  return matches ? h(SettingsPanel) : null;
}
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({
    name: 'plugins.detail.section', id: 'dafeyu-simulation', order: 80,
  }, DetailSection));
}
