import type { IAiAnalysisData } from "./ai.types";

const WEEKDAY_NAMES: readonly string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function BuildPrompt(data: IAiAnalysisData): string {
    const hourlyPeaks = [...data.HourlyDistribution]
        .sort((a, b) => b.Count - a.Count)
        .slice(0, 3);

    return `你是一个健康数据分析助手。请基于以下统计数据，给出简洁的分析和建议（中文回答，尽量简明）：

统计概览：
- 总次数：${data.TotalCount}
- 平均时长：${data.AverageDuration.toFixed(1)} 分钟
- 本周频率：${data.FrequencyPerWeek} 次
- 本月频率：${data.FrequencyPerMonth} 次

高峰时段（前 3）：
${hourlyPeaks.map((item) => `- ${item.Hour}:00：${item.Count} 次`).join("\n")}

星期分布：
${data.WeekdayDistribution.map((item) => `- ${WEEKDAY_NAMES[item.Weekday] ?? "?"}：${item.Count} 次`).join("\n")}

时长统计：
- 最短：${data.DurationStats.Min.toFixed(1)} 分钟
- 最长：${data.DurationStats.Max.toFixed(1)} 分钟
- 平均：${data.DurationStats.Avg.toFixed(1)} 分钟
- 中位数：${data.DurationStats.Median.toFixed(1)} 分钟

月度趋势（最近 6 个月）：
${data.MonthlyTrend.slice(-6).map((item) => `- ${item.Month}：${item.Count} 次`).join("\n")}

请分析：1. 行为模式特点 2. 当前频率是否偏高 3. 简短建议`;
}
