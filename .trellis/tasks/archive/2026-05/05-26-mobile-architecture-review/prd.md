# 批判性审阅移动端架构方案

## Goal

批判性审阅现有移动端架构初稿，把它从“方向性讨论文档”收敛为适合低人工参与、低代码背景场景下交给 LLM 执行的工程方案。重点不是立即实现移动端，而是识别方案中的模糊点、风险点、缺失契约，并产出后续可执行的文档/任务边界。

## What I already know

- 当前应用是 Electron 桌面应用，准备增加移动端支持。
- 移动端初稿实际位于 `docs/mobile-architecture.md`。
- `docs/migration-guide.md` 当前是旧版浏览器数据迁移到 Electron 的用户说明，不是移动端架构方案。
- 初稿选型为 Expo + React Native + TypeScript，Android 为唯一一等目标平台，iOS 仅保留源码。
- 初稿包含若干有意偏离通用最佳实践的业务决策：AI 配置明文存 SQLite、不引入安全存储、不构建 iOS、不做历史列表滑动删除等。
- 当前 `packages/shared` 主要只有类型定义；预测、AI 分析、导入导出、计时器等逻辑仍分散在 Electron main/renderer 代码中，尚未成为平台无关核心包。
- 当前工作树存在另一个进行中的 Trellis 任务 `05-26-update-ux-notification` 及其代码改动，本任务不应混入那些修改。
- 用户说明：早前版本其实更详细，后来担心弱 LLM 的建议质量不稳定，因此主动收敛成更粗的方案。本任务需要把必要细节补回来，但要以强约束、低自由度的形式服务后续 LLM 实现。

## Assumptions (temporary)

- 本任务先做架构和执行契约审阅，不直接实现移动端代码。
- 目标读者包含普通 LLM，因此方案应减少“自行判断”的空间，明确目录、边界、禁止事项、质量门禁和验收标准。
- 移动端第一阶段最好先收敛到 Android MVP，再逐步加入同步、自更新、复杂图表等风险更高的能力。
- 采用“双文档”策略：保留 `docs/mobile-architecture.md` 作为架构决策/产品约束草稿，新增面向 LLM 执行的 implementation contract 文档。

## Open Questions

- None.

## Requirements (evolving)

- 批判性审阅现有移动端方案，而不是默认接受初稿决策。
- 识别会导致 LLM 写出低质量代码的模糊点，包括但不限于 monorepo 结构、共享包边界、数据 schema、同步协议、更新机制和质量门禁。
- 保留用户明确认可的业务约束，尤其是 Android 优先、iOS 不保证、AI 配置明文存储、不引入额外安全存储、不用滑动删除。
- 将最终建议转化为可执行文档结构或后续实现阶段任务。
- 新增一份 `docs/mobile-implementation-contract.md`，用于约束后续 LLM 实现；`docs/mobile-architecture.md` 保留为架构决策草稿，可在必要时补充链接和警告。
- 第一阶段 MVP 锁定为“独立 Android MVP”：移动端可独立记录和查看历史，可用 SQLite 持久化，可通过 JSON 与桌面端迁移数据。
- 第一阶段不包含桌面/移动局域网同步、APK 自更新、复杂统计图表和完整预测体验。
- 第一阶段采用混合共享策略：只先抽取必须跨端一致的数据契约、JSON import/export、记录校验、schema 常量等核心逻辑；UI、复杂统计、预测和 AI 调用可后置或各端暂时保留。
- 目标 monorepo 结构为 `apps/desktop`、`apps/mobile`、`packages/shared`、`packages/core`；第一阶段允许暂不迁移现有 Electron 根 `src/**`，但新移动端代码必须进入 `apps/mobile`，新跨端逻辑必须进入 `packages/shared` 或 `packages/core`。
- Phase 1 数据契约以当前桌面端 JSON 导入导出格式和记录语义为权威基准；移动端必须兼容 `{ version: 1, records: [...] }` 新版格式和旧版数组导入格式。
- Phase 1 保留记录、统计、预测、历史四个底部 Tab；记录和历史必须可用，统计和预测只做轻量版本或稳定占位，不实现完整图表/预测体验。
- Phase 1 设置页采用最小范围：实现数据导入导出、关于信息、AI 配置入口占位；不实现 APK 更新设置、局域网同步入口或完整 AI 配置表单。
- Phase 1 强制为 `packages/core` 的 JSON import/export、record validation、schema constants、旧版数组兼容、重复 Id 去重添加单元测试；移动 UI 自动化测试不作为 Phase 1 强制项。
- Phase 1 冻结移动端技术栈：Expo + React Native + TypeScript、react-native-paper、expo-router、expo-sqlite；除非先修改 implementation contract，否则 LLM 不得自行替换核心框架、UI 库、路由库或数据库方案。
- Implementation contract 必须包含硬禁止事项清单，覆盖 iOS 构建、安全存储、滑动删除、同步、APK 更新、依赖替换、目录污染、绕过 core 数据契约、半成品入口等高风险行为。
- 用户已确认进入文档实施阶段：新增 `docs/mobile-implementation-contract.md`，并轻量更新 `docs/mobile-architecture.md` 指向该 contract。
- 用户要求：当前文档任务完成后，另开一个新任务执行移动端开发；开发必须指定 subagent，且 subagent 由用户指定；开始开发前必须停下询问用户，不得自行派发或实现。

