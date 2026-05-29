import { useState } from "react";
import {
    Alert,
    Badge,
    Button,
    Divider,
    Group,
    Progress,
    SegmentedControl,
    Stack,
    Switch,
    Text,
    Title,
    Paper,
} from "@mantine/core";
import {
    IconAlertCircle,
    IconDownload,
    IconInfoCircle,
    IconRefresh,
    IconRocket,
    IconStar,
    IconWorld,
} from "@tabler/icons-react";
import type { UpdateSource, UpdateStatus } from "@dickhelper/shared";
import { useUpdateState } from "../hooks/useUpdateState";
import { UpdateService } from "../services/UpdateService";
import { useEffect } from "react";

const GetUpdateStatusText = (status: UpdateStatus | undefined): string => {
    switch (status) {
        case "checking":
            return "检查中";
        case "available":
            return "发现新版本";
        case "downloading":
            return "下载中";
        case "downloaded":
            return "已下载";
        case "not-available":
            return "已是最新";
        case "error":
            return "检查失败";
        case "disabled":
            return "开发模式";
        default:
            return "空闲";
    }
};

const GetUpdateSourceValue = (value: string): UpdateSource => {
    if (value === "github") {
        return "github";
    }
    return "mirror";
};

export const About = () => {
    const { UpdateState } = useUpdateState();

    const updateSource: UpdateSource = UpdateState?.Source ?? "mirror";
    const currentVersion: string = UpdateState?.CurrentVersion ?? "2.0.0";
    const updateStatusText: string = GetUpdateStatusText(UpdateState?.Status);
    const updateProgress: number = UpdateState?.DownloadProgress ?? 0;
    const isChecking: boolean = UpdateState?.IsChecking === true;
    const isDownloading: boolean = UpdateState?.IsDownloading === true;

    const [proxyEnabled, setProxyEnabled] = useState<boolean>(true);

    useEffect(() => {
        UpdateService.GetProxy()
            .then(setProxyEnabled)
            .catch(() => setProxyEnabled(true));
    }, []);

    const HandleProxyToggle = (enabled: boolean): void => {
        setProxyEnabled(enabled);
        void UpdateService.SetProxy(enabled);
    };

    const HandleSourceChange = (value: string): void => {
        void UpdateService.SetSource(GetUpdateSourceValue(value));
    };

    const HandleCheckUpdate = (): void => {
        void UpdateService.CheckForUpdates();
    };

    const HandleDownloadUpdate = (): void => {
        void UpdateService.DownloadUpdate();
    };

    const HandleInstallUpdate = (): void => {
        void UpdateService.InstallUpdate();
    };

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">
                    关于
                </Title>
                <Text size="sm" c="dimmed">
                    查看应用信息、检查更新。
                </Text>
            </Stack>

            {/* 应用更新 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="sm">
                        <IconWorld size={22} />
                        <Title order={4}>应用更新</Title>
                    </Group>
                    <Badge
                        variant="light"
                        color={UpdateState?.Status === "error" ? "red" : "blue"}
                    >
                        {updateStatusText}
                    </Badge>
                </Group>

                <Text size="sm" c="dimmed" mb="md">
                    启动时自动检查更新，发现新版本后由您决定是否下载。
                </Text>

                <Stack gap="md">
                    <Group justify="space-between" align="center">
                        <Text size="sm" c="dimmed">更新源</Text>
                        <SegmentedControl
                            value={updateSource}
                            onChange={(value) => {
                                HandleSourceChange(value);
                            }}
                            data={[
                                { label: "ghfast 镜像", value: "mirror" },
                                { label: "GitHub 直连", value: "github" },
                            ]}
                        />
                    </Group>

                    <Divider />

                    <Group justify="space-between" align="center">
                        <Text size="sm" c="dimmed">使用系统代理</Text>
                        <Switch
                            checked={proxyEnabled}
                            onChange={(event) => HandleProxyToggle(event.currentTarget.checked)}
                        />
                    </Group>

                    <Divider />

                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">当前版本</Text>
                        <Text size="sm" fw={500}>v{currentVersion}</Text>
                    </Group>

                    {UpdateState?.AvailableVersion !== null && UpdateState?.AvailableVersion !== undefined && (
                        <>
                            <Divider />
                            <Group justify="space-between">
                                <Text size="sm" c="dimmed">可用版本</Text>
                                <Text size="sm" fw={500}>v{UpdateState.AvailableVersion}</Text>
                            </Group>
                        </>
                    )}

                    {isDownloading && (
                        <Progress value={updateProgress} animated />
                    )}

                    {UpdateState?.ErrorMessage !== null && UpdateState?.ErrorMessage !== undefined && (
                        <Alert
                            color="red"
                            icon={<IconAlertCircle size={18} />}
                            title="更新失败"
                        >
                            {UpdateState.ErrorMessage}
                        </Alert>
                    )}

                    <Group>
                        <Button
                            variant="outline"
                            leftSection={<IconRefresh size={16} />}
                            onClick={HandleCheckUpdate}
                            loading={isChecking}
                            disabled={isDownloading}
                        >
                            检查更新
                        </Button>

                        {UpdateState?.IsUpdateAvailable === true && (
                            <Button
                                leftSection={<IconDownload size={16} />}
                                onClick={HandleDownloadUpdate}
                                loading={isDownloading}
                            >
                                下载更新
                            </Button>
                        )}

                        {UpdateState?.IsUpdateDownloaded === true && (
                            <Button
                                color="green"
                                leftSection={<IconRocket size={16} />}
                                onClick={HandleInstallUpdate}
                            >
                                重启安装
                            </Button>
                        )}
                    </Group>
                </Stack>
            </Paper>

            {/* 关于 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group gap="sm" mb="xs">
                    <IconInfoCircle size={22} />
                    <Title order={4}>关于</Title>
                </Group>

                <Stack gap={4}>
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">应用名称</Text>
                        <Text size="sm" fw={500}>牛子小助手 (DickHelper)</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">版本</Text>
                        <Text size="sm" fw={500}>v{currentVersion}</Text>
                    </Group>
                    <Divider />
                    <Button
                        variant="light"
                        color="yellow"
                        fullWidth
                        leftSection={<IconStar size={16} />}
                        onClick={() => { void window.electronAPI.OpenExternal("https://github.com/zzzdajb/DickHelper"); }}
                    >
                        喜欢这个应用？去 GitHub 给项目点个 Star
                    </Button>
                </Stack>
            </Paper>
        </Stack>
    );
};
