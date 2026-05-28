# Shared Packages Analysis

## @dickhelper/shared

Types: IRecord, IRecordRaw, IStats, IDailyCount, IImportResult, IHourlyCount, IWeekdayCount, IMonthlyCount, IMobileExportV1, ILegacyRecordImportRow, IRecordImportParseResult, IRecordIdStatistics

For sync, add:
- `ISyncResponse` — `{ result: IImportResult; records: string }` (records is JSON string of IMobileExportV1)

## @dickhelper/core

Functions: ExportRecordsToJson, ParseImportJson, GetRecordIdStatistics
Schema constants: table/column names, CANONICAL_EXPORT_VERSION

Sync protocol reuses these directly:
- Request body = output of `ExportRecordsToJson()` (mobile sends its records)
- Response body = `ISyncResponse` (import result + desktop's records as JSON string)
- Both sides use `ParseImportJson()` to parse received records

## Desktop Gap

Desktop app duplicates import/export logic inline in `src/renderer/services/DatabaseService.ts` instead of using `@dickhelper/core`. NOT a blocker — the sync service runs in main process and uses `databaseService.ImportRecords()` directly, bypassing the renderer entirely.

## No New Dependencies Needed

- Desktop: Node.js native `http` + `os` modules
- Mobile: `fetch()` already available
- Both: existing `@dickhelper/core` import/export functions
