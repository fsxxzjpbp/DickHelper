import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { List, Snackbar, Surface, Text } from "react-native-paper";
import { useMobileDatabaseService } from "../../src/hooks/useMobileDatabaseService";
import { useRecords } from "../../src/hooks/useRecords";
import { FormatDateTime } from "../../src/utils/formatters";

export default function SettingsScreen() {
    const router = useRouter();
    const database = useMobileDatabaseService();
    const { records, refresh } = useRecords();
    const [busy, setBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string | null>(null);

    const appVersion = Constants.expoConfig?.version ?? "0.1.0";

    const HandleImport = async (): Promise<void> => {
        setBusy(true);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["application/json", "text/json", "text/plain", "*/*"],
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled) {
                return;
            }

            const asset = result.assets[0];
            if (asset === undefined) {
                setMessage("未选择文件");
                return;
            }

            const jsonText = await FileSystem.readAsStringAsync(asset.uri);
            const importResult = await database.ImportFromJson(jsonText);
            setMessage(
                `导入完成：成功 ${importResult.Imported} 条，跳过 ${importResult.Skipped} 条，拒绝 ${importResult.Rejected} 条`
            );
            await refresh();
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`导入失败：${errorMessage}`);
        } finally {
            setBusy(false);
        }
    };

    const HandleExport = async (): Promise<void> => {
        setBusy(true);
        try {
            const jsonText = await database.ExportToJson();
            const cacheDirectory = FileSystem.cacheDirectory;
            if (cacheDirectory === null) {
                setMessage("当前设备无法导出文件");
                return;
            }

            const fileUri = `${cacheDirectory}dickhelper-export.json`;
            await FileSystem.writeAsStringAsync(fileUri, jsonText);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
                setMessage(`已导出 ${records.length} 条记录`);
            } else {
                setMessage("当前设备不支持分享导出");
            }
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`导出失败：${errorMessage}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    设置
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    导入、导出、版本信息和 AI 占位入口。
                </Text>
            </View>

            <Surface style={styles.sectionSurface} elevation={1}>
                <List.Section>
                    <List.Subheader>数据</List.Subheader>
                    <List.Item
                        title="导入 JSON"
                        description="支持 canonical v1 与旧版数组格式"
                        left={(props) => <List.Icon {...props} icon="download" />}
                        onPress={() => {
                            void HandleImport();
                        }}
                        disabled={busy}
                    />
                    <List.Item
                        title="导出 JSON"
                        description="导出 canonical v1 格式"
                        left={(props) => <List.Icon {...props} icon="upload" />}
                        onPress={() => {
                            void HandleExport();
                        }}
                        disabled={busy}
                    />
                </List.Section>
            </Surface>

            <Surface style={styles.sectionSurface} elevation={1}>
                <List.Section>
                    <List.Subheader>功能</List.Subheader>
                    <List.Item
                        title="AI 配置"
                        description="后续版本开放的占位入口"
                        left={(props) => <List.Icon {...props} icon="robot-outline" />}
                        right={(props) => <List.Icon {...props} icon="chevron-right" />}
                        onPress={() => router.push("/settings/ai")}
                    />
                </List.Section>
            </Surface>

            <Surface style={styles.aboutSurface} elevation={0}>
                <Text variant="labelLarge" style={styles.aboutLabel}>
                    关于
                </Text>
                <Text variant="bodyMedium" style={styles.aboutText}>
                    DickHelper Android MVP
                </Text>
                <Text variant="bodyMedium" style={styles.aboutText}>
                    版本：{appVersion}
                </Text>
                <Text variant="bodyMedium" style={styles.aboutText}>
                    平台：Android
                </Text>
                <Text variant="bodySmall" style={styles.aboutHint}>
                    当前记录数：{records.length}，最近一条：{records[0] !== undefined ? FormatDateTime(records[0].EndTime) : "暂无"}
                </Text>
            </Surface>

            <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3000}>
                {message}
            </Snackbar>
        </ScrollView>
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
    sectionSurface: {
        borderRadius: 12,
        backgroundColor: "#ffffff",
        overflow: "hidden",
    },
    aboutSurface: {
        borderRadius: 12,
        backgroundColor: "#ffffff",
        padding: 16,
        gap: 6,
    },
    aboutLabel: {
        color: "#64748b",
    },
    aboutText: {
        color: "#0f172a",
    },
    aboutHint: {
        color: "#64748b",
        marginTop: 4,
    },
});
