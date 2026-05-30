import { useState, useEffect, useCallback, useRef } from "react";
import type { IRankingResponse } from "@dickhelper/shared";
import {
    generateUUID,
    getOnlineConfig,
    setOnlineConfig,
    registerLeaderboard,
    rerollNickname,
    batchReportDailyStats,
    getDailyRanking,
    getWeeklyRanking,
    deleteAccount,
    aggregateAllDailyStatsWithRecords,
} from "@dickhelper/core";
import { DatabaseService } from "../services/DatabaseService";

const REPORT_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface IOnlineState {
    readonly enabled: boolean;
    readonly uuid: string | null;
    readonly nickname: string | null;
    readonly baseUrl: string;
    readonly deviceId: string | null;
}

export function useOnlineService() {
    const [onlineState, setOnlineState] = useState<IOnlineState>(() => {
        const config = getOnlineConfig();
        return {
            enabled: config.enabled,
            uuid: config.uuid,
            nickname: config.nickname,
            baseUrl: config.baseUrl,
            deviceId: config.deviceId,
        };
    });

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef<boolean>(true);
    // Tracks whether local records changed since last reportStats, to skip no-op uploads
    const dirtyRef = useRef<boolean>(false);

    // Save config whenever onlineState changes
    const saveConfig = useCallback((state: IOnlineState): void => {
        setOnlineConfig({
            enabled: state.enabled,
            uuid: state.uuid,
            nickname: state.nickname,
            baseUrl: state.baseUrl,
            deviceId: state.deviceId,
        });
    }, []);

    // Report all local stats to the server (full sync, single batch request)
    const reportStats = useCallback(async (): Promise<void> => {
        const config = getOnlineConfig();
        if (!config.enabled || config.uuid === null || config.deviceId === null) return;

        try {
            const records = await DatabaseService.GetRecords();
            const allStats = aggregateAllDailyStatsWithRecords(records);

            if (allStats.size === 0) return;

            const stats = Array.from(allStats.entries()).map(
                ([date, { count, duration, records: recordDetails }]) => ({ date, count, duration, records: recordDetails })
            );
            await batchReportDailyStats(config.baseUrl, config.uuid, config.deviceId, stats);
            console.log("[OnlineService] Stats reported:", stats.length, "days");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn("[OnlineService] Failed to report stats:", message);
        }
    }, []);

    // Start the periodic reporting timer
    const startTimer = useCallback((): void => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(() => {
            void reportStats();
        }, REPORT_INTERVAL_MS);
    }, [reportStats]);

    // Stop the periodic reporting timer
    const stopTimer = useCallback((): void => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Enable online feature
    const enableOnline = useCallback(async (): Promise<string> => {
        const uuid = generateUUID();
        const config = getOnlineConfig();
        const deviceId = config.deviceId ?? generateUUID(); // Reuse existing device_id or generate new one
        const baseUrl = config.baseUrl;

        const result = await registerLeaderboard(baseUrl, uuid);

        const newState: IOnlineState = {
            enabled: true,
            uuid,
            nickname: result.nickname,
            baseUrl,
            deviceId,
        };

        if (mountedRef.current) {
            setOnlineState(newState);
        }
        saveConfig(newState);

        // Report all local stats (full sync, single batch request)
        try {
            const records = await DatabaseService.GetRecords();
            const allStats = aggregateAllDailyStatsWithRecords(records);
            if (allStats.size > 0) {
                const stats = Array.from(allStats.entries()).map(
                    ([date, { count, duration, records: recordDetails }]) => ({ date, count, duration, records: recordDetails })
                );
                await batchReportDailyStats(baseUrl, uuid, deviceId, stats);
            }
        } catch {
            // Non-fatal: stats will be reported on next timer tick
        }

        startTimer();
        return result.nickname;
    }, [saveConfig, startTimer]);

    // Disable online feature
    const disableOnline = useCallback(async (): Promise<void> => {
        const config = getOnlineConfig();
        if (config.uuid !== null) {
            try {
                await deleteAccount(config.baseUrl, config.uuid);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn("[OnlineService] Failed to delete account:", message);
                // Continue clearing local config even if server delete fails
            }
        }

        stopTimer();

        const newState: IOnlineState = {
            enabled: false,
            uuid: null,
            nickname: null,
            baseUrl: config.baseUrl,
            deviceId: config.deviceId, // Preserve device_id when disabling
        };

        if (mountedRef.current) {
            setOnlineState(newState);
        }
        saveConfig(newState);
    }, [saveConfig, stopTimer]);

    // Re-roll nickname
    const rerollNicknameAction = useCallback(async (): Promise<string> => {
        const config = getOnlineConfig();
        if (config.uuid === null) {
            throw new Error("在线功能未启用");
        }

        const result = await rerollNickname(config.baseUrl, config.uuid);

        const newState: IOnlineState = {
            enabled: config.enabled,
            uuid: config.uuid,
            nickname: result.nickname,
            baseUrl: config.baseUrl,
            deviceId: config.deviceId,
        };

        if (mountedRef.current) {
            setOnlineState(newState);
        }
        saveConfig(newState);

        return result.nickname;
    }, [saveConfig]);

    // Fetch daily ranking
    const fetchDailyRanking = useCallback(
        async (date?: string, limit?: number, offset?: number, sort?: "count" | "duration"): Promise<IRankingResponse> => {
            const config = getOnlineConfig();
            if (config.uuid === null) {
                throw new Error("在线功能未启用");
            }
            return getDailyRanking(config.baseUrl, config.uuid, date, limit, offset, sort);
        },
        []
    );

    // Fetch weekly ranking
    const fetchWeeklyRanking = useCallback(
        async (week?: string, limit?: number, offset?: number, sort?: "count" | "duration"): Promise<IRankingResponse> => {
            const config = getOnlineConfig();
            if (config.uuid === null) {
                throw new Error("在线功能未启用");
            }
            return getWeeklyRanking(config.baseUrl, config.uuid, week, limit, offset, sort);
        },
        []
    );

    // On mount: start timer if enabled, report stats
    useEffect(() => {
        mountedRef.current = true;
        const config = getOnlineConfig();
        if (config.enabled && config.uuid !== null) {
            // Report on app launch
            void reportStats();
            startTimer();
        }

        return () => {
            mountedRef.current = false;
            stopTimer();
        };
    }, [reportStats, startTimer, stopTimer]);

    // Listen for record updates and trigger a debounced report
    useEffect(() => {
        const unsubscribe = DatabaseService.OnRecordsUpdated(() => {
            // Mark dirty so OnlineView knows to re-report on next mount
            dirtyRef.current = true;
            const config = getOnlineConfig();
            if (config.enabled && config.uuid !== null) {
                if (debounceRef.current !== null) {
                    clearTimeout(debounceRef.current);
                }
                debounceRef.current = setTimeout(() => {
                    void reportStats();
                }, 5000);
            }
        });

        return () => {
            unsubscribe();
            if (debounceRef.current !== null) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [reportStats]);

    // Read dirty state (caller checks before reporting)
    const isDirty = useCallback((): boolean => dirtyRef.current, []);

    // Reset dirty state (caller resets before reportStats to handle concurrent updates)
    const resetDirty = useCallback((): void => { dirtyRef.current = false; }, []);

    return {
        onlineState,
        enableOnline,
        disableOnline,
        rerollNickname: rerollNicknameAction,
        reportStats,
        fetchDailyRanking,
        fetchWeeklyRanking,
        isDirty,
        resetDirty,
    };
}
