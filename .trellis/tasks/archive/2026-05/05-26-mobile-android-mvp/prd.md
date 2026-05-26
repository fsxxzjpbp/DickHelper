# 实现移动端 Android MVP

## Goal

按 `docs/mobile-implementation-contract.md` 落地 DickHelper 移动端 Phase 1：新增 Android-only Expo React Native app，并把跨端数据契约沉到 `packages/shared` 与 `packages/core`，让移动端可以独立记录、查看历史、删除记录，并通过 JSON 与现有 Electron 桌面端迁移数据。

## Requirements

- 调整根 `package.json` workspaces，使仓库支持 `apps/*` 与 `packages/*`。
- 新增或补全 `packages/shared`，只放跨端 TypeScript 类型，不依赖 React、React Native、Electron、SQLite、文件系统或网络。
- 新增 `packages/core`，实现纯业务数据契约：record validation、schema/table/column constants、canonical v1 JSON import/export、legacy array import、重复 `Id` 统计。
- 新增 `apps/mobile` Expo + React Native + TypeScript app，使用 `expo-router`、`react-native-paper`、`expo-sqlite`。
- 移动端底部 Tab 固定为：记录、统计、预测、历史；设置页从右上角入口进入，不作为底部 Tab。
- 记录页实现开始、暂停、继续、结束并保存记录到 SQLite。
- 历史页按 `EndTime` 倒序展示记录，提供显式删除按钮和确认弹窗。
- 设置页实现 JSON 导入、JSON 导出、关于/版本信息、AI 配置入口占位。
- 统计页和预测页只做轻量指标或稳定占位，不实现完整图表、预测模型或 AI 分析。
- 实现前、实现中、验收时都必须遵守 `docs/mobile-implementation-contract.md` 的硬禁止事项。

## Acceptance Criteria

- [x] Android mobile app 位于 `apps/mobile/**`，没有把移动端 app 代码写入根 `src/**`。
- [x] Cross-platform types 位于 `packages/shared/**`。
- [x] JSON import/export、record validation、schema constants 位于 `packages/core/**`，移动端不重复实现这些逻辑。
- [x] SQLite schema 语义保持 `Records(Id, StartTime, EndTime, Duration, Notes)` 与 `Settings(Key, Value)`。
- [x] 移动端可以新增记录、查看历史、删除记录，删除前有确认弹窗。
- [x] 移动端可以导入 canonical v1 JSON 与 legacy array JSON。
- [x] 移动端可以导出 canonical v1 JSON：`{ "version": 1, "records": [...] }`。
- [x] `packages/core` 单元测试覆盖 implementation contract 第 9.1 节列出的必测行为。
- [x] 已新增并运行可执行的 TypeScript type-check、lint、`packages/core` 测试、mobile app 基础启动或构建检查命令。
- [x] 未引入 `expo-secure-store`、Keychain、Keystore、LAN sync、APK self-update、iOS build support、滑动删除或半成品设置入口。

## Definition of Done

- Subagent 完成代码实现并在最终回复中列出改动文件、运行过的命令和结果。
- 主会话对代码 diff 做 review，重点验收契约边界、禁止事项、数据兼容、测试覆盖和质量门禁。
- 发现问题时，主会话把具体 review findings 返给 Subagent 修改；主会话不直接写实现代码。
- 质量门禁全部通过，或明确记录无法运行的命令、失败原因与剩余风险。
- 如实现中发现新的可复用约定或坑点，更新 `.trellis/spec/`。

## Technical Approach

- 以 `docs/mobile-implementation-contract.md` 为最高优先级实现契约；`docs/mobile-architecture.md` 只作为架构背景。
- 第一阶段采用 phased monorepo：保留现有 Electron 根 `src/**`，新增 `apps/mobile`、`packages/shared`、`packages/core`。
- 桌面端当前 JSON/data semantics 是权威契约；移动端和 core 包必须兼容它，而不是重新定义字段名或单位。
- `packages/core` 先落数据契约与测试，再接移动端 SQLite 和 UI，避免 UI 层各自解析 JSON。

## Out of Scope

- iOS 构建、打包或兼容承诺。
- 桌面/移动局域网同步。
- APK 自更新、更新源选择、下载更新入口。
- 完整统计图表、热力图、24h 分布图。
- 完整预测页、AI 远程分析、完整 AI 配置表单。
- 将现有 Electron 根 `src/**` 迁移到 `apps/desktop/**`。

## Technical Notes

- Required docs:
  - `docs/mobile-implementation-contract.md`
  - `docs/mobile-architecture.md`
  - `.trellis/spec/frontend/mobile-implementation.md`
- Current root `package.json` only has `packages/shared` in workspaces and only desktop scripts; implementation must add workspace/package scripts that make the required checks executable.
- Existing dirty file `src/renderer/App.tsx` is unrelated user/WIP state and must not be reverted or included unless the diff is directly required for this task.
- Implementation must be performed by a Subagent explicitly configured as `gpt-5.4-mini` with reasoning effort `xhigh`; main session owns review/acceptance.

## Review Notes

- Implementation Subagent: `019e62a4-ae83-7191-b156-de80d192913a` (`gpt-5.4-mini`, reasoning effort `xhigh`).
- Main review found and returned one blocking issue: empty or whitespace-only `Id` values were accepted by `packages/core` import parsing. Subagent fixed it and added regression tests.
- Main verification command on 2026-05-26: `npm run check` passed, covering desktop/core/mobile typecheck, lint, core tests, and `expo export --platform android`.
- `expo run:android` was not run because this environment has no Android SDK/emulator target; `expo export --platform android` was used as the feasible mobile build check.
