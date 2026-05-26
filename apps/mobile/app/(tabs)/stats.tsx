import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import type { IRecord } from "@dickhelper/shared";
import { useRecords } from "../../src/hooks/useRecords";
import { FormatDurationMinutes, FormatDateTime } from "../../src/utils/formatters";

function CalculateMetrics(records: IRecord[]): {
    readonly total: number;
    readonly averageDuration: number;
    readonly recentWeek: number;
    readonly recentMonth: number;
    readonly latestEndTime: Date | null;
} {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalDuration = 0;
    let recentWeek = 0;
    let recentMonth = 0;
    let latestEndTime: Date | null = null;

    for (const record of records) {
        totalDuration += record.Duration;
        if (record.EndTime >= weekStart) {
            recentWeek++;
        }
        if (record.EndTime >= monthStart) {
            recentMonth++;
        }
        if (latestEndTime === null || record.EndTime > latestEndTime) {
            latestEndTime = record.EndTime;
        }
    }

    return {
        total: records.length,
        averageDuration: records.length > 0 ? totalDuration / records.length : 0,
        recentWeek,
        recentMonth,
        latestEndTime,
    };
}

export default function StatsScreen() {
    const theme = useTheme();
    const { records, loading, error } = useRecords();
    const metrics = useMemo(() => CalculateMetrics(records), [records]);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    统计
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    仅展示轻量指标，不包含图表或热力图。
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
                    <View style={styles.grid}>
                        <MetricTile
                            title="总次数"
                            value={String(metrics.total)}
                            accentColor={theme.colors.primary}
                        />
                        <MetricTile
                            title="平均时长"
                            value={FormatDurationMinutes(metrics.averageDuration)}
                            accentColor={theme.colors.secondary}
                        />
                        <MetricTile
                            title="近 7 天"
                            value={String(metrics.recentWeek)}
                            accentColor={theme.colors.tertiary}
                        />
                        <MetricTile
                            title="近 30 天"
                            value={String(metrics.recentMonth)}
                            accentColor={theme.colors.error}
                        />
                    </View>

                    <Surface style={styles.noteSurface} elevation={0}>
                        <Text variant="labelMedium" style={styles.noteTitle}>
                            最近结束时间
                        </Text>
                        <Text variant="bodyMedium" style={styles.noteValue}>
                            {metrics.latestEndTime !== null ? FormatDateTime(metrics.latestEndTime) : "暂无记录"}
                        </Text>
                    </Surface>
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
            <Text variant="headlineSmall" style={[styles.metricValue, { color: props.accentColor }]}>
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
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 12,
    },
    metricTile: {
        width: "48%",
        minHeight: 120,
        borderRadius: 12,
        padding: 16,
        backgroundColor: "#ffffff",
        justifyContent: "space-between",
    },
    metricTitle: {
        color: "#64748b",
    },
    metricValue: {
        fontWeight: "700",
        marginTop: 8,
    },
    noteSurface: {
        borderRadius: 12,
        padding: 16,
        backgroundColor: "#ffffff",
        gap: 8,
    },
    noteTitle: {
        color: "#475569",
    },
    noteValue: {
        color: "#0f172a",
    },
});
