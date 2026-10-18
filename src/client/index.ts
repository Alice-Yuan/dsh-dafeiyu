import { createElement as h, useEffect, useRef, useState, type ReactElement } from 'react';
import { REMOTE, type Method } from '../shared/remote.js';
import { DEFAULT_CONFIG, type PilotConfig } from '../pilot/contracts.js';
import type { BrowseRun, Reading } from '../browse/contracts.js';
import { DEFAULT_BROWSE_POLICY, type BrowsePolicy } from '../browse/policy.js';
import type { PreviewRound, CurationResult } from '../browse/contracts.js';

export const name = 'dafeyu-settings';
interface Snapshot {
  privateBudget?: { grantId: string | null; limit: number; used: number; remaining: number; lifetimeUsed: number; outputTokens: number; enabled: boolean } | null;
  browseSettings?: { policy: BrowsePolicy; revision: string };
  browseUsage?: { day: string; picked: number; remaining: number; requests: number; todayRequests: number; latest: PreviewRound | null };
}
export const inject = ['slots', 'remote'];
interface Subject { kind: string; id?: string; pkg?: { name?: string } }
interface DetailProps { subject?: Subject }
export interface ClientContext {
  remote: { $mount(contribution: unknown): Promise<() => Promise<void>>; dafeyu: Record<Method, (request: unknown, signal?: AbortSignal) => Promise<{ ok: boolean; value?: any; error?: { message?: string } }>> };
  inject(names: string[], apply: (ctx: ClientContext) => void): { dispose(): Promise<void> };
  slots: {
    inject(name: string, factory: () => unknown): unknown;
    register(options: { name: string; id: string; order: number },
      component: (props: DetailProps) => ReactElement | null): unknown;
  };
}
interface Snapshot { browseBusy?: boolean; browseRun?: BrowseRun | null; ownerVideoRequest?: string | null; ownerVideoBaselineAt?: string | null; modelPinned?: boolean; modelSelection?: { provider: string; model: string }; videoCalibrationConsumed?: boolean; videoReview?: string | null; videoInspectionRevision?: string; config: PilotConfig; revision: string; budget: { used: number; total: number; lifetimeUsed?: number; grant?: string; byPurpose: { private: number; public: number; summary: number } }; account: { uid: string } | null; busy: boolean; trialConsumed: boolean; configError: string; credentialError: string; privateSessionId: string | null; report: string | null; reportError: string | null; videoInspection?: string | null; videoInspectionConsumed?: boolean; mediaTrialConsumed?: boolean; run: { state: string; deadline: number; reason: string } | null; actions: { id: string; kind: string; text: string; state: string; remoteId: string; selfVisible: boolean | null; publicVisible: boolean | null }[]; diagnostic: { version: string; marker: string; decoderAvailable?: boolean } }
export function SettingsPanel({ ctx }: { ctx?: ClientContext }): ReactElement {
  const [status, setStatus] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<PilotConfig>({ ...DEFAULT_CONFIG });
  const [revision, setRevision] = useState(''); const dirty = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ loginId: string; image: string; expiresAt: number } | null>(null);
  const [preflight, setPreflight] = useState<{ account: { uid: string; name: string }; video: { title: string; bvid: string; hasSubtitle: boolean; frameCount?: number; durationSeconds?: number }; commentsRead: number; revision: string } | null>(null);
  const [chat, setChat] = useState('你好，大肥鱼。'); const [answer, setAnswer] = useState('');
  const [evidence, setEvidence] = useState<{ revision: string; subtitle: string | null; frames: { atSeconds: number; image: string }[] } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [modelRows, setModelRows] = useState<{ provider: string; name: string; models: { id: string; name: string; description?: string; inputModalities?: string[] }[] }[]>([]);
  const [modelKey, setModelKey] = useState('');
  const [keyword, setKeyword] = useState(''); const [readings, setReadings] = useState<Reading[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [browsePolicy, setBrowsePolicy] = useState<BrowsePolicy>({ ...DEFAULT_BROWSE_POLICY });
  const [policyRevision, setPolicyRevision] = useState(''); const policyDirty = useRef(false);
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
    if (!policyDirty.current && next.browseSettings) { setBrowsePolicy(next.browseSettings.policy); setPolicyRevision(next.browseSettings.revision); }
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
  const readState = (value: string) => ({ subtitle: '已取得字幕，尚未由模型判断', 'no-subtitle': '无字幕，跳过', seen: '近期已读，跳过', deferred: '达到本批读取上限', failed: '读取失败' }[value] ?? value);
  const latestPreview = status?.browseUsage?.latest;
  const curated = latestPreview?.state === 'completed' && latestPreview.kind === 'curation' ? latestPreview.result as CurationResult | null : null;
  const limitField = (label: string, key: 'perDay' | 'commentPerRound' | 'replyPerRound', min: number, max: number) => h('label', { style: { display: 'block', margin: '8px 0' } }, label + ' ',
    h('input', { type: 'number', min, max, value: browsePolicy[key], onChange: (e: { target: { value: string } }) => { policyDirty.current = true; setBrowsePolicy(p => ({ ...p, [key]: Number(e.target.value) })); } }));
  let videoText = '', reviewLabel = '待复核', reviewed = false;
  if (status?.videoReview) { try { const r = JSON.parse(status.videoReview); if (r.revision === status.videoInspectionRevision) { reviewed = r.decision === 'approved'; reviewLabel = reviewed ? '已复核通过' : '已驳回：' + r.note; } } catch { /* Treat malformed state as unreviewed. */ } }
  if (status?.videoInspection) { try { const v = JSON.parse(status.videoInspection); videoText = [v.analysis.summary, ...v.analysis.observations.map((o: { atSeconds: number; description: string }) => `${o.atSeconds.toFixed(1)} 秒：${o.description}`), '理解范围：画面采样，音频未转写。', ...v.analysis.limitations].join('\n'); } catch { videoText = '内容理解记录无法读取，请查看诊断。'; } }
  return h('section', { 'aria-label': '大肥鱼设置', 'data-mode': 'pilot', style: { padding: 24, border: '1px solid #71809666', borderRadius: 16, maxWidth: 760 } },
    h('small', null, 'DaFeiYu · 单视频实验版'), h('h2', null, '大肥鱼'),
    h('p', { role: 'status' }, status ? `旧试跑请求 ${status.budget.used} / ${status.budget.total} · 历史试跑累计 ${status.budget.lifetimeUsed ?? status.budget.used} · ${status.run?.state ?? '尚未启动'} · 15 分钟 / 1 条评论 / 2 条回复` : '尚未连接 Desktop 运行状态'),
    error ? h('p', { role: 'alert', style: { color: '#e15b64', overflowWrap: 'anywhere' } }, error) : null,
    status?.configError || status?.credentialError ? h('p', { role: 'alert' }, status.configError || status.credentialError) : null,
    notice ? h('p', null, notice) : null,
    h('fieldset', { disabled: disabled || status?.busy }, h('legend', null, '身份、目标与人格（历史公开授权不变）'),
      field('主人 UID（不是机器人账号）', 'ownerUid'), field('目标 BV 号', 'bvid'), field('公开人格', 'persona'), field('诊断标记（仅用于配置验证）', 'diagnosticMarker'),
      button('保存设置', () => act(async () => { await call('saveConfig', { config: draft, revision }); dirty.current = false; setNotice('已保存，并由宿主读取核对。'); })),
      button('重新读取已保存配置', () => act(async () => { dirty.current = false; setPreflight(null); await refresh(); setNotice('已重新读取宿主保存的配置。'); }))),
    h('h3', null, '会话模型'),
    h('p', null, status?.modelSelection ? `当前：${status.modelSelection.provider} / ${status.modelSelection.model}（${status.modelPinned ? '固定选择' : '跟随宿主默认'}）` : '尚未读取模型'),
    button('读取宿主模型列表', () => act(async () => { setModelRows(await call('models')); })),
    h('select', { 'aria-label': '大肥鱼会话模型', value: modelKey, disabled: disabled || !!status?.busy, onChange: (e: { target: { value: string } }) => setModelKey(e.target.value), style: { maxWidth: '100%', padding: 8 } },
      h('option', { value: '' }, '请选择固定使用的模型'),
      ...modelRows.flatMap(p => p.models.map(m => h('option', { key: JSON.stringify([p.provider,m.id]), value: JSON.stringify([p.provider,m.id]) }, p.name + ' / ' + m.name + (m.inputModalities?.includes('image') ? ' · 支持图像' : '') + (m.description ? ' · ' + m.description : ''))))),
    button('保存固定模型', () => act(async () => { const [provider, model] = JSON.parse(modelKey); const result = await call('saveModel', { provider, model }); setNotice(result.imageSupported ? '模型已固定；支持画面输入。' : '模型已固定；不支持画面时会拒绝检看，不自动换模型。'); }), !modelKey || !!status?.busy),
    h('p', null, '名称和说明来自宿主模型目录；不自动判断价格或切换备用模型。保存不发起生成请求，也不重置预算。'),
    h('h3', null, 'B站账号'), h('p', null, status?.account ? `已保存机器人账号 UID：${status.account.uid}（运行前会重新验证）` : '尚未登录'),
    button('扫码登录 / 同账号重新认证', () => act(async () => { setPreflight(null); setQr(await call('loginStart')); }), !!status?.busy),
    h('p', null, '重新认证只能使用已绑定的机器人 UID；注销或重登不会恢复试跑、发送次数或模型额度。'),
    button('移除本地登录凭证', () => act(async () => { setQr(null); setPreflight(null); await call('logout'); }), !!status?.busy),
    qr ? h('img', { src: qr.image, alt: '用大肥鱼账号扫描 B站登录二维码', width: 240, height: 240 }) : null,
    button('只读预检', () => act(async () => { setPreflight(await call('preflight')); }), dirty.current || !status?.account || !!status?.busy),
    preflight ? h('p', null, `账号 ${preflight.account.name}（${preflight.account.uid}） · ${preflight.video.title} · 读取 ${preflight.commentsRead} 条评论 · ${preflight.video.hasSubtitle ? '有字幕' : '无字幕，默认跳过内容判断；未下载媒体或抽帧'}`) : null,
    h('h3', null, '按兴趣浏览'),
    h('p', null, '输入想了解的话题，手动浏览一批。最多搜索2页、读取3个新视频的字幕，2分钟后停止；不调用模型、不下载视频、不发布内容，也不改变上面的评论试跑目标。'),
    h('input', { 'aria-label': '浏览兴趣关键词', value: keyword, maxLength: 80, placeholder: '例如：独立游戏开发', disabled: disabled || !!status?.busy, onChange: (e: { target: { value: string } }) => setKeyword(e.target.value), style: { width: '100%', padding: 8, boxSizing: 'border-box' } }),
    button('搜索并读取一批字幕', () => act(async () => {
      setBrowsing(true);
      try { const result = await call('browse', { keyword, accountUid: status!.account!.uid }); setReadings(await call('browseHistory')); setNotice(`浏览${result.state === 'completed' ? '完成' : '已停止'}：${result.reason}；没有调用模型或发布内容。`); }
      finally { if (mounted.current) setBrowsing(false); }
    }), !keyword.trim() || !status?.account || !!status?.busy || dirty.current),
    h('button', { type: 'button', disabled: !ctx || !(browsing || status?.browseBusy), onClick: () => { void call('stop').then(() => refresh()).catch(e => setError(e instanceof Error ? e.message : '停止失败')); }, style: { padding: '8px 14px' } }, '停止本批浏览'),
    button('读取最近浏览记录', () => act(async () => { setReadings(await call('browseHistory')); })),
    h('p', null, '最近200个视频用于判重，最近20个批次保留结果；旧记录自动淘汰，淘汰后可能重新读取。页面展示最近10个视频，字幕最多保留20000字；没有图片缓存。批次间至少间隔60秒，重启不续跑。'),
    status?.browseRun ? h('div', { role: 'status' },
      h('p', null, `最近一批「${status.browseRun.keyword}」：${status.browseRun.state} · ${status.browseRun.reason} · 搜索${status.browseRun.pages}页 / 尝试读取${status.browseRun.read}个`),
      ...status.browseRun.items.map(item => h('p', { key: item.bvid }, h('a', { href: `https://www.bilibili.com/video/${item.bvid}/`, target: '_blank', rel: 'noreferrer' }, item.title), ' · ' + readState(item.state)))) : null,
    ...readings.map(item => h('details', { key: `${item.accountUid}:${item.bvid}` },
      h('summary', null, item.title + ' · ' + readState(item.state)),
      h('p', null, `UP主：${item.author} · ${new Date(item.at).toLocaleString()}${item.truncated ? ' · 字幕达到保留上限，可能截断' : ''}`),
      h('a', { href: `https://www.bilibili.com/video/${item.bvid}/`, target: '_blank', rel: 'noreferrer' }, '打开来源视频'),
      h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 300, overflow: 'auto' } }, item.subtitle ?? '没有字幕，未下载媒体或推测视频内容。'))),
    h('h3', null, '精选与草稿 · 仅预览'),
    h('p', null, '沿用参考项目的取舍：值得占用一次注意力才精选，可以全部跳过。每日额度按北京时间统计精选视频，浏览和模型请求另计。'),
    h('fieldset', { disabled: disabled || !!status?.busy }, h('legend', null, '浏览额度与回复规则'),
      limitField('每天最多精选（0表示暂停精选）', 'perDay', 0, 50),
      limitField('每轮最多评论草稿（0表示不生成）', 'commentPerRound', 0, 20),
      limitField('每轮最多回复草稿', 'replyPerRound', 1, 10),
      button('保存浏览限额', () => act(async () => { await call('saveBrowsePolicy', { policy: browsePolicy, revision: policyRevision }); policyDirty.current = false; setNotice('浏览限额已保存，已有消耗保留；未调用模型或开启发送。'); }), !policyRevision),
      button('重新读取浏览限额', () => act(async () => { policyDirty.current = false; await refresh(); }))),
    h('p', null, '自动评论：关闭；自动回复：关闭。评论草稿最多150字，回复最多100字。同一人同一线程只处理一次；只接受直接回复自己评论的简短问题或轻松互动，长篇索取、隐私、争吵和连续追问跳过。回复筛选内核已接入测试，真实回复轮询尚未开放。'),
    status?.browseUsage ? h('p', { role: 'status' }, `${status.browseUsage.day}（北京时间）已精选 ${status.browseUsage.picked} / ${status.browseSettings?.policy.perDay ?? 5}；预览模块模型请求：今日 ${status.browseUsage.todayRequests}，累计 ${status.browseUsage.requests}。此前试跑及一次性草稿请求单独保留。`) : null,
    button('筛选最近一批并打印草稿（1次模型请求）', () => act(async () => {
      const result = await call('curateBrowse', { runId: status!.browseRun!.id, accountUid: status!.account!.uid });
      setNotice(`本批预览${result.state === 'completed' ? '完成' : '结束'}，结果显示在下方；没有发送。`);
    }), !status?.account || status?.browseRun?.state !== 'completed' || !status.browseRun.items.some(i => i.state === 'subtitle') || !!status?.busy || policyDirty.current || (status?.browseUsage?.remaining ?? 0) === 0 || latestPreview?.source === status?.browseRun?.id),
    h('p', null, '每批最多一次模型请求，2048输出tokens；失败也记次数，不自动重试。停止后不恢复，同一批不能重复生成。字幕可能只覆盖首个分P或片段，不能当作完整观看。'),
    latestPreview ? h('p', null, `最近预览：${latestPreview.state}${latestPreview.reason ? ' · ' + latestPreview.reason : ''} · 模型请求${latestPreview.requested ? '已预约计数' : '未发起'}`) : null,
    ...(curated?.videos ?? []).map(v => h('article', { key: v.bvid, style: { borderTop: '1px solid #71809666', padding: '10px 0' } },
      h('a', { href: `https://www.bilibili.com/video/${v.bvid}/`, target: '_blank', rel: 'noreferrer' }, v.bvid),
      h('p', null, (v.pick ? '精选：' : '跳过：') + v.reason), h('p', null, '大肥鱼的感想：' + v.thought),
      h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, v.comment ? '评论草稿（未发送）：' + v.comment : '本条没有评论草稿。'))),
    h('h3', null, '视频内容'),
    h('p', null, status?.diagnostic.decoderAvailable ? '画面解码器可用（FFmpeg / ffprobe）。' : '未检测到 FFmpeg / ffprobe：可正常读取字幕，画面分析暂不可用。插件不会自动安装外部程序。'),
    h('p', null, '原视频临时文件处理后删除；预览不另存图片。交给模型的图像由 DSH 保存为会话附件，当前没有自动清理策略。一次只读校准最多提交3帧。'),
    h('p', null, '平时只读字幕，不自动抽帧。主人在指定视频或大肥鱼自己的评论下真实 @ 它，用自然语言说“帮我看看这个视频里发生了什么”等即可。按 UID 验证，明确要求检看才放行。当前手动检查有限页评论，尚未接入全站@通知。'),
    button(status?.ownerVideoBaselineAt ? '检查主人 @ 检看请求' : '建立主人 @ 请求基线', () => act(async () => { const result = await call('checkOwnerRequest'); setNotice(result.found ? '已核验主人检看指令；可在现有额度内显式执行，尚未抽帧或调用模型。' : '未发现基线之后的新指令；没有抽帧或调用模型。'); }), !!status?.busy || !status?.account),
    h('p', null, status?.ownerVideoRequest ? '已记录主人检看请求；执行前会再次核验原评论。' : '尚无已核验的主人检看请求。'),
    button('执行主人检看请求（1 次模型请求）', () => act(async () => { await call('inspectVideo'); setNotice('视频内容理解已保存；未发送评论。'); }), !status?.ownerVideoRequest || dirty.current || !status?.account || !!status?.busy || !!status?.videoInspection || status?.budget.grant === 'media-trial-2' || (status?.budget.used ?? 5) >= 5 || (status?.budget.byPurpose.public ?? 3) >= 3),
    videoText ? h('div', null, h('h4', null, '模型分析 · ' + reviewLabel),
      h('p', null, '收到图像和返回答案不代表理解正确。请对照原帧检查具体描述；画面姿态、连续动作和因果可能被误读。'),
      h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, videoText),
      status?.mediaTrialConsumed ? button('改用剩余额度做一次只读校准', () => act(async () => { await call('calibrateVideo', { revision: status!.videoInspectionRevision, reallocateOnePublicRequest: true }); setEvidence(null); setNotice('校准分析已保存，仍待原帧复核；没有恢复试跑或发送。'); }), !status?.ownerVideoRequest || !!status?.busy || status?.run?.state !== 'cancelled' || !reviewLabel.startsWith('已驳回') || !!status?.videoCalibrationConsumed || (status?.budget.byPurpose.public ?? 3) >= 3 || (status?.budget.used ?? 4) >= 4) : null,
      button('加载原帧对照（不调用模型）', () => act(async () => { setEvidence(await call('videoEvidence')); }), !status?.ownerVideoRequest || !!status?.busy),
      evidence && evidence.revision === status?.videoInspectionRevision ? h('div', null,
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, ...evidence.frames.map((f, i) => h('figure', { key: i, style: { margin: 0, maxWidth: 340 } }, h('img', { src: f.image, alt: `视频原帧 ${f.atSeconds.toFixed(3)} 秒`, width: 320, style: { maxWidth: '100%', height: 'auto' } }), h('figcaption', null, `${f.atSeconds.toFixed(3)} 秒`)))),
        evidence.subtitle ? h('p', { style: { whiteSpace: 'pre-wrap' } }, evidence.subtitle) : null,
        h('textarea', { 'aria-label': '视频复核备注', value: reviewNote, maxLength: 1000, placeholder: '记下误读或复核依据（仅存本地，不进入模型）', onChange: (e: { target: { value: string } }) => setReviewNote(e.target.value), style: { width: '100%', minHeight: 60 } }),
        button('描述与原帧一致，标记通过', () => act(async () => { await call('reviewVideo', { revision: evidence.revision, decision: 'approved', note: reviewNote }); setNotice('视频描述已复核；未启动试跑。'); }), !!status?.busy),
        button('发现误读，驳回此分析', () => act(async () => { await call('reviewVideo', { revision: evidence.revision, decision: 'rejected', note: reviewNote }); setNotice('分析已驳回，不能据此启动新试跑。'); }), !!status?.busy)) : null) : null,
    h('h3', null, '主人会话'), h('p', null, status?.privateBudget ? `独立私聊额度：已用 ${status.privateBudget.used} / ${status.privateBudget.limit}，剩余 ${status.privateBudget.remaining}；累计 ${status.privateBudget.lifetimeUsed}。每次最多 ${status.privateBudget.outputTokens} 输出 tokens。` : '先保存主人 UID；私聊不需要目标 BV 或 B站登录。'),
    h('p', null, '私聊额度与公开试跑独立，失败计次、停止或重启不补额。目前未开放新增额度，默认规则待主人确认；旧公开预算与记录保持。'),
    h('textarea', { value: chat, onChange: (e: { target: { value: string } }) => setChat(e.target.value), maxLength: 4000, 'aria-label': '给大肥鱼的消息', style: { width: '100%', minHeight: 70 } }),
    button('发送到大肥鱼会话', () => act(async () => { const result = await call('chat', { text: chat }); setAnswer(result.text); }), !chat.trim() || !status?.privateBudget?.enabled || !!status?.busy),
    answer ? h('p', { style: { whiteSpace: 'pre-wrap' } }, answer) : null,
    status?.privateSessionId ? h('p', null, '持久会话已建立，可在侧栏打开「大肥鱼 · 主人会话」。') : null,
    h('h3', null, '限定视频试跑'),
    h('p', null, '启动即允许在上述视频公开发言，最多 1 条评论和 2 条直接回复；单条最多 150 字。到期、取消或重启不续跑，额度不自动重置。'),
    button('启动一次 15 分钟试跑', () => act(async () => { await call('start', { revision: preflight!.revision, accountUid: preflight!.account.uid }); setNotice('试跑已启动。'); }), !preflight || dirty.current || preflight.revision !== status?.revision || !!status?.trialConsumed || !!status?.busy),
    status?.trialConsumed ? h('p', null, '完成视频内容理解后，可手动启动获准的第二次试跑：相同账号和视频，15 分钟、1 评论/2 回复，独立新增 4 次请求（公开判断 3 次、汇报 1 次）。旧记录保留，本次仍只能启动一次。') : null,
    status?.trialConsumed ? button('启动第二次媒体试跑（15 分钟）', () => act(async () => { await call('startMediaTrial', { revision: preflight!.revision, accountUid: preflight!.account.uid }); setNotice('第二次试跑已启动，旧记录已保留。'); }), !preflight || dirty.current || preflight.revision !== status?.revision || !status?.videoInspection || !reviewed || !!status?.mediaTrialConsumed || !!status?.busy) : null,
    h('button', { type: 'button', disabled: !ctx || !status?.busy, onClick: () => { void call('stop').then(() => { setNotice('已停止；不会续跑或补充额度。'); return refresh(); }).catch(e => setError(e instanceof Error ? e.message : '停止失败')); }, style: { padding: '8px 14px' } }, '立即停止'),
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
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(REMOTE);
  // Namespaces are separate Cordis services in Desktop 0.2.1-rc.2.
  // Mount first, then use the namespace from an explicitly injected child context.
  const view = ctx.inject(['slots', 'remote.dafeyu'], ready => {
    ready.slots.inject('plugins.detail.section', () => ready.slots.register({
      name: 'plugins.detail.section', id: 'dafeyu-pilot', order: 80,
    }, props => h(DetailSection, { ...props, ctx: ready })));
  });
  return async () => { await view.dispose(); await unmount(); };
}
