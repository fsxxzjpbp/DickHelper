import { useMemo } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { MobileDatabaseService } from "../services/MobileDatabaseService";

export function useMobileDatabaseService(): MobileDatabaseService {
    const db = useSQLiteContext();
    return useMemo(() => new MobileDatabaseService(db), [db]);
}
