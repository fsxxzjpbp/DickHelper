import { useEffect, useMemo, useState } from "react";
import { Badge, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertCircle, IconBolt, IconClock, IconFlame, IconMoon } from "@tabler/icons-react";
import { useRecords } from "../hooks/useRecords";
import { PredictionService } from "../services/PredictionService";

type PredictionAnalysis = ReturnType<typeof PredictionService.Analyze>;

type StatusConfig = {
    readonly color: string;
    readonly label: string;
    readonly icon: typeof IconClock;
};

function FormatDays(days: number | null): string {
    if (days === null) {
        return "--";
    }

    if (days <= 0) {
        return "今天";
    }

    if (days < 1) {
        return `${Math.round(days * 24)} 小时`;
    }

    return `${days.toFixed(1)} 天`;
}

function FormatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function FormatDateRange(start: Date | null, end: Date | null): string {
    if (start === null || end === null) {
        return "--";
    }

    return `${FormatDateTime(start)} - ${FormatDateTime(end)}`;
}

function FormatCountdown(target: Date | null): string {
    if (target === null) {
        return "--";
    }

    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) {
        return "已到";
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days} 天 ${hours % 24} 小时`;
    }

    return `${hours} 小时 ${minutes} 分钟`;
}

function GetTimeBucketLabel(date: Date | null): string {
    if (date === null) {
        return "--";
    }

    const hour = date.getHours();

    if (hour < 6) {
        return "00:00-06:00";
    }

    if (hour < 12) {
        return "06:00-12:00";
    }

    if (hour < 18) {
        return "12:00-18:00";
    }

    return "18:00-24:00";
}

function GetStatusConfig(status: PredictionAnalysis["Status"]): StatusConfig {
    switch (status) {
        case "window_predicted":
            return { color: "green", label: "精确窗口", icon: IconBolt };
        case "coarse_range_only":
            return { color: "yellow", label: "粗略范围", icon: IconMoon };
        case "unstable_pattern":
            return { color: "red", label: "模式不稳", icon: IconFlame };
        case "insufficient_samples":
        default:
            return { color: "gray", label: "样本不足", icon: IconAlertCircle };
    }
}

function GetStatusSummary(prediction: PredictionAnalysis): string {
    switch (prediction.Status) {
        case "window_predicted":
            return `已选 ${prediction.ChosenConfidenceLevel === null ? "--" : `${Math.round(prediction.ChosenConfidenceLevel * 100)}%`} 置信窗口，半宽约 ${FormatDays(prediction.HalfWidthDays)}。`;
        case "coarse_range_only":
            return "中心点能算出来，但窗口过宽，只能先保留粗范围。";
        case "unstable_pattern":
            return "近期波动较大，暂时只保留中心估计。";
        case "insufficient_samples":
        default:
            return "至少还需要 2 个相邻间隔，继续记录后再预测。";
    }
}

function GetRangeText(prediction: PredictionAnalysis): string {
    switch (prediction.Status) {
        case "window_predicted":
            return `精确窗口：${FormatDateRange(prediction.PredictedWindowStart, prediction.PredictedWindowEnd)}。`;
        case "coarse_range_only":
            return `粗略范围：${FormatDateRange(prediction.CoarseRangeStart, prediction.CoarseRangeEnd)}。`;
        case "unstable_pattern":
            return `中心估计：${prediction.PredictedCenterAt !== null ? FormatDateTime(prediction.PredictedCenterAt) : "--"}。`;
        case "insufficient_samples":
        default:
            return "样本不足，继续记录后再预测。";
    }
}

function GetBucketText(prediction: PredictionAnalysis): { readonly label: string; readonly value: string } {
    if (prediction.Status === "insufficient_samples") {
        return {
            label: "最近时段",
            value: GetTimeBucketLabel(prediction.LastRecordAt),
        };
    }

    return {
        label: "中心时段",
        value: GetTimeBucketLabel(prediction.PredictedCenterAt),
    };
}

export const Prediction = () => {
    const { records, loading } = useRecords();
    const [countdown, setCountdown] = useState<string>("--");

    const prediction = useMemo(() => PredictionService.Analyze(records), [records]);
    const statusConfig = GetStatusConfig(prediction.Status);
    const StatusIcon = statusConfig.icon;
    const bucketText = GetBucketText(prediction);
    const countdownTargetTime = prediction.PredictedCenterAt?.getTime() ?? 0;

    useEffect(() => {
        const target = countdownTargetTime === 0 ? null : new Date(countdownTargetTime);
        setCountdown(FormatCountdown(target));

        if (target === null) {
            return;
        }

        const timer = window.setInterval(() => {
            setCountdown(FormatCountdown(new Date(countdownTargetTime)));
        }, 60_000);

        return () => {
            window.clearInterval(timer);
        };
    }, [countdownTargetTime]);

    if (loading) {
        return (
            <Stack gap="md" maw={860} mx="auto">
                <Stack gap={4}>
                    <Title order={3}>精力预测</Title>
                    <Text size="sm" c="dimmed">
                        正在加载记录…
                    </Text>
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack gap="lg" maw={860} mx="auto">
            <Stack gap={4}>
                <Title order={3}>精力预测</Title>
                <Text size="sm" c="dimmed">
                    基于最近的相邻间隔给出一个窗口判断。
                </Text>
            </Stack>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                    <Stack gap="sm">
                        <Group gap="sm" align="center">
                            <ThemeIcon size={44} radius="xl" variant="light" color={statusConfig.color}>
                                <StatusIcon size={22} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" c="dimmed">
                                    当前判断
                                </Text>
                                <Text size="lg" fw={700} c={statusConfig.color}>
                                    {statusConfig.label}
                                </Text>
                            </Stack>
                        </Group>

                        <Group gap="lg" align="flex-start" wrap="wrap">
                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">
                                    距上次
                                </Text>
                                <Text fw={600}>{FormatDays(prediction.DaysSinceLast)}</Text>
                            </Stack>

                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">
                                    中心间隔
                                </Text>
                                <Text fw={600}>{FormatDays(prediction.CenterIntervalDays)}</Text>
                            </Stack>

                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">
                                    倒计时
                                </Text>
                                <Text fw={600}>{countdown}</Text>
                            </Stack>
                        </Group>
                    </Stack>

                    <Badge variant="light" color={statusConfig.color} size="lg">
                        {statusConfig.label}
                    </Badge>
                </Group>

                <Text size="sm" c="dimmed" mt="md">
                    {GetStatusSummary(prediction)}
                </Text>

                <Text size="sm" c="dimmed" mt={6}>
                    共 {prediction.SampleCount} 条记录，{prediction.IntervalSampleCount} 个相邻间隔。
                </Text>
            </Paper>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group gap="sm" mb="sm">
                    <IconClock size={18} />
                    <Title order={4}>窗口与时段</Title>
                </Group>
                <Text size="sm" c="dimmed">
                    {GetRangeText(prediction)}
                </Text>
                <Text size="sm" c="dimmed" mt={6}>
                    {bucketText.label}：{bucketText.value}
                </Text>
            </Paper>
        </Stack>
    );
};
