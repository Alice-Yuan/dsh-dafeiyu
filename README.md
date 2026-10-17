# 大肥鱼 · DaFeiYu

寄宿于 DeepSeek Harness Desktop 的个人 AI 插件，探索持续人格、长期记忆与主动互动，首期外部平台计划接入 Bilibili。

**当前版本：`dsh-dafeiyu@0.0.1-mock.2`，本地模拟原型。** 已有模拟事件处理、去重、SQLite 持久化、权限边界和只读设置骨架。真实模型、主人会话投递、B站登录与自主活动尚未接通。

## 通过官方 Desktop 安装

兼容基线为 **DeepSeek Harness Desktop 0.2.1-rc.2**。在官方 Desktop 的侧栏「插件」中打开安装入口，填入仓库地址：

```text
https://github.com/Alice-Yuan/dsh-dafeiyu.git
```

按 Desktop 提示安装并处理重新加载。仓库携带预编译的 `dist/`、`dsh.bundle` 声明和 `cordis.patch.yml`，安装本插件不需要执行构建脚本；尚未发布到 npm，不能只填包名从 npm 安装。

详细说明见 [Desktop 安装说明](docs/desktop-install.md)。安装注册、插件加载、设置页和真实业务链路分别验收，不能互相替代。目前完整桌面界面和会话链路仍待验收。

## 本地开发

使用 Node.js 24，在仓库根目录执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run demo
npm run preview
```

`check` 执行类型检查、构建与测试；`demo` 只处理合成数据；`preview` 生成静态设置页，不启动服务。`bundle:check` 是针对已固定的本机 Desktop 安装的额外探针，不属于普通安装流程。

仓库提交包含源码及编译结果，更新源码后应运行构建并同步 `dist/`。开发依赖已固定版本；安装包没有生产依赖或安装生命周期脚本，React 由宿主提供。当前保留 `private: true`，防止误发布到 npm，不影响从 GitHub 安装。

## 边界

- 插件加载只记录模拟状态，不调用真实模型、不连接账号、不创建定时任务。
- 设置页是只读原型，控件禁用，尚未读取实际运行配置。
- 主人身份必须显式绑定 UID；外部网页、评论和字幕不能改变身份或权限。
- 私密记忆与公开生成上下文隔离，公开互动默认关闭。

本仓库分发源码、编译结果和合成测试；本机安装备份、配置快照、凭证、会话及运行数据库不随仓库发布。
