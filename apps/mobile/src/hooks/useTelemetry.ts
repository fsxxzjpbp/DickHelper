import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { reportTelemetryLaunch } from "@dickhelper/core";
import { useMobileDatabaseService } from "./useMobileDatabaseService";

const TELEMETRY_BASE_URL = "https://dickhelper.sakuraseasons.space";
const REPORT_INTERVAL_MS = 18 * 60 * 60 * 1000; // 18 小时

function GetOsLabel(): string {
    return Platform.OS === "android" ? "android" : Platform.OS;
}

function GetAppVersion(): string {
    return Constants.expoConfig?.version ?? "unknown";
}

export interface IUseTelemetryResult {
    readonly enabled: boolean;
    readonly toggle: (nextEnabled: boolean) => Promise<void>;
    readonly osLabel: string;
    readonly appVersion: string;
}

export function useTelemetry(): IUseTelemetryResult {
    const database = useMobileDatabaseService();
    const [enabled, setEnabled] = useState<boolean>(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const DoReport = useCallback(async (): Promise<void> => {
        try {
            const isEnabled = await database.GetSetting("telemetry_enabled");
            if (isEnabled === "false") return;

            let uuid = await database.GetSetting("telemetry_uuid");
            if (uuid === null || uuid.length === 0) {
                uuid = crypto.randomUUID();
                await database.SetSetting("telemetry_uuid", uuid);
            }

            const version = GetAppVersion();
            const osName = GetOsLabel();

            await reportTelemetryLaunch(TELEMETRY_BASE_URL, {
                uuid,
                platform: "mobile",
                app_version: version,
                os: osName,
            });
        } catch {
            // 静默忽略
        }
    }, [database]);

    useEffect(() => {
        const Init = async (): Promise<void> => {
            const setting = await database.GetSetting("telemetry_enabled");
            const isEnabled = setting !== "false";
            setEnabled(isEnabled);

            await DoReport();
        };

        void Init();

        intervalRef.current = setInterval(() => {
            void DoReport();
        }, REPORT_INTERVAL_MS);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [database, DoReport]);

    const toggle = useCallback(async (nextEnabled: boolean): Promise<void> => {
        await database.SetSetting("telemetry_enabled", nextEnabled ? "true" : "false");
        setEnabled(nextEnabled);
        if (nextEnabled) {
            await DoReport();
        }
    }, [database, DoReport]);

    return {
        enabled,
        toggle,
        osLabel: GetOsLabel(),
        appVersion: GetAppVersion(),
    };
}
