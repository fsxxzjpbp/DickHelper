import { useState, useCallback, useEffect, useRef } from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Divider,
    Group,
    LoadingOverlay,
    Paper,
    SegmentedControl,
    Stack,
    Table,
    Tabs,
    Text,
    Title,
    Tooltip,
} from "@mantine/core";
import {
    IconAlertCircle,
    IconClock,
    IconCopy,
    IconHash,
    IconRefresh,
    IconTrophy,
    IconUser,
} from "@tabler/icons-react";
import type { IRankingEntry, IRankingResponse, IUserRanking } from "@dickhelper/shared";
import { getDateInUTC8, getCurrentWeekUTC8 } from "@dickhelper/core";
import type { IOnlineState } from "../hooks/useOnlineService";

interface IOnlineViewProps {
    readonly onlineState: IOnlineState;
    readonly reportStats: () => Promise<void>;
    readonly rerollNickname: () => Promise<string>;
    readonly fetchDailyRanking: (date?: string, limit?: number, offset?: number, sort?: "count" | "duration") => Promise<IRankingResponse>;
    readonly fetchWeeklyRanking: (week?: string, limit?: number, offset?: number, sort?: "count" | "duration") => Promise<IRankingResponse>;
    readonly isDirty: () => boolean;
    readonly resetDirty: () => void;
}

const RANKING_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const PAGE_SIZE = 10;

function FormatPercentileText(percentile: number, period: string): string {
    if (percentile <= 0) return `你${period}暂无数据`;
    if (percentile >= 100) return `你${period}超过了所有人`;
    return `你${period}超过了 ${percentile}% 的人`;
}

function GetPeriodLabel(period: "daily" | "weekly"): string {
    return period === "daily" ? "今天" : "本周";
}

