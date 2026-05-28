import { useState, useEffect, useCallback, useRef } from "react";
import type { IRankingResponse } from "@dickhelper/shared";
import {
    generateUUID,
    getOnlineConfig,
    setOnlineConfig,
    registerLeaderboard,
    reportDailyStats,
    getDailyRanking,
    getWeeklyRanking,
    deleteAccount,
    aggregateDailyStats,
    getDateInUTC8,
} from "@dickhelper/core";
import { DatabaseService } from "../services/DatabaseService";

const REPORT_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

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

    // Report stats to the server
    const reportStats = useCallback(async (): Promise<void> => {
        const config = getOnlineConfig();
        if (!config.enabled || config.uuid === null) return;

        try {
            const records = await DatabaseService.GetRecords();
            const today = getDateInUTC8(new Date());
            const { count, duration } = aggregateDailyStats(records, today);

            if (count > 0) {
                await reportDailyStats(config.baseUrl, config.uuid, today, count, duration);
                console.log("[OnlineService] Stats reported:", { date: today, count, duration });
            }
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

        // Report initial stats
        try {
            const records = await DatabaseService.GetRecords();
            const today = getDateInUTC8(new Date());
            const { count, duration } = aggregateDailyStats(records, today);
            if (count > 0) {
                await reportDailyStats(baseUrl, uuid, today, count, duration);
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

    // Fetch daily ranking
    const fetchDailyRanking = useCallback(
        async (date?: string, limit?: number, offset?: number): Promise<IRankingResponse> => {
            const config = getOnlineConfig();
            if (config.uuid === null) {
                throw new Error("在线功能未启用");
            }
            return getDailyRanking(config.baseUrl, config.uuid, date, limit, offset);
        },
        []
    );

    // Fetch weekly ranking
    const fetchWeeklyRanking = useCallback(
        async (week?: string, limit?: number, offset?: number): Promise<IRankingResponse> => {
            const config = getOnlineConfig();
            if (config.uuid === null) {
                throw new Error("在线功能未启用");
            }
            return getWeeklyRanking(config.baseUrl, config.uuid, week, limit, offset);
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
        reportStats,
        fetchDailyRanking,
        fetchWeeklyRanking,
    };
}