## Acceptance Criteria (evolving)

- [x] 明确指出现有方案中哪些内容适合作为 ADR，哪些内容不足以指导实现。
- [x] 明确列出需要补齐的工程契约：目录结构、平台边界、共享核心包、SQLite schema/migration、JSON 格式、同步协议、质量门禁。
- [x] 给出推荐的移动端 MVP 阶段边界和后置项。
- [x] 若修改文档，文档应能直接约束 LLM 实现，减少“按最佳实践自动改写业务决策”的风险。
- [x] 第一阶段 MVP 明确排除局域网同步和 APK 自更新。
- [x] 执行契约明确哪些逻辑必须共享，哪些逻辑第一阶段允许端内实现或后置。
- [x] 执行契约明确 monorepo 目标结构和第一阶段允许的过渡状态。
- [x] 执行契约明确桌面端当前 JSON 格式、record 字段、时间格式、Duration 单位和 Id 去重规则是移动端 Phase 1 权威契约。
- [x] 执行契约明确 Phase 1 的四 Tab 导航结构以及各页面必须/可选能力。
- [x] 执行契约明确 Phase 1 设置页只包含数据迁移相关能力和必要占位，不出现半成品同步/更新入口。
- [x] 执行契约明确共享 core 的测试要求，以及每个实现阶段必须运行的 typecheck/lint/test 命令。
- [x] 执行契约明确冻结技术栈和禁止自行替换的依赖类型。
- [x] 执行契约包含硬禁止事项清单，明确哪些“最佳实践式补全”不得执行。
- [x] `docs/mobile-architecture.md` 轻量链接到 implementation contract，避免后续只读粗略方案。

## Definition of Done

- 审阅结论已沉淀到任务 PRD 或项目文档。
- 如有文档修改，运行必要的轻量检查并确认没有混入 `update-ux-notification` 的代码改动。
- 后续若进入实现阶段，再按 Trellis Phase 2 加载对应 spec 并执行质量检查。

## Out of Scope

- 本任务不实现 React Native/Expo 代码。
- 本任务不重构现有 Electron 目录。
- 本任务不处理当前 `update-ux-notification` 任务中的 `src/renderer/App.tsx` 改动。
- 本任务不决定局域网同步的最终协议细节，除非用户要求继续深入。
- 第一阶段实现范围不包含局域网同步、APK 自更新、复杂统计图表或完整预测页面。

## Decision (ADR-lite)

**Context**: 单一粗略架构文档不足以约束弱 LLM 实现；但把所有细节都塞回架构文档，会混淆业务决策、工程契约和阶段计划。

**Decision**: 保留 `docs/mobile-architecture.md` 作为架构决策和产品约束文档，新增 `docs/mobile-implementation-contract.md` 作为后续 LLM 必须遵守的执行契约。

**Consequences**: 架构文档可以保持简洁；执行契约必须具体到目录结构、共享包边界、数据 schema、禁止事项、验收标准和质量命令。后续实现任务应优先读取 implementation contract。

## MVP Scope Decision

**Decision**: 第一阶段采用独立 Android MVP。

**Included**: Expo/React Native 脚手架、Android 运行目标、SQLite schema、记录创建、历史列表、删除确认、设置入口、JSON 导入导出、与桌面数据格式兼容。

**Deferred**: 桌面/移动局域网同步、APK 自更新、统计图表完整实现、预测页面完整实现、iOS 构建保障。

## Shared Logic Decision

**Decision**: 第一阶段采用混合共享策略。

**Shared in Phase 1**: record 类型、JSON import/export 格式、record validation、SQLite schema 常量、基础数据转换规则、导入去重规则。

**Not required in Phase 1**: 全量统计图表逻辑、预测算法、AI 远程调用、计时器 hook、桌面端 UI 重构。

**Consequence**: 先保护最容易跨端分叉的数据契约，同时避免为了移动端 MVP 做过大的桌面重构。

## Monorepo Decision

**Decision**: 采用分阶段 monorepo 策略。

**Target structure**:

- `apps/desktop` for Electron desktop app after a future migration.
- `apps/mobile` for the Expo React Native app.
- `packages/shared` for cross-platform type definitions.
- `packages/core` for cross-platform pure business logic and data contracts.

**Phase 1 transition rule**: Existing Electron code may remain in root `src/**`; new mobile app code must be placed under `apps/mobile`; new cross-platform contracts or pure logic must be placed under `packages/shared` or `packages/core`; mobile code must not be added under root `src/**`.

