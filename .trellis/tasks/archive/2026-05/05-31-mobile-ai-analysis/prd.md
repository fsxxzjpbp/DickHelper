# 安卓端 LLM 自慰评价功能

## Goal

将桌面端已有的 AI 数据分析功能移植到安卓端，同时将核心逻辑提取到 `packages/core` 共享层，使桌面端和移动端共用同一套分析代码。

## What I already know

* 桌面端 AI 分析位于 `src/main/ai-service.ts`，包含两种模式：
  - `AnalyzeLocally`：纯规则分析（高峰时段、星期分布、频率评估、时长统计、月度趋势）
  - `AnalyzeWithApi`：调用 OpenAI 兼容 API，发送结构化 prompt
* 数据接口 `IAiAnalysisData` 包含：总次数、平均时长、周/月频率、小时分布、星期分布、月度趋势、时长统计
* 配置接口 `IAiConfig` 包含：Provider（openai/local）、ApiEndpoint、ApiKey、Model
* 桌面端的数据聚合逻辑在 `src/main/index.ts` 的 `BuildAiAnalysisData()` 中，从 SQLite 查询统计数据
* 移动端已有占位页面 `apps/mobile/app/settings/ai.tsx`，仅显示"第一阶段占位"
* 移动端统计页 `apps/mobile/app/(tabs)/stats.tsx` 已有基本统计卡片，无 AI 分析
* 移动端通过 `MobileDatabaseService` 提供 `GetRecords()`、`GetSetting()`、`SetSetting()`
* `packages/core` 已有 `prediction/` 模块作为共享纯逻辑的先例
* `IRecord` 接口在 `packages/shared` 中定义，包含 Id、StartTime、EndTime、Duration、Notes

## Requirements

### 核心需求

1. **提取共享 AI 模块到 `packages/core`**：
   - 将 `ai-service.ts` 中的 `IAiAnalysisData`、`IAiConfig`、`BuildPrompt`、`AnalyzeLocally`、`AnalyzeWithApi`、`Analyze` 迁移到 `packages/core/src/ai/`
   - 新增 `BuildAnalysisData(records: IRecord[]): IAiAnalysisData` 函数，从原始记录聚合统计数据（替代桌面端 `BuildAiAnalysisData()` 依赖 SQLite 查询的部分）
   - 通过 `packages/core/src/index.ts` 导出

2. **重构桌面端使用共享模块**：
   - `src/main/index.ts` 中的 `BuildAiAnalysisData()` 改为调用 `BuildAnalysisData(records)`
   - `ai:analyze` handler 改为使用共享的 `Analyze()`
   - 删除 `src/main/ai-service.ts` 中已迁移的代码

3. **实现移动端 AI 设置页面**：
   - 替换 `apps/mobile/app/settings/ai.tsx` 占位页面
   - Provider 选择：SegmentedButtons（"本地分析" / "OpenAI API"）
   - API 地址、API Key、模型名称输入框
   - 通过 `MobileDatabaseService.GetSetting/SetSetting` 持久化
   - Settings key 与桌面端一致：`ai_provider`、`ai_api_endpoint`、`ai_api_key`、`ai_model`

4. **移动端统计页集成 AI 分析**：
   - 在 `apps/mobile/app/(tabs)/stats.tsx` 统计卡片下方添加 AI 分析区块
   - "开始分析" / "重新分析" 按钮
   - Loading 使用 ActivityIndicator，错误用红色提示
   - 结果以 Surface 展示

5. **测试**：
   - `packages/core/test/ai.test.ts`：`BuildAnalysisData` 边界测试、`AnalyzeLocally` 输出验证、`BuildPrompt` 格式验证

## Acceptance Criteria

- [ ] `packages/core` 导出 `BuildAnalysisData`、`AnalyzeLocally`、`AnalyzeWithApi`、`Analyze`、`IAiAnalysisData`、`IAiConfig`
- [ ] 桌面端 AI 分析功能与迁移前行为一致
- [ ] 移动端 AI 设置页面可配置 Provider、API 地址、Key、Model 并持久化
- [ ] 移动端统计页点击"开始分析"可获取分析结果
- [ ] Provider 为 "local" 时不依赖网络，直接返回规则分析
- [ ] Provider 为 "openai" 时正确调用 API 并展示结果或错误
- [ ] `packages/core` 类型检查通过
- [ ] 测试通过

## Out of Scope

- 移动端图表/可视化（Recharts 等）
- 移动端在线排行榜
- 移动端回收站功能
- AI 分析结果的缓存或历史记录
- 非 OpenAI 的其他 LLM provider 适配
