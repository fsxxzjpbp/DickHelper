# 预测统一算法实现规格

## 目标

把当前桌面端和移动端各自维护的预测逻辑，统一为 `packages/core` 中的纯函数模块。该模块负责：

* 接收记录列表
* 输出统一预测结果
* 封装小样本、弱先验、置信区间、降级策略

UI 层只负责展示，不再自行实现预测数学逻辑。

---

## 模块边界

### 放在 `packages/core`

应该进入共享核心层的内容：

* 相邻间隔计算
* 最近窗口裁剪
* 弱先验收缩
* 稳健波动估计
* 置信区间候选选择
* 预测状态判定
* 结果对象定义

### 不放在 `packages/core`

不进入核心算法的内容：

* React / React Native / Electron 组件代码
* UI 文案
* 颜色、图标、等级标签
* 本地化格式化
* “早上/晚上”这类自然语言时段描述

### 展示层处理

展示层只消费算法结果，并额外做：

* 时间格式化
* `00:00-06:00 / 06:00-12:00 / 12:00-18:00 / 18:00-24:00` 时间桶映射
* 不同端的文案差异

---

## 目录建议

```text
packages/core/src/prediction/
  analyzePrediction.ts
  prediction.types.ts
  intervalMath.ts
  confidenceWindow.ts
  index.ts
packages/core/test/
  prediction.test.ts
```

`packages/core/src/index.ts` 统一 re-export。

---

## 输入输出设计

### 输入

主函数直接接收现有共享类型 `IRecord[]`。

建议签名：

```ts
export function AnalyzePrediction(records: readonly IRecord[], now?: Date): IPredictionAnalysis
```

说明：

* `records` 使用现有共享类型，避免新增边界模型
* `now` 允许测试时注入固定时间，避免测试依赖真实当前时间

---

## 核心常量

第一版把参数写成模块内常量，不先开放配置入口：

```ts
const PRIOR_INTERVAL_DAYS = 3;
const PRIOR_STRENGTH = 1;
const RECENT_INTERVAL_LIMIT = 10;
const MIN_INTERVAL_SAMPLES = 2;
const MAX_HALF_WINDOW_DAYS = 1.5;
const CONFIDENCE_LEVELS = [0.95, 0.9, 0.85] as const;
```

理由：

* 当前参数已通过讨论收敛
* 先不做配置化，避免接口膨胀
* 后续若真需要调参，再演进成可选 options

---

## 结果类型

建议核心结果对象如下：

```ts
export type PredictionStatus =
    | "insufficient_samples"
    | "window_predicted"
    | "coarse_range_only"
    | "unstable_pattern";

export interface IPredictionAnalysis {
    readonly Status: PredictionStatus;
    readonly SampleCount: number;          // 原始记录数
    readonly IntervalSampleCount: number;  // 可用相邻间隔数
    readonly RecentIntervalCount: number;  // 实际参与计算的近期窗口大小
    readonly DaysSinceLast: number | null;
    readonly LastRecordAt: Date | null;

    readonly PriorIntervalDays: number;
    readonly PriorStrength: number;

    readonly CenterIntervalDays: number | null;
    readonly MedianIntervalDays: number | null;
    readonly MeanIntervalDays: number | null;
    readonly DispersionDays: number | null;

    readonly ChosenConfidenceLevel: 0.95 | 0.9 | 0.85 | null;
    readonly HalfWidthDays: number | null;

    readonly PredictedCenterAt: Date | null;
    readonly PredictedWindowStart: Date | null;
    readonly PredictedWindowEnd: Date | null;

    readonly CoarseRangeStart: Date | null;
    readonly CoarseRangeEnd: Date | null;

    readonly FallbackReason:
        | "none"
        | "not_enough_intervals"
        | "window_too_wide"
        | "high_dispersion";
}
```

### 设计理由

* `Status` 明确告诉 UI 当前该走哪种展示路径
* `PredictedWindow*` 和 `CoarseRange*` 分开，避免 UI 自己猜
* 统计中间值保留在结果里，便于后续调试和 A/B 调参

---

## 状态语义

### `insufficient_samples`

条件：

* 可用相邻间隔数 `< 2`

行为：

* 不输出预测窗口
* UI 显示“样本不足，继续记录后再预测”

### `window_predicted`

条件：

* 存在某个候选置信度，使 `halfWidth <= 1.5`

行为：

* 返回 `PredictedCenterAt / PredictedWindowStart / PredictedWindowEnd`
* UI 展示精确窗口

### `coarse_range_only`

条件：

* 中心预测可算
* 但 `95% -> 90% -> 85%` 都无法压到半区间 `<= 1.5`

行为：

* 不展示精确窗口
* 返回较粗粒度范围供 UI 展示

### `unstable_pattern`

条件：

* 中心预测能算，但波动过大到连粗粒度提示都不够稳定