**Consequence**: Mobile work gets a clean home without forcing an immediate desktop directory migration.

## Data Contract Decision

**Decision**: 桌面端现有数据格式是移动端 Phase 1 的权威数据契约。

**Required compatibility**:

- Export format: `{ version: 1, records: [...] }`.
- Legacy import compatibility: old top-level array format remains accepted.
- Record fields: `Id`, `StartTime`, `EndTime`, `Duration`, `Notes`.
- Time format: ISO string for storage/export boundaries.
- Duration unit: minutes.
- Deduplication: `Id` is the primary deduplication key.

**Consequence**: 移动端不能自行发明字段名、时间格式或去重规则；如需升级格式，必须通过显式 versioned migration。

## Mobile UX Scope Decision

**Decision**: Phase 1 保留四 Tab 导航：记录、统计、预测、历史；设置从右上角入口进入。

**Required in Phase 1**:

- Record tab: full-screen mobile-first recording experience with prominent timer and primary actions.
- History tab: list records and delete with explicit confirmation dialog; no swipe-to-delete.
- Stats tab: lightweight page only, such as basic 2x2 metric cards or stable placeholder.
- Prediction tab: lightweight page only, such as local simple message or stable placeholder.

**Deferred**: Full chart implementation, heatmap, 24h distribution chart, complete prediction model UI.

## Settings Scope Decision

**Decision**: Phase 1 使用最小设置页。

**Required in Phase 1**:

- JSON import.
- JSON export.
- About/version information.
- AI configuration entry placeholder only.

**Deferred**: Full AI configuration form, APK update settings, LAN sync entry, update source selection, secure storage alternatives.

**Consequence**: 设置页服务第一阶段最重要的数据迁移需求，同时避免暴露尚未实现的半成品入口。

## Quality Gate Decision

**Decision**: Phase 1 强制 core 测试。

**Required tests**:

- JSON export produces the canonical `{ version: 1, records: [...] }` format.
- JSON import accepts canonical v1 format.
- JSON import accepts legacy top-level array format.
- Record validation rejects malformed records.
- Duplicate `Id` import is skipped.
- Schema constants preserve expected table and field names.

**Required checks**:

- Type-check the changed packages/apps.
- Lint the changed packages/apps.
- Run `packages/core` unit tests.

**Not required in Phase 1**: Mobile UI automation tests.

**Consequence**: 最关键的数据迁移和跨端契约有可执行保护，移动 UI 验收先保持轻量。

## Technology Stack Decision

**Decision**: Phase 1 冻结移动端技术栈。

**Required stack**:

- Expo + React Native + TypeScript.
- react-native-paper for UI.
- expo-router for file-system routing.
- expo-sqlite for local persistence.
- victory-native remains the planned chart library, but full chart work is deferred from Phase 1.

**Forbidden without contract change**:

- Replacing Expo with bare React Native or another mobile framework.
- Replacing react-native-paper with NativeWind, Tamagui, custom-only UI, or another component system.
- Replacing expo-router with hand-written routing or a different navigation architecture.
- Replacing expo-sqlite with Realm, WatermelonDB, AsyncStorage-only persistence, or another database.

**Consequence**: 后续 LLM 实现必须先满足约束，再谈优化；库替换需要显式修改契约，而不是在实现中顺手发生。

## Hard Prohibitions Decision

**Decision**: Implementation contract 必须包含硬禁止事项清单。

**Forbidden in Phase 1**:

- Configure iOS build workflow or claim iOS support.
- Introduce `expo-secure-store`, Keychain, Keystore, or another secure-storage dependency.
- Implement swipe-to-delete for history records.
- Implement LAN sync.
- Implement APK self-update.
- Replace the frozen mobile stack.
- Put mobile app code under root `src/**`.
- Bypass `packages/core` for JSON import/export or record validation.
- Add unfinished Settings entries such as sync, update source, or update download.

**Consequence**: 对弱 LLM 使用“禁止做什么”的硬边界，降低自动套用通用最佳实践导致偏离业务决策的概率。

## Technical Notes

- Existing mobile draft: `docs/mobile-architecture.md`
- Existing legacy migration guide: `docs/migration-guide.md`
- Current shared package: `packages/shared`
- Current import/export logic: `src/renderer/services/DatabaseService.ts`
- Current SQLite service: `src/main/database.ts`
- Current prediction logic: `src/renderer/services/PredictionService.ts`
- Current AI analysis logic: `src/main/ai-service.ts`
- Research reference: `research/mobile-platform-docs.md`
- Spec update: added `.trellis/spec/frontend/mobile-implementation.md` and linked it from `.trellis/spec/frontend/index.md`, so future mobile implementation tasks are routed to `docs/mobile-implementation-contract.md`.
- Quality check: `git diff --check` on changed docs/spec/task files passed; contract/link/key-section `rg` checks passed. Full app build was not run because this task changed documentation/spec only and the worktree already contains unrelated `src/renderer/App.tsx` changes from another active task.
