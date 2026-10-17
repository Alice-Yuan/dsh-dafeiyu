import { createElement as h, useEffect, useRef, useState, type ReactElement } from 'react';
import { REMOTE, type Method } from '../shared/remote.js';
import { DEFAULT_CONFIG, type PilotConfig } from '../pilot/contracts.js';

export const name = 'dafeyu-settings';
export const inject = ['slots', 'remote'];
interface Subject { kind: string; id?: string; pkg?: { name?: string } }
interface DetailProps { subject?: Subject }
export interface ClientContext {
  remote: { $mount(contribution: unknown): () => void; dafeyu: Record<Method, (request: unknown, signal?: AbortSignal) => Promise<{ ok: boolean; value?: any; error?: { message?: string } }>> };
  effect?(fn: () => (() => void)): unknown;
  slots: {
    inject(name: string, factory: () => unknown): unknown;
    register(options: { name: string; id: string; order: number },
      component: (props: DetailProps) => ReactElement | null): unknown;
  };
}
interface Snapshot { config: PilotConfig; revision: string; budget: { used: number; total: number; byPurpose: { private: number; public: number; summary: number } }; account: { uid: string } | null; busy: boolean; trialConsumed: boolean; configError: string; credentialError: string; privateSessionId: string | null; report: string | null; reportError: string | null; run: { state: string; deadline: number; reason: string } | null; actions: { id: string; kind: string; text: string; state: string; remoteId: string; selfVisible: boolean | null; publicVisible: boolean | null }[]; diagnostic: { version: string; marker: string } }
export function SettingsPanel({ ctx }: { ctx?: ClientContext }): ReactElement {
  const [status, setStatus] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<PilotConfig>({ ...DEFAULT_CONFIG });
  const [revision, setRevision] = useState(''); const dirty = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ loginId: string; image: string; expiresAt: number } | null>(null);
  const [preflight, setPreflight] = useState<{ account: { uid: string; name: string }; video: { title: string; bvid: string; hasSubtitle: boolean }; commentsRead: number; revision: string } | null>(null);
  const [chat, setChat] = useState('你好，大肥鱼。'); const [answer, setAnswer] = useState('');
  const mounted = useRef(true);
  const call = async (method: Method, request: unknown = {}, signal?: AbortSignal): Promise<any> => {
    if (!ctx) throw new Error('尚未连接 Desktop 宿主');
    const result = await ctx.remote.dafeyu[method](request, signal);
    if (!result.ok) throw new Error(result.error?.message ?? '操作失败'); return result.value;
  };
  const refresh = async (signal?: AbortSignal) => {
    const next = await call('status', {}, signal) as Snapshot;
    if (!mounted.current) return;
    setStatus(next);
    if (!dirty.current) { setDraft(next.config); setRevision(next.revision); }
  };
  useEffect(() => {
    mounted.current = true; if (!ctx) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(controller.signal); } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '状态读取失败'); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
    };
    void poll(); return () => { mounted.current = false; controller.abort(); clearTimeout(timer); };
  }, [ctx]);
  useEffect(() => {
    if (!qr || !ctx) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (Date.now() >= qr.expiresAt) { setQr(null); setNotice('二维码已过期，请重新生成。'); return; }
      try {
        const result = await call('loginPoll', { loginId: qr.loginId }, controller.signal);
        if (controller.signal.aborted) return;
        if (result.state === 'authenticated') { setQr(null); setNotice('登录成功，请运行只读预检核对账号与视频。'); await refresh(); return; }
        if (result.state === 'expired') { setQr(null); setNotice('二维码已过期。'); return; }
        setNotice(result.state === 'scanned' ? '已扫码，请在 B站手机端确认。' : '请用大肥鱼账号扫码。');
      } catch (e) { if (controller.signal.aborted) return; setError(e instanceof Error ? e.message : '登录失败'); setQr(null); return; }
      timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 2500); return () => { controller.abort(); clearTimeout(timer); };
  }, [qr, ctx]);
  const act = (work: () => Promise<void>) => { setBusy(true); setError(''); void work().then(() => refresh()).catch(e => { if (mounted.current) setError(e instanceof Error ? e.message : '操作失败'); }).finally(() => { if (mounted.current) setBusy(false); }); };
  const edit = (key: keyof PilotConfig, value: string) => { dirty.current = true; setPreflight(null); setDraft(old => ({ ...old, [key]: value })); };
  const disabled = !ctx || !status || busy;
  const button = (label: string, click: () => void, extra = false) => h('button', { type: 'button', disabled: disabled || extra, onClick: click, style: { margin: '8px 8px 8px 0', padding: '8px 14px', cursor: 'pointer' } }, label);
  const field = (label: string, key: keyof PilotConfig) => h('label', { style: { display: 'block', margin: '12px 0' } }, label,
    h(key === 'persona' ? 'textarea' : 'input', { value: draft[key], onChange: (e: { target: { value: string } }) => edit(key, e.target.value), style: { display: 'block', width: '100%', padding: 8, boxSizing: 'border-box' } }));
  const visible = (value: boolean | null) => value === true ? '已观察到' : '未确认';
  return h('section', { 'aria-label': '大肥鱼设置', 'data-mode': 'pilot', style: { padding: 24, border: '1px solid #71809666', borderRadius: 16, maxWidth: 760 } },
    h('small', null, 'DaFeiYu · 单视频实验版'), h('h2', null, '大肥鱼'),
    h('p', { role: 'status' }, status ? `模型请求 ${status.budget.used} / 5 · ${status.run?.state ?? '尚未启动'} · 15 分钟 / 1 条评论 / 2 条回复` : '尚未连接 Desktop 运行状态'),
    error ? h('p', { role: 'alert', style: { color: '#e15b64', overflowWrap: 'anywhere' } }, error) : null,
    status?.configError || status?.credentialError ? h('p', { role: 'alert' }, status.configError || status.credentialError) : null,
    notice ? h('p', null, notice) : null,
    h('fieldset', { disabled: disabled || status?.busy || status?.trialConsumed }, h('legend', null, '身份与目标'),
      field('主人 UID（不是机器人账号）', 'ownerUid'), field('目标 BV 号', 'bvid'), field('公开人格', 'persona'), field('诊断标记（仅用于配置验证）', 'diagnosticMarker'),
      button('保存设置', () => act(async () => { await call('saveConfig', { config: draft, revision }); dirty.current = false; setNotice('已保存，并由宿主读取核对。'); })),
      button('重新读取已保存配置', () => act(async () => { dirty.current = false; setPreflight(null); await refresh(); setNotice('已重新读取宿主保存的配置。'); }))),
    h('h3', null, 'B站账号'), h('p', null, status?.account ? `已保存机器人账号 UID：${status.account.uid}（运行前会重新验证）` : '尚未登录'),
    button('扫码登录', () => act(async () => { setPreflight(null); setQr(await call('loginStart')); }), !!status?.trialConsumed || !!status?.busy),
    button('移除本地登录凭证', () => act(async () => { setQr(null); setPreflight(null); await call('logout'); }), !!status?.busy),
    qr ? h('img', { src: qr.image, alt: '用大肥鱼账号扫描 B站登录二维码', width: 240, height: 240 }) : null,
    button('只读预检', () => act(async () => { setPreflight(await call('preflight')); }), dirty.current || !status?.account || !!status?.busy),
    preflight ? h('p', null, `账号 ${preflight.account.name}（${preflight.account.uid}） · ${preflight.video.title} · 读取 ${preflight.commentsRead} 条评论 · ${preflight.video.hasSubtitle ? '有字幕' : '无字幕，不会声称看完视频'}`) : null,
    h('h3', null, '主人会话'), h('p', null, '首次验收预留 1 次私聊请求；活动结束的汇报另预留 1 次。'),
    h('textarea', { value: chat, onChange: (e: { target: { value: string } }) => setChat(e.target.value), maxLength: 4000, 'aria-label': '给大肥鱼的消息', style: { width: '100%', minHeight: 70 } }),
    button('发送到大肥鱼会话', () => act(async () => { const result = await call('chat', { text: chat }); setAnswer(result.text); }), !chat.trim() || !!status?.budget.byPurpose.private || !!status?.busy),
    answer ? h('p', { style: { whiteSpace: 'pre-wrap' } }, answer) : null,
    status?.privateSessionId ? h('p', null, '持久会话已建立，可在侧栏打开「大肥鱼 · 主人会话」。') : null,
    h('h3', null, '限定视频试跑'),
    h('p', null, '启动即允许在上述视频公开发言，最多 1 条评论和 2 条直接回复；单条最多 150 字。到期、取消或重启不续跑，额度不自动重置。'),
    button('启动一次 15 分钟试跑', () => act(async () => { await call('start', { revision: preflight!.revision, accountUid: preflight!.account.uid }); setNotice('试跑已启动。'); }), !preflight || dirty.current || preflight.revision !== status?.revision || !!status?.trialConsumed || !!status?.busy),
    h('button', { type: 'button', disabled: !ctx || !status?.busy, onClick: () => { void call('stop').then(() => refresh()).catch(e => setError(e instanceof Error ? e.message : '停止失败')); }, style: { padding: '8px 14px' } }, '立即停止'),
    button('仅核对发送回执', () => act(async () => { await call('reconcile'); }), !!status?.busy),
    ...(status?.actions ?? []).map(a => h('article', { key: a.id, style: { borderTop: '1px solid #71809666', paddingTop: 12, marginTop: 12 } },
      h('p', null, a.text), h('p', null, `${a.state} · 本人可见：${visible(a.selfVisible)} · 公开可见：${visible(a.publicVisible)}`),
      a.remoteId ? h('a', { href: `https://www.bilibili.com/video/${status!.config.bvid}/#reply${a.remoteId}`, target: '_blank', rel: 'noreferrer' }, '查看评论') : null)),
    status?.run?.reason ? h('p', null, '结束或暂停原因：' + status.run.reason) : null,
    status?.reportError ? h('p', null, '汇报未完成：' + status.reportError) : null,
    h('p', { style: { fontSize: 12, opacity: 0.8 } }, '账号凭证由 Windows 当前用户加密保护。试跑记录保存在本地；模型上下文和聊天记录遵循 DSH 的会话保留设置。'),
    status ? h('small', null, `版本 ${status.diagnostic.version} · 配置诊断：${status.diagnostic.marker || '未设置标记'}`) : null);
}
export function DetailSection({ subject, ctx }: DetailProps & { ctx?: ClientContext }): ReactElement | null {
  if (!subject) return null;
  const matches = (subject.kind === 'bundle' || subject.kind === 'row')
    ? subject.pkg?.name === 'dsh-dafeiyu'
    : subject.kind === 'item' && subject.id === 'dafeyu';
  return matches ? h(SettingsPanel, ctx ? { ctx } : {}) : null;
}
export function apply(ctx: ClientContext): void {
  const unmount = ctx.remote.$mount(REMOTE);
  ctx.effect?.(() => unmount);
  ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({
    name: 'plugins.detail.section', id: 'dafeyu-pilot', order: 80,
  }, props => h(DetailSection, { ...props, ctx })));
}
