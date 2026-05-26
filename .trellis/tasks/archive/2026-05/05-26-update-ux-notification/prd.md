# 修复更新下载无进度提示和下载完成无通知的问题

## 问题

1. 用户在"发现新版本"弹窗中点击"下载"后，弹窗消失，但没有任何进度反馈——下载在后台进行，用户看不到进度
2. 下载完成后无通知，用户不知道需要在设置页面点击安装

## 约束

- 改动最小化，不引入新组件/服务/IPC
- 复用已有 UI（Settings 页面的进度条、状态徽标、安装按钮都已存在）

## 方案（仅改 App.tsx）

### 改动 1：下载后自动跳转到设置页

在 `HandleDownloadUpdate` 中加入 `setActiveView("settings")`。Settings 页面已有完整的下载进度 UI（Progress bar + 状态文字 + 百分比），无需新增任何组件。

### 改动 2：下载完成弹窗通知

新增一个 `<Modal>`，与现有"发现新版本"弹窗模式完全一致：
- 触发条件：`IsUpdateDownloaded === true` 且当前版本未被 dismiss
- 内容：告知用户版本已下载完成，提供"前往设置"按钮和"稍后"按钮
- "前往设置"跳转到 Settings 页面（用户可见"重启安装"按钮）

### 不改的

- 不修改 Settings.tsx（进度条、安装按钮已完备）
- 不修改 updateService.ts（状态机已正确推送 downloaded 事件）
- 不修改 preload/IPC（数据通道已通）
- 不引入 Notification/Toast 系统（增加复杂度，且与现有 Modal 模式不一致）
