import { useState, useEffect, useCallback } from "react";
import {
    Paper,
    Title,
    Stack,
    Text,
    Group,
    ActionIcon,
    Modal,
    Button,
    Badge,
    Tabs,
    Tooltip,
} from "@mantine/core";
import { IconTrash, IconEraser, IconRecycle, IconRestore, IconHistory } from "@tabler/icons-react";
import { useRecords } from "../hooks/useRecords";
import { DatabaseService } from "../services/DatabaseService";
import type { IRecord } from "@dickhelper/shared";

const FormatDuration = (durationMinutes: number): string => {
    const minutes: number = Math.floor(durationMinutes);
    const seconds: number = Math.round((durationMinutes - minutes) * 60);
    return `${minutes}分${seconds}秒`;
};

export const HistoryList = () => {
    const { records, loading, refresh } = useRecords();
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [purgeModalOpen, setPurgeModalOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>("active");
    const [deletedRecords, setDeletedRecords] = useState<IRecord[]>([]);
    const [deletedLoading, setDeletedLoading] = useState<boolean>(false);

    const HandleDeleteRecord = async (id: string): Promise<void> => {
        await DatabaseService.DeleteRecord(id);
        refresh();
    };

    const HandleClearAll = async (): Promise<void> => {
        await DatabaseService.ClearAll();
        setDeleteModalOpen(false);
        refresh();
    };

    const loadDeletedRecords = useCallback(async (): Promise<void> => {
        setDeletedLoading(true);
        try {
            const data = await DatabaseService.GetDeletedRecords();
            setDeletedRecords(data);
        } catch (error: unknown) {
            console.error("[HistoryList] Failed to load deleted records:", error);
        } finally {
            setDeletedLoading(false);
        }
    }, []);

    const HandleRestoreRecord = async (id: string): Promise<void> => {
        await DatabaseService.RestoreRecord(id);
        await loadDeletedRecords();
        refresh();
    };

    const HandlePurgeDeleted = async (): Promise<void> => {
        await DatabaseService.PurgeDeleted();
        setPurgeModalOpen(false);
        await loadDeletedRecords();
    };

    useEffect(() => {
        if (activeTab === "trash") {
            void loadDeletedRecords();
        }
    }, [activeTab, loadDeletedRecords]);

    // Refresh trash when records update
    useEffect(() => {
        if (activeTab === "trash") {
            void loadDeletedRecords();
        }
    }, [records, activeTab, loadDeletedRecords]);

    if (loading) {
        return <Text ta="center" c="dimmed">加载中...</Text>;
    }

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Group justify="space-between" align="center">
                <Stack gap={4}>
                    <Title order={3} c="blue">
                        历史
                    </Title>
                    <Text size="sm" c="dimmed">
                        查看、删除或清空已经保存的记录。
                    </Text>
                </Stack>
                {activeTab === "active" && records.length > 0 && (
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        size="lg"
                        onClick={() => setDeleteModalOpen(true)}
                        title="软删除所有记录（移入回收站）"
                    >
                        <IconEraser size={20} />
                    </ActionIcon>
                )}
            </Group>

            <Tabs value={activeTab} onChange={(value) => { if (value !== null) setActiveTab(value); }}>
                <Tabs.List>
                    <Tabs.Tab value="active" leftSection={<IconHistory size={16} />}>
                        活跃记录
                    </Tabs.Tab>
                    <Tabs.Tab value="trash" leftSection={<IconRecycle size={16} />}>
                        回收站
                        {deletedRecords.length > 0 && (
                            <Badge size="xs" color="red" ml={6} variant="filled" circle>
                                {deletedRecords.length}
                            </Badge>
                        )}
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="active" pt="md">
                    {records.length === 0 ? (
                        <Paper shadow="sm" radius="md" p="xl" withBorder>
                            <Text ta="center" fw={600} size="lg">
                                暂无记录
                            </Text>
                            <Text ta="center" c="dimmed" size="sm" mt="xs">
                                开始记录你的第一次手艺活吧
                            </Text>
                        </Paper>
                    ) : (
                        <Stack gap="sm">
                            {records.map((record: IRecord) => (
                                <Paper key={record.Id} shadow="xs" radius="md" p="md" withBorder>
                                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                                        <Stack gap={6} style={{ flex: 1 }}>
                                            <Group gap="xs" wrap="wrap">
                                                <Text size="sm" fw={600}>
                                                    {record.EndTime.toLocaleString()}
                                                </Text>
                                                <Badge
                                                    variant="light"
                                                    color="blue"
                                                    size="sm"
                                                >
                                                    {FormatDuration(record.Duration)}
                                                </Badge>
                                            </Group>
                                            <Text size="sm" c="dimmed" lineClamp={2}>
                                                {record.Notes || "无备注"}
                                            </Text>
                                        </Stack>
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            onClick={() => HandleDeleteRecord(record.Id)}
                                            title="删除（移入回收站）"
                                            aria-label="删除记录"
                                        >
                                            <IconTrash size={18} />
                                        </ActionIcon>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </Tabs.Panel>

                <Tabs.Panel value="trash" pt="md">
                    {deletedLoading ? (
                        <Text ta="center" c="dimmed">加载中...</Text>
                    ) : deletedRecords.length === 0 ? (
                        <Paper shadow="sm" radius="md" p="xl" withBorder>
                            <Text ta="center" fw={600} size="lg">
                                回收站为空
                            </Text>
                            <Text ta="center" c="dimmed" size="sm" mt="xs">
                                没有已删除的记录
                            </Text>
                        </Paper>
                    ) : (
                        <>
                            <Group justify="flex-end" mb="sm">
                                <Button
                                    variant="light"
                                    color="red"
                                    size="xs"
                                    leftSection={<IconTrash size={14} />}
                                    onClick={() => setPurgeModalOpen(true)}
                                >
                                    清空回收站
                                </Button>
                            </Group>
                            <Stack gap="sm">
                                {deletedRecords.map((record: IRecord) => (
                                    <Paper key={record.Id} shadow="xs" radius="md" p="md" withBorder style={{ opacity: 0.7 }}>
                                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                                            <Stack gap={6} style={{ flex: 1 }}>
                                                <Group gap="xs" wrap="wrap">
                                                    <Text size="sm" fw={600}>
                                                        {record.EndTime.toLocaleString()}
                                                    </Text>
                                                    <Badge
                                                        variant="light"
                                                        color="gray"
                                                        size="sm"
                                                    >
                                                        {FormatDuration(record.Duration)}
                                                    </Badge>
                                                    {record.DeletedAt && (
                                                        <Text size="xs" c="dimmed">
                                                            删除于 {record.DeletedAt.toLocaleString()}
                                                        </Text>
                                                    )}
                                                </Group>
                                                <Text size="sm" c="dimmed" lineClamp={2}>
                                                    {record.Notes || "无备注"}
                                                </Text>
                                            </Stack>
                                            <Tooltip label="恢复记录">
                                                <ActionIcon
                                                    variant="subtle"
                                                    color="green"
                                                    onClick={() => HandleRestoreRecord(record.Id)}
                                                    title="恢复"
                                                    aria-label="恢复记录"
                                                >
                                                    <IconRestore size={18} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        </>
                    )}
                </Tabs.Panel>
            </Tabs>

            <Modal
                opened={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="确认清空数据"
                centered
            >
                <Text mb="lg">确定要将所有记录移入回收站吗？可以在回收站中恢复。</Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
                        取消
                    </Button>
                    <Button color="red" onClick={HandleClearAll}>
                        确认清空
                    </Button>
                </Group>
            </Modal>

            <Modal
                opened={purgeModalOpen}
                onClose={() => setPurgeModalOpen(false)}
                title="确认永久删除"
                centered
            >
                <Text mb="lg">确定要永久删除回收站中的所有记录吗？此操作不可恢复。</Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setPurgeModalOpen(false)}>
                        取消
                    </Button>
                    <Button color="red" onClick={HandlePurgeDeleted}>
                        永久删除
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
};
