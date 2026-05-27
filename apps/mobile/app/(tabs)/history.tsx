import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Button, Dialog, Divider, IconButton, Portal, Snackbar, Surface, Text, useTheme } from "react-native-paper";
import type { IRecord } from "@dickhelper/shared";
import { useMobileDatabaseService } from "../../src/hooks/useMobileDatabaseService";
import { useRecords } from "../../src/hooks/useRecords";
import { FormatDateTime, FormatDurationMinutes } from "../../src/utils/formatters";

export default function HistoryScreen() {
    const theme = useTheme();
    const database = useMobileDatabaseService();
    const { records, loading, error, refresh } = useRecords();
    const [selectedRecord, setSelectedRecord] = useState<IRecord | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    const emptyText = useMemo((): string => "暂无记录", []);

    const HandleDelete = async (): Promise<void> => {
        if (selectedRecord === null) {
            return;
        }

        setDeleting(true);
        try {
            const success = await database.DeleteRecord(selectedRecord.Id);
            setSelectedRecord(null);
            if (success) {
                setMessage("记录已删除");
                await refresh();
            } else {
                setMessage("删除失败");
            }
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`删除失败：${errorMessage}`);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    历史
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    按结束时间倒序显示
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
            ) : records.length === 0 ? (
                <Surface style={styles.emptySurface} elevation={0}>
                    <Text variant="titleMedium" style={styles.emptyTitle}>
                        {emptyText}
                    </Text>
                    <Text variant="bodyMedium" style={styles.emptySubtitle} numberOfLines={0}>
                        {"先去「记录」页创建一条本地记录。"}
                    </Text>
                </Surface>
            ) : (
                <FlatList
                    data={records}
                    keyExtractor={(item) => item.Id}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <Divider />}
                    renderItem={({ item }) => (
                        <Surface style={styles.itemSurface} elevation={1}>
                            <View style={styles.itemRow}>
                                <View style={styles.itemTextBlock}>
                                    <Text variant="labelLarge" style={styles.itemTime}>
                                        {FormatDateTime(item.EndTime)}
                                    </Text>
                                    <Text variant="bodyMedium" style={styles.itemDuration}>
                                        {FormatDurationMinutes(item.Duration)}
                                    </Text>
                                    <Text variant="bodyMedium" style={styles.itemNotes} numberOfLines={2}>
                                        {item.Notes?.trim() ? item.Notes : "无备注"}
                                    </Text>
                                </View>

                                <IconButton
                                    icon="trash-can-outline"
                                    iconColor={theme.colors.error}
                                    accessibilityLabel="删除记录"
                                    onPress={() => setSelectedRecord(item)}
                                />
                            </View>
                        </Surface>
                    )}
                />
            )}

            <Portal>
                <Dialog visible={selectedRecord !== null} onDismiss={() => setSelectedRecord(null)}>
                    <Dialog.Title>删除记录</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">
                            确认删除 {selectedRecord !== null ? FormatDateTime(selectedRecord.EndTime) : ""} 这条记录？
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setSelectedRecord(null)} disabled={deleting}>
                            取消
                        </Button>
                        <Button
                            onPress={() => {
                                void HandleDelete();
                            }}
                            loading={deleting}
                            textColor={theme.colors.error}
                        >
                            删除
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={2500}>
                {message}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    emptySurface: {
        borderRadius: 12,
        padding: 20,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 180,
    },
    emptyTitle: {
        color: "#0f172a",
    },
    emptySubtitle: {
        color: "#64748b",
        textAlign: "center",
    },
    listContent: {
        gap: 12,
        paddingBottom: 12,
    },
    itemSurface: {
        borderRadius: 12,
        backgroundColor: "#ffffff",
        padding: 16,
    },
    itemRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },
    itemTextBlock: {
        flex: 1,
        gap: 6,
    },
    itemTime: {
        color: "#0f172a",
    },
    itemDuration: {
        color: "#0f766e",
        fontWeight: "700",
    },
    itemNotes: {
        color: "#475569",
    },
});
