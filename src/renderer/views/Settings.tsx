import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Badge,
    Button,
    Divider,
    Group,
    Notification,
    Paper,
    PasswordInput,
    Select,
    Stack,
    Switch,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import {
    IconAlertCircle,
    IconBrain,
    IconDatabase,
    IconUpload,
    IconDownload,
    IconWifi,
    IconCloud,
    IconServer,
} from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { SyncService } from "../services/SyncService";
import { useRecords } from "../hooks/useRecords";
import type { IOnlineState } from "../hooks/useOnlineService";

const AI_PROVIDER_OPTIONS: { value: string; label: string }[] = [
    { value: "local", label: "本地规则分析" },
    { value: "openai", label: "OpenAI 兼容接口" },
];

interface ISettingsProps {
    readonly onlineState?: IOnlineState;
    readonly onEnableOnline?: () => Promise<string>;
    readonly onDisableOnline?: () => Promise<void>;
}

export const Settings = ({ onlineState, onEnableOnline, onDisableOnline }: ISettingsProps) => {
    const { records, refresh } = useRecords();
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const HandleExport = async (): Promise<void> => {
        const allRecords = await DatabaseService.GetRecords();
        const jsonText: string = DatabaseService.ExportToJson(allRecords);
        const blob = new Blob([jsonText], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "masturbation_records.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const HandleImport = async (file: File | null): Promise<void> => {
        if (file === null) return;
        try {
            const text = await file.text();
            const result = await DatabaseService.ImportFromJson(text);
            const msg: string = `导入完成：成功 ${result.Imported} 条，跳过 ${result.Skipped} 条重复，拒绝 ${result.Rejected} 条无效数据`;
            ShowImportMessage(msg);
            refresh();
        } catch {
            ShowImportMessage("导入失败：数据格式不正确");
        }
    };

    const ShowImportMessage = (msg: string): void => {
        setImportMessage(msg);
        if (importTimerRef.current !== null) {
            clearTimeout(importTimerRef.current);
        }
        importTimerRef.current = setTimeout(() => {
            setImportMessage(null);
        }, 5000);
    };

    const HandleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file !== null && file !== undefined) {
            HandleImport(file);
        }
        e.target.value = "";
    };

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">
                    设置
                </Title>
                <Text size="sm" c="dimmed">
                    管理数据导入导出、AI 分析配置，并查看应用信息。
                </Text>
            </Stack>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="sm">
                        <IconDatabase size={22} />
                        <Title order={4}>数据管理</Title>
                    </Group>
                    <Badge variant="light" color="blue">
                        {records.length} 条记录
                    </Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                    导出或导入您的记录数据，支持新旧格式兼容。
                </Text>

                <Group>
                    <Button variant="outline" leftSection={<IconDownload size={16} />} onClick={HandleExport}>
                        导出记录
                    </Button>
                    <Button variant="outline" leftSection={<IconUpload size={16} />} onClick={() => fileInputRef.current?.click()}>
                        导入记录
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={HandleFileChange}
                        style={{ display: "none" }}
                    />
                </Group>

                {importMessage !== null && (
                    <Notification
                        color="blue"
                        title="导入结果"
                        onClose={() => setImportMessage(null)}
                        withCloseButton
                        mt="md"
                    >
                        {importMessage}
                    </Notification>
                )}
            </Paper>

            <LanSyncSection />

            {onlineState !== undefined && onEnableOnline !== undefined && onDisableOnline !== undefined && (
                <OnlineSection
                    onlineState={onlineState}
                    onEnableOnline={onEnableOnline}
                    onDisableOnline={onDisableOnline}
                />
            )}

            <AiConfigSection />
        </Stack>
    );
};

interface IOnlineSectionProps {
    readonly onlineState: IOnlineState;
    readonly onEnableOnline: () => Promise<string>;
    readonly onDisableOnline: () => Promise<void>;
}

