# Research: Registration and Data Reporting Flow

- **Query**: What happens when a user enables online mode and registers? Does the app report existing local data? What triggers data reporting?
- **Scope**: internal
- **Date**: 2026-05-30

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/renderer/hooks/useOnlineService.ts` | Core online service hook — registration, reporting, timer logic |
| `src/renderer/views/OnlineView.tsx` | Online ranking UI (read-only, no registration logic) |
| `src/renderer/views/Settings.tsx` | Settings UI — calls `onEnableOnline` callback |
| `src/renderer/App.tsx` | Wires `enableOnline` from hook to Settings props (line 276) |
| `packages/core/src/leaderboardStorage.ts` | Local config persistence (localStorage), UUID generation |
| `packages/core/src/leaderboardClient.ts` | HTTP API client — `registerLeaderboard`, `reportDailyStats`, etc. |
| `packages/core/src/leaderboardAggregation.ts` | `aggregateDailyStats` — filters records to a single date |
| `packages/core/src/index.ts` | Barrel exports for core package |
| `packages/shared/src/ILeaderboard.ts` | Shared types: `IOnlineConfig`, `IRegisterRequest`, `IReportRequest`, etc. |
| `src/renderer/services/DatabaseService.ts` | Renderer-side DB access via IPC; `OnRecordsUpdated` event |
| `src/preload/index.ts` | Preload bridge — exposes `electronAPI` including `OnRecordsUpdated` |
| `worker/src/index.ts` | Server-side Cloudflare Worker — Hono API with D1 database |

### 1. Registration Flow

**Entry point**: User clicks enable in Settings view, which calls `enableOnline()` from `useOnlineService.ts` (line 90).

**Steps**:
1. `generateUUID()` generates a UUID v4 (`packages/core/src/leaderboardStorage.ts:7-18`)
2. Reads existing `baseUrl` from local config
3. Calls `registerLeaderboard(baseUrl, uuid)` — POST `/api/v1/register` with `{ uuid }` (`packages/core/src/leaderboardClient.ts:65-76`)
4. **Server** (`worker/src/index.ts:110-137`):
   - Checks if UUID already exists in D1 `users` table
   - If exists: returns existing nickname (idempotent)
   - If new: generates nickname via `generateNickname()`, inserts into `users` table, returns nickname
5. Client creates `IOnlineState` with `enabled: true`, uuid, nickname, baseUrl
6. Saves to localStorage via `setOnlineConfig()`

### 2. Initial Data Report After Registration — YES, Today Only

After successful registration, `enableOnline()` immediately reports **today's** local data (lines 109-119):

```typescript
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
```

**Critical finding**: `aggregateDailyStats` (`packages/core/src/leaderboardAggregation.ts:87-100`) filters ALL local records to only those matching the given date string. So only **today's** records are reported. Historical data (previous days/weeks) is NEVER reported.

### 3. All Triggers for Data Reporting

Four triggers exist in `useOnlineService.ts`:

| Trigger | Location | When | What is reported |
|---|---|---|---|
| **On registration** | Lines 109-119 in `enableOnline()` | One-time, right after successful register | Today's stats only |
| **On app launch** | Lines 178-191 `useEffect` | If `config.enabled && config.uuid !== null` at mount | Today's stats only |
| **Periodic timer** | Lines 72-79, started at line 121 and 185 | Every 2 hours (`REPORT_INTERVAL_MS = 2 * 60 * 60 * 1000`) | Today's stats only |
| **On record changes** | Lines 194-214 `useEffect` with `OnRecordsUpdated` listener | Debounced 5 seconds after any record change | Today's stats only |

### 4. What `reportStats()` Actually Does (lines 52-69)

1. Checks `config.enabled` and `config.uuid !== null`
2. Fetches ALL local records via `DatabaseService.GetRecords()`
3. Aggregates to today's date only: `aggregateDailyStats(records, today)`
4. If `count > 0`, sends POST `/api/v1/report` with `{ date, count, duration }`
5. Server does UPSERT into `daily_stats` table (`worker/src/index.ts:164-169`)

### 5. Server-Side Report Handling

The server (`worker/src/index.ts:139-176`) performs an UPSERT:
```sql
INSERT INTO daily_stats (uuid, date, count, duration, updated_at)
VALUES (?, ?, ?, ?, datetime('now'))
ON CONFLICT (uuid, date)
DO UPDATE SET count = ?, duration = ?, updated_at = datetime('now')
```

This means each report overwrites the previous value for that user+date combination. There is no append/accumulation — it is a full replacement of the day's stats.

## Caveats / Not Found

- **No historical sync**: The app has NO mechanism to report data from previous days. If a user has been using the app offline for weeks, only today's data is sent after registration. All historical data is lost from the leaderboard perspective.
- **No IPC handlers file**: The task mentioned `src/main/ipcHandlers.ts` but this file does not exist. IPC handlers are likely split across multiple files in `src/main/`.
- **No spec files**: No spec documents found for the leaderboard/online feature under `.trellis/spec/`.