export const OnlineView = ({ onlineState, reportStats, rerollNickname, fetchDailyRanking, fetchWeeklyRanking, isDirty, resetDirty }: IOnlineViewProps) => {
    const [rankingType, setRankingType] = useState<"count" | "duration">("count");
    const [period, setPeriod] = useState<"daily" | "weekly">("daily");
    const [rankingData, setRankingData] = useState<IRankingResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState<number>(0);
    const [rerolling, setRerolling] = useState<boolean>(false);
    const [uuidCopied, setUuidCopied] = useState<boolean>(false);

    const handleCopyUUID = useCallback(async (): Promise<void> => {
        if (onlineState.uuid === null) return;
        try {
            await navigator.clipboard.writeText(onlineState.uuid);
            setUuidCopied(true);
            setTimeout(() => setUuidCopied(false), 2000);
        } catch {
            // clipboard write may fail in some environments
        }
    }, [onlineState.uuid]);

    // Ranking cache: key = "period-rankingType-offset-dateOrWeek"
    const rankingCacheRef = useRef<Map<string, { data: IRankingResponse; timestamp: number }>>(new Map());

    const handleReroll = useCallback(async (): Promise<void> => {
        setRerolling(true);
        try {
            await rerollNickname();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        } finally {
            setRerolling(false);
        }
    }, [rerollNickname]);

    const loadRanking = useCallback(
        async (newOffset: number = 0, forceRefresh: boolean = false): Promise<void> => {
            setLoading(true);
            setError(null);

            try {
                const dateOrWeek = period === "daily" ? getDateInUTC8(new Date()) : getCurrentWeekUTC8();
                const cacheKey = `${period}-${rankingType}-${newOffset}-${dateOrWeek}`;

                // Check cache (skip if forceRefresh)
                if (!forceRefresh) {
                    const cached = rankingCacheRef.current.get(cacheKey);
                    if (cached !== undefined && Date.now() - cached.timestamp < RANKING_CACHE_TTL_MS) {
                        setRankingData(cached.data);
                        setOffset(newOffset);
                        setLoading(false);
                        return;
                    }
                }

                let data: IRankingResponse;
                if (period === "daily") {
                    data = await fetchDailyRanking(dateOrWeek, PAGE_SIZE, newOffset, rankingType);
                } else {
                    data = await fetchWeeklyRanking(dateOrWeek, PAGE_SIZE, newOffset, rankingType);
                }

                rankingCacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
                setRankingData(data);
                setOffset(newOffset);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                setError(message);
            } finally {
                setLoading(false);
            }
        },
        [period, rankingType, fetchDailyRanking, fetchWeeklyRanking]
    );

    // On mount: only report stats if dirty, then load ranking
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (isDirty()) {
                // Reset dirty BEFORE reportStats — if records change during upload,
                // the IPC listener sets dirty back to true, and next mount will retry
                resetDirty();
                reportStats()
                    .catch(() => { /* non-fatal */ })
                    .finally(() => {
                        void loadRanking(0);
                    });
            } else {
                void loadRanking(0);
            }
        } else {
            void loadRanking(0);
        }
    }, [loadRanking, reportStats, isDirty, resetDirty]);

    // Refresh button bypasses cache
    const handleRefresh = (): void => {
        void loadRanking(0, true);
    };

    const handleLoadMore = (): void => {
        void loadRanking(offset + PAGE_SIZE);
    };

    const handleLoadPrev = (): void => {
        void loadRanking(Math.max(0, offset - PAGE_SIZE));
    };

    if (!onlineState.enabled) {
        return (
            <Stack gap="lg" maw={760} mx="auto">
                <Stack gap={4}>
                    <Title order={3} c="blue">在线排行</Title>
                    <Text size="sm" c="dimmed">
                        请先在设置中启用在线功能。
                    </Text>
                </Stack>
            </Stack>
        );
    }

    const me: IUserRanking | null = rankingData?.me ?? null;
    const rankings: readonly IRankingEntry[] = rankingData?.rankings ?? [];
    const total: number = rankingData?.total ?? 0;
    const stats = rankingData?.stats ?? null;
    const hasMore: boolean = offset + PAGE_SIZE < total;
    const hasPrev: boolean = offset > 0;
    const periodLabel: string = GetPeriodLabel(period);

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">在线排行</Title>
                <Text size="sm" c="dimmed">
                    查看你的排名，与其他用户比拼。
                </Text>
            </Stack>

            {/* User Info Card */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="center">
                    <Group gap="sm">
                        <IconUser size={22} />
                        <Stack gap={2}>
                            <Text size="sm" fw={500}>
                                {onlineState.nickname ?? "未知用户"}
                            </Text>
                            {onlineState.uuid !== null && (
                                <>
                                    <Group gap={4} align="center">
                                        <Text size="xs" c="dimmed" ff="monospace">
                                            {onlineState.uuid}
                                        </Text>
                                        <Tooltip label={uuidCopied ? "已复制!" : "复制 UUID"}>
                                            <ActionIcon
                                                variant="subtle"
                                                size="xs"
                                                color={uuidCopied ? "teal" : "gray"}
                                                onClick={() => void handleCopyUUID()}
                                            >
                                                <IconCopy size={12} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                    <Text size="10" c="dimmed" fs="italic">
                                        UUID 是你的登录凭证，请勿泄露给他人
                                    </Text>
                                </>
                            )}
                            {onlineState.uuid === null && (
                                <Text size="xs" c="dimmed">UUID: N/A</Text>
                            )}
                        </Stack>
                    </Group>
                    <Group gap="sm">
                        <Button
                            variant="subtle"
                            size="xs"
                            loading={rerolling}
                            onClick={() => void handleReroll()}
                        >
                            换个昵称
                        </Button>
                        <Badge variant="light" color="green">
                            已连接
                        </Badge>
                    </Group>
                </Group>
            </Paper>

            {/* Percentile Display */}
            {me !== null && me.percentile > 0 && (
                <Paper shadow="sm" radius="md" p="lg" withBorder>
                    <Group gap="sm">
                        <IconTrophy size={24} color="var(--mantine-color-yellow-6)" />
                        <Stack gap={2}>
                            <Text size="lg" fw={600}>
                                {FormatPercentileText(me.percentile, periodLabel)}
                            </Text>
                            <Text size="sm" c="dimmed">
                                你的排名：第 {me.rank} 名 / 共 {total} 人
                            </Text>
                        </Stack>
                    </Group>
                </Paper>
            )}

            {/* Ranking Type Tabs */}
            <Tabs value={rankingType} onChange={(value) => {
                if (value === "count" || value === "duration") {
                    setRankingType(value);
                }
            }}>
                <Tabs.List>
                    <Tabs.Tab value="count" leftSection={<IconHash size={16} />}>
                        次数排行
                    </Tabs.Tab>
                    <Tabs.Tab value="duration" leftSection={<IconClock size={16} />}>
                        时长排行
                    </Tabs.Tab>
                </Tabs.List>
            </Tabs>

            {/* Period Selector */}
            <Group justify="space-between" align="center">
                <SegmentedControl
                    value={period}
                    onChange={(value) => {
                        if (value === "daily" || value === "weekly") {
                            setPeriod(value);
                        }
                    }}
                    data={[
                        { label: "日", value: "daily" },
                        { label: "周", value: "weekly" },
                    ]}
                />
                <Button
                    variant="subtle"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleRefresh}
                    loading={loading}
                >
                    刷新
                </Button>
            </Group>

            {/* Error Display */}
            {error !== null && (
                <Alert
                    color="red"
                    icon={<IconAlertCircle size={18} />}
                    title="加载失败"
                    withCloseButton
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {/* Ranking Table */}
            <Paper shadow="sm" radius="md" p="md" withBorder pos="relative">
                <LoadingOverlay visible={loading} />

                {rankings.length === 0 && !loading ? (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                        暂无排行数据
                    </Text>
                ) : (
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th style={{ width: 60 }}>排名</Table.Th>
                                <Table.Th>昵称</Table.Th>
                                <Table.Th style={{ width: 100, textAlign: "right" }}>
                                    {rankingType === "count" ? "次数" : "时长(分)"}
                                </Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rankings.map((entry) => (
                                <Table.Tr
                                    key={entry.rank}
                                    style={
                                        onlineState.uuid !== null &&
                                        entry.nickname === onlineState.nickname
                                            ? { backgroundColor: "var(--mantine-color-blue-light-hover)" }
                                            : undefined
                                    }
                                >
                                    <Table.Td>
                                        <Text
                                            size="sm"
                                            fw={entry.rank <= 3 ? 700 : 400}
                                            c={entry.rank <= 3 ? "yellow" : undefined}
                                        >
                                            #{entry.rank}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{entry.nickname}</Text>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: "right" }}>
                                        <Text size="sm" fw={500}>
                                            {rankingType === "count"
                                                ? entry.count
                                                : entry.duration.toFixed(1)}
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Paper>

            {/* Pagination */}
            {(hasPrev || hasMore) && (
                <Group justify="center" gap="sm">
                    {hasPrev && (
                        <Button variant="outline" size="sm" onClick={handleLoadPrev}>
                            上一页
                        </Button>
                    )}
                    <Text size="sm" c="dimmed">
                        {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} / {total}
                    </Text>
                    {hasMore && (
                        <Button variant="outline" size="sm" onClick={handleLoadMore}>
                            下一页
                        </Button>
                    )}
                </Group>
            )}

            {/* My Ranking Summary */}
            {me !== null && (
                <Paper shadow="sm" radius="md" p="md" withBorder>
                    <Stack gap="xs">
                        <Text size="sm" fw={600}>我的{periodLabel}数据</Text>
                        <Divider />
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">排名</Text>
                            <Text size="sm" fw={500}>第 {me.rank} 名</Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">次数</Text>
                            <Text size="sm" fw={500}>{me.count} 次</Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">总时长</Text>
                            <Text size="sm" fw={500}>{me.duration.toFixed(1)} 分钟</Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">百分位</Text>
                            <Text size="sm" fw={500}>超过 {me.percentile}% 的用户</Text>
                        </Group>
                    </Stack>
                </Paper>
            )}

            {/* Server Stats */}
            {stats !== null && (
                <Paper shadow="sm" radius="md" p="md" withBorder>
                    <Stack gap="xs">
                        <Text size="sm" fw={600}>全服{periodLabel}平均值</Text>
                        <Divider />
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">平均次数</Text>
                            <Text size="sm" fw={500}>{stats.avgCount.toFixed(1)} 次</Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">平均时长</Text>
                            <Text size="sm" fw={500}>{stats.avgDuration.toFixed(1)} 分钟</Text>
                        </Group>
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
};
