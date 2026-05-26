import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { IRecord } from "@dickhelper/shared";
import { useMobileDatabaseService } from "./useMobileDatabaseService";

export interface IUseRecordsResult {
    readonly records: IRecord[];
    readonly loading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

export function useRecords(): IUseRecordsResult {
    const database = useMobileDatabaseService();
    const [records, setRecords] = useState<IRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const hasLoadedRef = useRef<boolean>(false);

    const LoadRecords = useCallback(
        async (showLoading: boolean): Promise<void> => {
            if (showLoading) {
                setLoading(true);
            }

            try {
                const nextRecords = await database.GetRecords();
                setRecords(nextRecords);
                setError(null);
            } catch (caught: unknown) {
                const message = caught instanceof Error ? caught.message : String(caught);
                setError(message);
            } finally {
                if (showLoading) {
                    setLoading(false);
                }
            }
        },
        [database]
    );

    const refresh = useCallback(async (): Promise<void> => {
        await LoadRecords(false);
    }, [LoadRecords]);

    useEffect(() => {
        void LoadRecords(true);
    }, [LoadRecords]);

    useFocusEffect(
        useCallback(() => {
            if (hasLoadedRef.current) {
                void refresh();
            } else {
                hasLoadedRef.current = true;
            }
        }, [refresh])
    );

    return {
        records,
        loading,
        error,
        refresh,
    };
}
