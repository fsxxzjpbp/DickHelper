# fix-mobile-history-truncated-text

## Goal

修复移动端"历史"页空白状态下提示文案被截断的问题。

## What I already know

- 用户在移动端看到 `先去"记录"页创建一条本地记` — 缺少 `录。`
- 源码 `history.tsx:67` 文案是完整的：`先去"记录"页创建一条本地记录。`
- 因此问题是 UI 渲染截断，不是源码缺失
- `emptySubtitle` 样式只有 `color` 和 `textAlign: "center"`，没有处理宽度/换行
- 父容器 `emptySurface` 有 `padding: 20`、`alignItems: "center"`

## Requirements

- 确保历史页空白状态下的提示文案完整显示，不被截断
- 文案内容保持语义不变

## Acceptance Criteria

- [ ] 历史页空白状态下，`先去"记录"页创建一条本地记录。` 完整可见
- [ ] 在窄屏设备上文案能正确换行，不溢出裁剪

## Definition of Done

- 修改完成并通过 typecheck

## Technical Approach

检查 `emptySubtitle` 和 `emptySurface` 的样式，确保 Text 组件不会被裁剪。可能需要给 Text 设置 `flex: 1` 或确保父容器不限制子元素宽度。

## Out of Scope

- 不改动其他页面的类似文案

## Technical Notes

- 文件：`apps/mobile/app/(tabs)/history.tsx`
- 样式定义在同文件的 `StyleSheet.create` 中（第 135-199 行）