const OnlineSection = ({ onlineState, onEnableOnline, onDisableOnline }: IOnlineSectionProps) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmDisable, setShowConfirmDisable] = useState<boolean>(false);
    const [serverUrl, setServerUrl] = useState<string>(onlineState.baseUrl);
    const [serverUrlSaved, setServerUrlSaved] = useState<boolean>(false);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setServerUrl(onlineState.baseUrl);
    }, [onlineState.baseUrl]);

    useEffect(() => {
        return () => {
            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
            }
        };
    }, []);

    const MaskUUID = (uuid: string): string => {
        if (uuid.length <= 8) return uuid;
        return uuid.slice(0, 4) + "****" + uuid.slice(-4);
    };

    const HandleSaveServerUrl = (): void => {
        // Save to localStorage via the existing config mechanism
        const config = { ...onlineState, baseUrl: serverUrl };
        localStorage.setItem("dickhelper_online_config", JSON.stringify(config));
        setServerUrlSaved(true);
        if (savedTimerRef.current !== null) {
            clearTimeout(savedTimerRef.current);
        }
        savedTimerRef.current = setTimeout(() => {
            setServerUrlSaved(false);
        }, 2000);
    };

    const HandleToggle = async (enabled: boolean): Promise<void> => {
        if (enabled) {
            setLoading(true);
            setError(null);
            try {
                await onEnableOnline();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                setError(`启用失败：${message}`);
            } finally {
                setLoading(false);
            }
        } else {
            setShowConfirmDisable(true);
        }
    };

    const HandleConfirmDisable = async (): Promise<void> => {
        setShowConfirmDisable(false);
        setLoading(true);
        setError(null);
        try {
            await onDisableOnline();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`禁用失败：${message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Group justify="space-between" align="flex-start" mb="xs">
                <Group gap="sm">
                    <IconCloud size={22} />
                    <Title order={4}>在线功能</Title>
                </Group>
                <Badge variant="light" color={onlineState.enabled ? "green" : "gray"}>
                    {onlineState.enabled ? "已启用" : "未启用"}
                </Badge>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
                启用在线排行榜功能，与其他用户比拼数据。数据通过 Cloudflare Worker 传输，匿名参与。
            </Text>

            <Stack gap="sm">
                {/* 服务器地址配置 */}
                <Group justify="space-between" align="flex-end">
                    <TextInput
                        label="服务器地址"
                        description="默认使用社区服务器，也可输入自建服务器地址"
                        placeholder="https://your-worker.workers.dev"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.currentTarget.value)}
                        disabled={onlineState.enabled}
                        style={{ flex: 1 }}
                        leftSection={<IconServer size={16} />}
                    />
                    {!onlineState.enabled && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={HandleSaveServerUrl}
                            mb={2}
                        >
                            保存
                        </Button>
                    )}
                </Group>
                {serverUrlSaved && (
                    <Text size="xs" c="green">服务器地址已保存</Text>
                )}

                <Divider />

                {/* 启用/禁用开关 */}
                <Group justify="space-between" align="center">
                    <Text size="sm" c="dimmed">启用在线功能</Text>
                    <Switch
                        checked={onlineState.enabled}
                        onChange={(event) => HandleToggle(event.currentTarget.checked)}
                        disabled={loading}
                    />
                </Group>

                {/* 用户信息（启用后显示） */}
                {onlineState.enabled && onlineState.nickname !== null && (
                    <>
                        <Divider />
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">昵称</Text>
                            <Text size="sm" fw={500}>{onlineState.nickname}</Text>
                        </Group>
                        {onlineState.uuid !== null && (
                            <Group justify="space-between">
                                <Text size="sm" c="dimmed">UUID</Text>
                                <Text size="sm" fw={500} ff="monospace">
                                    {MaskUUID(onlineState.uuid)}
                                </Text>
                            </Group>
                        )}
                    </>
                )}

                {showConfirmDisable && (
                    <Alert color="red" title="确认禁用" icon={<IconAlertCircle size={18} />}>
                        <Text size="sm" mb="sm">
                            禁用在线功能后，你的排行榜数据将从服务器删除。此操作不可撤销。
                        </Text>
                        <Group>
                            <Button
                                color="red"
                                size="xs"
                                onClick={HandleConfirmDisable}
                                loading={loading}
                            >
                                确认禁用
                            </Button>
                            <Button
                                variant="subtle"
                                size="xs"
                                onClick={() => setShowConfirmDisable(false)}
                            >
                                取消
                            </Button>
                        </Group>
                    </Alert>
                )}

                {error !== null && (
                    <Alert color="red" icon={<IconAlertCircle size={18} />} title="错误">
                        {error}
                    </Alert>
                )}
            </Stack>
        </Paper>
    );
};

const AiConfigSection = () => {
    const [provider, setProvider] = useState<string>("local");
    const [apiEndpoint, setApiEndpoint] = useState<string>("https://api.openai.com/v1/chat/completions");
    const [apiKey, setApiKey] = useState<string>("");
    const [model, setModel] = useState<string>("gpt-4o-mini");
    const [saved, setSaved] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const LoadSettings = async (): Promise<void> => {
            const [providerSetting, endpointSetting, apiKeySetting, modelSetting] = await Promise.all([
                DatabaseService.GetSetting("ai_provider"),
                DatabaseService.GetSetting("ai_api_endpoint"),
                DatabaseService.GetSetting("ai_api_key"),
                DatabaseService.GetSetting("ai_model"),
            ]);

            setProvider(providerSetting === "openai" ? "openai" : "local");
            if (endpointSetting !== null) {
                setApiEndpoint(endpointSetting);
            }
            if (apiKeySetting !== null) {
                setApiKey(apiKeySetting);
            }
            if (modelSetting !== null) {
                setModel(modelSetting);
            }
        };

        void LoadSettings();
        return () => {
            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
            }
        };
    }, []);

    const HandleSave = async (): Promise<void> => {
        try {
            await DatabaseService.SetSetting("ai_provider", provider);
            await DatabaseService.SetSetting("ai_api_endpoint", apiEndpoint);
            await DatabaseService.SetSetting("ai_api_key", apiKey);
            await DatabaseService.SetSetting("ai_model", model);
            setSaveError(null);
            setSaved(true);
            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
            }
            savedTimerRef.current = setTimeout(() => {
                setSaved(false);
            }, 2000);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setSaved(false);
            setSaveError(message);
        }
    };

    const showApiFields: boolean = provider === "openai";

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Group gap="sm" mb="xs">
                <IconBrain size={22} />
                <Title order={4}>AI 分析配置</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
                本地规则分析是默认选项，不需要 API。切换到 OpenAI 兼容接口后可以配置地址、密钥和模型。
            </Text>

            <Stack gap="sm">
                <Select
                    label="分析方式"
                    data={AI_PROVIDER_OPTIONS}
                    value={provider}
                    onChange={(value) => {
                        setProvider(value ?? "local");
                    }}
                />

                {showApiFields && (
                    <>
                        <TextInput
                            label="API 地址"
                            description="支持本地 HTTP 地址或任何 OpenAI Chat Completions 兼容端点。"
                            placeholder="https://api.openai.com/v1/chat/completions"
                            value={apiEndpoint}
                            onChange={(e) => setApiEndpoint(e.currentTarget.value)}
                        />
                        <PasswordInput
                            label="API Key"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.currentTarget.value)}
                        />
                        <TextInput
                            label="模型名称"
                            placeholder="gpt-4o-mini"
                            value={model}
                            onChange={(e) => setModel(e.currentTarget.value)}
                        />
                    </>
                )}

                <Group align="center">
                    <Button variant="filled" color="blue" onClick={HandleSave}>
                        保存配置
                    </Button>
                    {saved && (
                        <Text size="sm" c="green">
                            已保存
                        </Text>
                    )}
                </Group>

                {saveError !== null && (
                    <Alert color="red" icon={<IconAlertCircle size={18} />} title="保存失败">
                        {saveError}
                    </Alert>
                )}
            </Stack>
        </Paper>
    );
};

const LanSyncSection = () => {
    const [syncStatus, setSyncStatus] = useState<{ Running: boolean; Port: number; Addresses: readonly string[] }>({
        Running: false,
        Port: 0,
        Addresses: [],
    });
    const [syncLoading, setSyncLoading] = useState<boolean>(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const syncMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        SyncService.GetStatus()
            .then(setSyncStatus)
            .catch(() => {});
    }, []);

    const ShowSyncMessage = (msg: string): void => {
        setSyncMessage(msg);
        if (syncMessageTimerRef.current !== null) {
            clearTimeout(syncMessageTimerRef.current);
        }
        syncMessageTimerRef.current = setTimeout(() => {
            setSyncMessage(null);
        }, 5000);
    };

    const HandleStartSync = async (): Promise<void> => {
        setSyncLoading(true);
        try {
            const status = await SyncService.Start();
            setSyncStatus(status);
            ShowSyncMessage("同步服务已启动");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            ShowSyncMessage(`启动失败：${message}`);
        } finally {
            setSyncLoading(false);
        }
    };

    const HandleStopSync = async (): Promise<void> => {
        setSyncLoading(true);
        try {
            const status = await SyncService.Stop();
            setSyncStatus(status);
            ShowSyncMessage("同步服务已停止");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            ShowSyncMessage(`停止失败：${message}`);
        } finally {
            setSyncLoading(false);
        }
    };

    const isRunning: boolean = syncStatus.Running;
    const statusColor: string = isRunning ? "green" : "gray";
    const statusText: string = isRunning ? "运行中" : "未启动";

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Group justify="space-between" align="flex-start" mb="xs">
                <Group gap="sm">
                    <IconWifi size={22} />
                    <Title order={4}>局域网同步</Title>
                </Group>
                <Badge variant="light" color={statusColor}>
                    {statusText}
                </Badge>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
                启动同步服务后，手机端可通过 IP 地址连接并同步记录数据。
            </Text>

            <Stack gap="sm">
                {isRunning && syncStatus.Addresses.length > 0 && (
                    <Group gap="xs" align="center">
                        <Text size="sm" c="dimmed">连接地址：</Text>
                        {syncStatus.Addresses.map((addr) => (
                            <Badge key={addr} variant="outline" color="blue">
                                {addr}:{syncStatus.Port}
                            </Badge>
                        ))}
                    </Group>
                )}

                {isRunning && syncStatus.Addresses.length === 0 && (
                    <Text size="sm" c="dimmed">
                        未检测到局域网 IP 地址，请检查网络连接。
                    </Text>
                )}

                <Group>
                    {isRunning ? (
                        <Button
                            variant="outline"
                            color="red"
                            leftSection={<IconWifi size={16} />}
                            onClick={HandleStopSync}
                            loading={syncLoading}
                        >
                            停止服务
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            color="green"
                            leftSection={<IconWifi size={16} />}
                            onClick={HandleStartSync}
                            loading={syncLoading}
                        >
                            启动服务
                        </Button>
                    )}
                </Group>

                {syncMessage !== null && (
                    <Notification
                        color="blue"
                        title="同步服务"
                        onClose={() => setSyncMessage(null)}
                        withCloseButton
                    >
                        {syncMessage}
                    </Notification>
                )}
            </Stack>
        </Paper>
    );
};