行为：

* 只显示“近期模式不稳定”类提示

第一版里，`coarse_range_only` 和 `unstable_pattern` 可先复用同一底层数学，只在阈值上区分。

---

## 算法步骤

### Step 1: 预处理

1. 过滤无效记录（理论上调用方已保证类型正确，但仍可防御性排序）
2. 按 `EndTime` 升序排序
3. 计算 `daysSinceLast`
4. 计算相邻间隔数组 `intervals[]`，单位天

### Step 2: 样本门槛

若 `intervals.length < 2`：

* 返回 `insufficient_samples`

### Step 3: 近期窗口

取：

```ts
recentIntervals = intervals.slice(-RECENT_INTERVAL_LIMIT)
```

注意：

* 这里的 `10` 指相邻间隔数，不是记录条数
* `10` 个间隔通常约对应 `11` 次记录

### Step 4: 中心估计

第一版使用**简单收缩均值**：

```ts
posteriorCenter =
  (PRIOR_INTERVAL_DAYS * PRIOR_STRENGTH + sum(recentIntervals)) /
  (PRIOR_STRENGTH + recentIntervals.length)
```

同时额外计算：

* `mean(recentIntervals)`
* `median(recentIntervals)`

用于调试和后续迭代。

### Step 5: 波动估计

第一版优先使用 `MAD`：

1. 计算 `median(recentIntervals)`
2. 计算各样本到中位数的绝对偏差
3. 再取这些偏差的中位数作为 `MAD`

再把 `MAD` 转成近似标准尺度：

```ts
dispersion = max(MIN_FLOOR, MAD * 1.4826)
```

`MIN_FLOOR` 需要后续实现时定一个较小常量，例如 `0.25 天`，避免窗口假窄。

### Step 6: 候选区间

对每个置信度依次尝试：

* `0.95`
* `0.90`
* `0.85`

第一版不做复杂分布拟合，直接用经验 z-score 近似：

```ts
0.95 -> 1.96
0.90 -> 1.64
0.85 -> 1.44
```

然后：

```ts
halfWidth = dispersion * z
```

选择第一个满足：

```ts
halfWidth <= MAX_HALF_WINDOW_DAYS
```

的候选。

### Step 7: 映射到时间

若有可用窗口：

```ts
predictedCenterAt = lastRecord.EndTime + posteriorCenter
predictedWindowStart = predictedCenterAt - halfWidth
predictedWindowEnd = predictedCenterAt + halfWidth
```

若无可用窗口：

* 进入 `coarse_range_only` 或 `unstable_pattern`

### Step 8: 粗粒度范围

第一版粗粒度范围建议只做天级别：

* `floor(predictedCenterAt - 1 day)`
* `ceil(predictedCenterAt + 1 day)`

不要在第一版里把粗粒度范围做得太花，避免状态膨胀。

---

## 为什么不做得更复杂

第一版明确不做这些：

* 完整贝叶斯后验采样
* 自适应窗口优化
* 小时级模式学习
* 时间桶参与模型
* 多特征打分模型

理由：

* 当前目标是先统一双端算法
* 需要先建立稳定、可测、可解释的纯函数
* 复杂模型在小样本场景下未必比稳健规则更可靠

---

## UI 消费建议

### 桌面端 / 移动端统一分支

UI 层只看 `Status`：

* `insufficient_samples` -> 样本不足提示
* `window_predicted` -> 显示精确窗口
* `coarse_range_only` -> 显示粗粒度范围
* `unstable_pattern` -> 显示模式不稳定提示

### 时间桶映射

时间桶只在 UI 格式化阶段做：

```ts
function GetTimeBucket(date: Date): "00:00-06:00" | "06:00-12:00" | "12:00-18:00" | "18:00-24:00"
```

算法不要返回“早上/下午/晚上”等自然语言标签。

---

## 测试范围

`packages/core/test/prediction.test.ts` 至少覆盖：

1. 无记录
2. 只有 1 条记录
3. 只有 2 条记录但只有 1 个间隔
4. 规则间隔（例如始终 3 天）应返回窄窗口
5. 有一个明显异常长间隔，窗口不应被普通平均严重拉爆
6. 高波动样本应降级为 `coarse_range_only` 或 `unstable_pattern`
7. 样本增长时，先验影响应明显下降
8. `now` 注入后，结果可稳定复现

---

## 第一版结论

进入实现时，我建议直接按这版做：

* `packages/core` 新增 prediction 纯函数模块
* 用 `k=1` 的 3 天弱先验
* 用最近 `10` 个相邻间隔
* 用 `MAD` 做稳健波动估计
* 依次尝试 `95% / 90% / 85%`
* 半区间阈值固定 `1.5 天`
* `n < 2` 直接不给预测

这是当前最稳妥、最容易落地、也最不容易把复杂度扩散到其他层的一版。
