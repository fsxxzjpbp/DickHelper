import { useEffect, useRef, useState, useCallback } from "react";
import { DatabaseService } from "../services/DatabaseService";

const TELEMETRY_BASE_URL = "https://dickhelper.sakuraseasons.space";
const REPORT_INTERVAL_MS = 18 * 60 * 60 * 1000; // 18 小时

function GetOsLabel(platform: string): string {
    switch (platform) {
        case "win32":
            return "windows";
        case "darwin":
            return "macos";
        case "linux":
            return "linux";
        default:
            return platform;
    }
}

export interface IUseTelemetryResult {
    readonly enabled: boolean;
    readonly toggle: (nextEnabled: boolean) => Promise<void>;
    readonly osLabel: string;
    readonly appVersion: string;
}

export function useTelemetry(): IUseTelemetryResult {
    const [enabled, setEnabled] = useState<boolean>(true);
    const [osLabel, setOsLabel] = useState<string>("");
    const [appVersion, setAppVersion] = useState<string>("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const DoReport = useCallback(async (): Promise<void> => {
        try {
            const isEnabled = await DatabaseService.GetSetting("telemetry_enabled");
            if (isEnabled === "false") return;

            let uuid = await DatabaseService.GetSetting("telemetry_uuid");
            if (uuid === null || uuid.length === 0) {
                uuid = crypto.randomUUID();
                await DatabaseService.SetSetting("telemetry_uuid", uuid);
            }

            const version = await window.electronAPI.GetAppVersion();
            const rawOs = await window.electronAPI.GetAppOs();
            const osName = GetOsLabel(rawOs);

            await window.electronAPI.ReportTelemetry(uuid, "desktop", version, osName, TELEMETRY_BASE_URL);
        } catch {
            // 静默忽略
        }
    }, []);

    useEffect(() => {
        const Init = async (): Promise<void> => {
            // 读取设置
            const setting = await DatabaseService.GetSetting("telemetry_enabled");
            const isEnabled = setting !== "false";
            setEnabled(isEnabled);

            const version = await window.electronAPI.GetAppVersion();
            setAppVersion(version);

            const rawOs = await window.electronAPI.GetAppOs();
            setOsLabel(GetOsLabel(rawOs));

            // 启动时上报一次
            await DoReport();
        };

        void Init();

        // 每 18 小时上报一次
        intervalRef.current = setInterval(() => {
            void DoReport();
        }, REPORT_INTERVAL_MS);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [DoReport]);

    const toggle = useCallback(async (nextEnabled: boolean): Promise<void> => {
        await DatabaseService.SetSetting("telemetry_enabled", nextEnabled ? "true" : "false");
        setEnabled(nextEnabled);
        if (nextEnabled) {
            await DoReport();
        }
    }, [DoReport]);

    return { enabled, toggle, osLabel, appVersion };
}
