window.__ModuleLoader__.load({ id: "dsh-dafeiyu", factory: (require) => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.name = void 0;
exports.SettingsPanel = SettingsPanel;
exports.DetailSection = DetailSection;
exports.apply = apply;
const react_1 = require("react");
exports.name = 'dafeyu-settings';
exports.inject = ['slots'];
function SettingsPanel() {
    const row = (label, value) => (0, react_1.createElement)('div', { style: { marginBlock: 12 } }, (0, react_1.createElement)('strong', null, label + '：'), (0, react_1.createElement)('span', null, value));
    return (0, react_1.createElement)('section', {
        'aria-label': '大肥鱼设置', 'data-mode': 'mock',
        style: { padding: 24, border: '1px solid #71809666', borderRadius: 16, maxWidth: 620 },
    }, (0, react_1.createElement)('small', null, 'DaFeiYu · M1 本地原型'), (0, react_1.createElement)('h2', null, '大肥鱼'), (0, react_1.createElement)('p', { role: 'status' }, '模拟模式：假模型、假平台、模拟主人消息。'), (0, react_1.createElement)('p', null, '已具备本地演示闭环；本页面为只读骨架，尚未连接桌面运行状态。'), row('主人会话', '尚未绑定'), row('允许动作', '读取模拟项目更新'), row('公开互动', '关闭'), row('自动活动', '关闭'), (0, react_1.createElement)('fieldset', { disabled: true }, (0, react_1.createElement)('legend', null, '真实连接（尚未接通）'), (0, react_1.createElement)('label', null, '主人 UID ', (0, react_1.createElement)('input', { value: '', readOnly: true, placeholder: '未绑定' })), (0, react_1.createElement)('button', { type: 'button', disabled: true }, '保存设置')), (0, react_1.createElement)('p', null, '此原型不会调用真实模型、发送聊天消息或访问 B站。'));
}
function DetailSection({ subject }) {
    if (!subject)
        return null;
    const matches = (subject.kind === 'bundle' || subject.kind === 'row')
        ? subject.pkg?.name === 'dsh-dafeiyu'
        : subject.kind === 'item' && subject.id === 'dafeyu';
    return matches ? (0, react_1.createElement)(SettingsPanel) : null;
}
function apply(ctx) {
    ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({
        name: 'plugins.detail.section', id: 'dafeyu-simulation', order: 80,
    }, DetailSection));
}

return module.exports;
} });
