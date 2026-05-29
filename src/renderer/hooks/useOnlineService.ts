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
    aggregateAllDailyStats,
} from "@dickhelper/core";
import { DatabaseService } from "../services/DatabaseService";

const REPORT_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface IOnlineState {
    readonly enabled: boolean;
    readonly uuid: string | null;
    readonly nickname: string | null;
    readonly baseUrl: string;
}

export function useOnlineService() {
    const [onlineState, setOnlineState] = useState<IOnlineState>(() => {
        const config = getOnlineConfig();
        return {
            enabled: config.enabled,
            uuid: config.uuid,
            nickname: config.nickname,
            baseUrl: config.baseUrl,
        };
    });

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef<boolean>(true);

    // Save config whenever onlineState changes
    const saveConfig = useCallback((state: IOnlineState): void => {
        setOnlineConfig({
            enabled: state.enabled,
            uuid: state.uuid,
            nickname: state.nickname,
            baseUrl: state.baseUrl,
        });
    }, []);

    // Report all local stats to the server (full sync, single batch request)
    const reportStats = useCallback(async (): Promise<void> => {
        const config = getOnlineConfig();
        if (!config.enabled || config.uuid === null) return;

        try {
            const records = await DatabaseService.GetRecords();
            const allStats = aggregateAllDailyStats(records);

            if (allStats.size === 0) return;

            const stats = Array.from(allStats.entries()).map(
                ([date, { count, duration }]) => ({ date, count, duration })
            );
            await batchReportDailyStats(config.baseUrl, config.uuid, stats);
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
        const baseUrl = config.baseUrl;

        const result = await registerLeaderboard(baseUrl, uuid);

        const newState: IOnlineState = {
            enabled: true,
            uuid,
            nickname: result.nickname,
            baseUrl,
        };

        if (mountedRef.current) {
            setOnlineState(newState);
        }
        saveConfig(newState);

        // Report all local stats (full sync, single batch request)
        try {
            const records = await DatabaseService.GetRecords();
            const allStats = aggregateAllDailyStats(records);
            if (allStats.size > 0) {
                const stats = Array.from(allStats.entries()).map(
                    ([date, { count, duration }]) => ({ date, count, duration })
                );
                await batchReportDailyStats(baseUrl, uuid, stats);
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

    return {
        onlineState,
        enableOnline,
        disableOnline,
        rerollNickname: rerollNicknameAction,
        reportStats,
        fetchDailyRanking,
        fetchWeeklyRanking,
    };
}
