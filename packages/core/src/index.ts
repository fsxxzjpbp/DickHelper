export {
    CANONICAL_EXPORT_VERSION,
    RECORDS_TABLE_NAME,
    RECORD_ID_COLUMN_NAME,
    RECORD_START_TIME_COLUMN_NAME,
    RECORD_END_TIME_COLUMN_NAME,
    RECORD_DURATION_COLUMN_NAME,
    RECORD_NOTES_COLUMN_NAME,
    RECORD_DELETED_COLUMN_NAME,
    RECORD_DELETED_AT_COLUMN_NAME,
    SETTINGS_TABLE_NAME,
    SETTINGS_KEY_COLUMN_NAME,
    SETTINGS_VALUE_COLUMN_NAME,
} from "./schema";
export { ExportRecordsToJson, GetRecordIdStatistics, ParseImportJson } from "./recordImportExport";
export {
    registerLeaderboard,
    rerollNickname,
    batchReportDailyStats,
    getDailyRanking,
    getWeeklyRanking,
    deleteAccount,
} from "./leaderboardClient";
export {
    getDateInUTC8,
    getCurrentWeekUTC8,
    getWeekDates,
    aggregateDailyStats,
    aggregateAllDailyStats,
    aggregateAllDailyStatsWithRecords,
} from "./leaderboardAggregation";
export type { IDailyRecordDetail, IDailyStatsWithRecords } from "./leaderboardAggregation";
export {
    generateUUID,
    getOnlineConfig,
    setOnlineConfig,
} from "./leaderboardStorage";
export { AnalyzePrediction } from "./prediction";
export type {
    IPredictionAnalysis,
    PredictionConfidenceLevel,
    PredictionFallbackReason,
    PredictionStatus,
} from "./prediction";
