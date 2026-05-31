# 分析自慰记录预测实现与算法改进方向

## Goal

梳理当前 MonoRepo 中“预测”功能的真实实现位置、桌面端与移动端的复用边界，以及现有算法的行为差异与明显缺陷，为后续是否重构到共享核心库、以及如何改进预测算法提供明确结论。

## What I already know

* 项目是 MonoRepo，包含 Expo 移动端、Electron 桌面端，以及 `packages/shared`、`packages/core` 共享包。
* 文档明确把“预测算法”归类为可复用的纯 TypeScript 逻辑，理论上应适合沉到共享层。
* 当前桌面端预测实现位于 `src/renderer/services/PredictionService.ts`，由 `src/renderer/views/Prediction.tsx` 消费。
* 当前移动端预测实现位于 `apps/mobile/app/(tabs)/prediction.tsx`，算法直接写在页面内的 `CalculatePrediction()` 中。
* 两端都通过各自的 `useRecords()` 读取未软删除记录，并在数据服务层把时间字段统一转换为 `Date`，因此预测输入口径基本一致。
* `packages/core` 当前承载的是 JSON import/export、record validation、schema 常量等纯逻辑，还没有预测算法。
* 移动端实现契约只要求“预测页”是轻量实现，不要求完整预测模型 UI 或 AI 分析。

## Assumptions (temporary)

* 当前任务范围已经确认收敛为 A：先完成实现审计与改进建议，不直接修改业务代码。
* 如果后续决定改造，预测算法应优先抽成跨端纯函数，而不是继续分别维护 Electron/Expo 两套逻辑。

## Open Questions

* 后续进入实现时，优先级应是“先统一到 `packages/core`”还是“先重做算法，再顺手统一复用”？

## Requirements (evolving)

* 明确当前预测实现涉及的入口、数据流和复用边界。
* 比较桌面端与移动端算法差异，指出重复实现和行为不一致处。
* 识别当前算法的主要问题，包括样本选择、平均方式、时间估计、输出稳定性等。
* 给出后续改进方向，至少覆盖“共享化重构”和“算法改进”两个维度。
* 记录本轮结论，供后续实现任务直接复用。
* 统一算法需要支持小样本场景，允许引入弱先验，并随用户样本增加逐步降低先验权重。
* 预测输出优先使用区间而不是单一时点，并对区间宽度设置产品可用性约束。

## Acceptance Criteria (evolving)

* [x] 能说明当前预测逻辑分别落在哪些文件、哪些层。
* [x] 能说明桌面端和移动端预测逻辑是否共用，以及没有共用的具体表现。
* [x] 能指出当前算法的主要行为和潜在问题。
* [x] 能给出后续改造的可执行方向。

## Definition of Done (team quality bar)

* 需求和范围明确
* 关键实现位置已核实
* 后续若进入实现，再补充测试、lint、typecheck 和文档要求

## Out of Scope (explicit)

* 本阶段不直接实现 AI 远程分析。
* 本阶段不讨论 UI 美化，除非它影响算法呈现或复用边界判断。
* 本阶段不处理与预测无关的同步、更新或历史记录功能。
* 本阶段不直接修改 `packages/core`、桌面端或移动端预测实现。

## Technical Notes

* 已检查文档：
  * `docs/mobile-architecture.md`
  * `docs/mobile-implementation-contract.md`
* 已检查实现：
  * `src/renderer/services/PredictionService.ts`
  * `src/renderer/views/Prediction.tsx`
  * `src/renderer/hooks/useRecords.ts`
  * `src/renderer/services/DatabaseService.ts`
  * `apps/mobile/app/(tabs)/prediction.tsx`
  * `apps/mobile/src/hooks/useRecords.ts`
  * `apps/mobile/src/services/MobileDatabaseService.ts`
  * `packages/shared/src/IRecord.ts`
* 当前初步判断：
  * 桌面端和移动端预测逻辑尚未沉到 `packages/core`。
  * 移动端是轻量版算法；桌面端有更多派生指标（等级、活跃时段、倒计时）。
* 当前算法差异：
  * 桌面端使用最近最多 30 条记录计算平均间隔，单位为“天”，并额外计算活跃时段、预测等级和未来倒计时。
  * 移动端使用全量历史记录计算平均间隔，单位为“分钟”，只给出最近一次、平均间隔和下一次估计。
  * 桌面端会把预测时间强行推到未来，并把小时改写为历史最高频小时；移动端直接使用 `last + averageGap`，可能落在过去。
* 已识别的明显风险：
  * 两端同功能两套实现，后续很容易继续分叉。
  * 简单平均值对长时间断档、短期密集记录比较敏感，容易被异常样本拉偏。
  * 桌面端“最高频小时”使用全量历史，不区分近期趋势，也没有处理并列峰值的业务语义。
  * 预测模型目前只基于单一平均间隔，没有置信度、波动范围或样本质量判断。
  * 当前没有找到预测相关测试，后续改算法前需要先补上纯函数级测试样例。
* 用户当前偏好：
  * 可接受弱先验，初始可假设“平均约 3 天一次”。
  * 随样本增加，先验权重应逐步下降。
  * 预测应优先展示区间。
  * 可通过降低置信度来缩窄区间，但目标半区间不应超过 1.5 天。
  * 最低允许展示的置信度下限为 85%。
  * 算法不应过度复杂；若存在必要复杂度，应尽量局部封装在独立 prediction 模块中，不向 UI 和其他组件扩散。
  * 当前倾向将弱先验强度设为 `k=1`，让真实样本更快接管预测中心。
  * 间隔窗口使用最近 `N=10` 个相邻间隔；样本不足时使用全部可用间隔。这里的 `N` 指相邻间隔数，不是记录条数。
  * 时间展示不使用“早上/晚上”等自然语言，而使用固定 4 段制时间桶，例如 `00:00-06:00 / 06:00-12:00 / 12:00-18:00 / 18:00-24:00`。
  * 当真实间隔样本数 `< 2` 时，不展示预测窗口，直接提示“样本不足，继续记录后再预测”。
  * 时间桶只用于展示，不参与预测模型本身。
