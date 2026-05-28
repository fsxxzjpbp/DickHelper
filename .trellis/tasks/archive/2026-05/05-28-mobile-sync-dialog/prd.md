# Mobile sync result dialog

## Goal

将手机端局域网同步的结果从底部 Snackbar 改为弹窗（Dialog），确保用户不会错过同步结果反馈。

## What I already know

- 当前实现：`apps/mobile/app/settings/index.tsx` 第144-170行 `HandleSync` 函数
- 同步结果通过 `setMessage()` → `<Snackbar>` 显示在页面底部（第444行）
- Snackbar 自动消失（duration=3200ms），用户如果没注意底部会感到困惑
- UI 框架：react-native-paper，已有 `Dialog` 组件可用
- 同步结果数据：`IImportResult` 包含 `Imported`、`Skipped`、`Rejected` 三个计数

## Requirements

- 同步成功时弹窗显示导入/跳过/拒绝的记录数，绿色标题"同步成功"
- 同步失败时弹窗显示错误信息，红色标题"同步失败"
- 弹窗需要用户手动关闭（不会自动消失）
- Snackbar 保留给其他非同步操作使用

## Acceptance Criteria

- [ ] 同步完成后弹出 Dialog 显示结果
- [ ] Dialog 显示"导入 X 条，跳过 X 条，拒绝 X 条"
- [ ] 同步失败时 Dialog 显示错误信息
- [ ] 用户点击"确定"关闭 Dialog
- [ ] 其他操作（导入/导出/更新）仍使用 Snackbar

## Out of Scope

- 桌面端同步 UI 改动
- 同步进度指示（当前已是 loading 状态）
- 其他功能的弹窗改造

## Technical Notes

- 使用 react-native-paper 的 `Dialog` + `Dialog.Title` + `Dialog.Content` + `Dialog.Actions`
- 需要新增 state 控制 Dialog 可见性和内容
- Snackbar 保留给非同步操作
