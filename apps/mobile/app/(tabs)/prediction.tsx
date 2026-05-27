import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import type { IRecord } from "@dickhelper/shared";
import { useRecords } from "../../src/hooks/useRecords";
import { FormatDateTime, FormatDurationMinutes, FormatRelativeDays } from "../../src/utils/formatters";

function CalculatePrediction(records: IRecord[]): {
    readonly lastRecord: IRecord | null;
    readonly averageGapMinutes: number;
    readonly nextEstimate: Date | null;
    readonly daysSinceLast: number | null;
} {
    if (records.length === 0) {
        return {
            lastRecord: null,
            averageGapMinutes: 0,
            nextEstimate: null,
            daysSinceLast: null,
        };
    }

    const ordered = [...records].sort((left, right) => left.EndTime.getTime() - right.EndTime.getTime());
    const lastRecord = ordered[ordered.length - 1] ?? null;

    if (lastRecord === null) {
        return {
            lastRecord: null,
            averageGapMinutes: 0,
            nextEstimate: null,
            daysSinceLast: null,
        };
    }

    let totalGapMinutes = 0;
    let gapCount = 0;

    for (let index = 1; index < ordered.length; index++) {
        const current = ordered[index];
        const previous = ordered[index - 1];
        if (current === undefined || previous === undefined) {
            continue;
        }

        totalGapMinutes += (current.EndTime.getTime() - previous.EndTime.getTime()) / 60_000;
        gapCount++;
    }

    const averageGapMinutes = gapCount > 0 ? totalGapMinutes / gapCount : 0;
    const nextEstimate =
        gapCount > 0
            ? new Date(lastRecord.EndTime.getTime() + averageGapMinutes * 60_000)
            : null;
    const daysSinceLast = (Date.now() - lastRecord.EndTime.getTime()) / 86_400_000;

    return {
        lastRecord,
        averageGapMinutes,
        nextEstimate,
        daysSinceLast,
    };
}

export default function PredictionScreen() {
    const theme = useTheme();
    const { records, loading, error } = useRecords();
    const prediction = useMemo(() => CalculatePrediction(records), [records]);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    预测
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    根据你的记录推测下一次
                </Text>
            </View>

            {loading ? (
                <Text variant="bodyMedium" style={styles.stateText}>
                    正在加载记录...
                </Text>
            ) : error !== null ? (
                <Text variant="bodyMedium" style={styles.stateText}>
                    {error}
                </Text>
            ) : (
                <>
                    <Surface style={styles.heroSurface} elevation={1}>
                        <Text variant="labelLarge" style={styles.heroLabel}>
                            当前判断
                        </Text>
                        <Text variant="headlineSmall" style={[styles.heroValue, { color: theme.colors.primary }]}>
                            {prediction.lastRecord === null || prediction.averageGapMinutes === 0
                                ? "样本不足"
                                : "趋势稳定"}
                        </Text>
                        <Text variant="bodyMedium" style={styles.heroText}>
                            {prediction.nextEstimate === null
                                ? "继续记录后，这里会给出一个简单的本地参考。"
                                : `按当前平均间隔，下一次大致会落在 ${FormatDateTime(prediction.nextEstimate)} 左右。`}
                        </Text>
                    </Surface>

                    <View style={styles.grid}>
                        <MetricTile
                            title="平均间隔"
                            value={prediction.averageGapMinutes > 0 ? FormatDurationMinutes(prediction.averageGapMinutes) : "--"}
                            accentColor={theme.colors.secondary}
                        />
                        <MetricTile
                            title="距离上次"
                            value={prediction.daysSinceLast !== null ? FormatRelativeDays(prediction.daysSinceLast) : "--"}
                            accentColor={theme.colors.tertiary}
                        />
                        <MetricTile
                            title="最近一次"
                            value={prediction.lastRecord !== null ? FormatDateTime(prediction.lastRecord.EndTime) : "暂无"}
                            accentColor={theme.colors.error}
                        />
                        <MetricTile
                            title="记录数"
                            value={String(records.length)}
                            accentColor={theme.colors.primary}
                        />
                    </View>
                </>
            )}
        </ScrollView>
    );
}

function MetricTile(props: {
    readonly title: string;
    readonly value: string;
    readonly accentColor: string;
}) {
    return (
        <Surface style={styles.metricTile} elevation={1}>
            <Text variant="labelLarge" style={styles.metricTitle}>
                {props.title}
            </Text>
            <Text variant="bodyLarge" style={[styles.metricValue, { color: props.accentColor }]}>
                {props.value}
            </Text>
        </Surface>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        padding: 16,
        gap: 16,
    },
    header: {
        gap: 8,
    },
    title: {
        color: "#0f766e",
        fontWeight: "700",
    },
    subtitle: {
        color: "#475569",
    },
    stateText: {
        color: "#64748b",
    },
    heroSurface: {
        borderRadius: 12,
        padding: 20,
        backgroundColor: "#ffffff",
        gap: 10,
    },
    heroLabel: {
        color: "#64748b",
    },
    heroValue: {
        fontWeight: "700",
    },
    heroText: {
        color: "#334155",
        lineHeight: 22,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 12,
    },
    metricTile: {
        width: "48%",
        minHeight: 112,
        borderRadius: 12,
        padding: 16,
        backgroundColor: "#ffffff",
        justifyContent: "space-between",
    },
    metricTitle: {
        color: "#64748b",
    },
    metricValue: {
        marginTop: 8,
    },
});
