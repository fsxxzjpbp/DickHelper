# PRD: 自动更新与系统代理机制文档

## 背景

自动更新和系统代理是应用的关键基础设施，直接影响用户能否获取新版本。当前 `.trellis/spec/` 中没有这两块的技术文档，未来维护者无法快速理解机制。

## 需求

在 `.trellis/spec/backend/` 下新增两个文档：

### 1. `auto-update.md` — 自动更新机制

记录：
- 使用的技术栈（electron-updater + generic provider）
- 两个更新源（GitHub 直连 vs ghfast.top 镜像）及 URL 构造逻辑
- 更新生命周期：idle → checking → available → downloading → downloaded → 安装
- 设置持久化（`update-settings.json` 存储在 `app.getPath("userData")`）
- IPC 通道列表及数据流（`updates:get-state`, `updates:check`, `updates:download`, `updates:install`, `updates:set-source`）
- 关键设计决策：`autoDownload: false`（用户确认后才下载）、`generic` provider 而非 `github` provider（便于运行时切换源）
- 取消下载机制（`CancellationToken`）

### 2. `proxy.md` — 系统代理机制

记录：
- 代理配置入口（`InitProxy()` 启动时 + `updates:set-proxy` IPC 运行时）
- **双 session 关键点**：`defaultSession` 和 `"electron-updater"` partition 必须分别设置，因为 electron-updater 使用独立 Chromium partition
- 设置持久化（`proxy_enabled` 存在 Settings 表中，默认 `true`）
- `session.setProxy({ mode: "system" })` vs `{ mode: "direct" }` 的语义
- 前端开关位置（Settings 页面「应用更新」区块）
- 无需重启即时生效的原因（`session.setProxy` 实时生效）

## 格式

遵循现有 backend spec 文件格式（参考 `database-guidelines.md`、`quality-guidelines.md`）：
- `# Title` + `> 一句话描述`
- `---` 分隔
- `## 章节` 结构
- 代码块标注语言
- 关键决策用 blockquote 标注 WHY

## 非目标

- 不修改任何代码
- 不修改 index.md（两个新文件暂不加入索引，保持索引简洁）
