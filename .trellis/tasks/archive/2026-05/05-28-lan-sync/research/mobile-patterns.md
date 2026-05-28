# Mobile Codebase Patterns

## App Structure

- Expo SDK 56, expo-router file-based routing
- Root layout: GestureHandlerRootView → SafeAreaProvider → PaperProvider → SQLiteProvider → Stack
- Tabs: Record, Stats, Prediction, History
- Settings: nested Stack with index + ai screens

## Database Service

- `MobileDatabaseService` wraps `expo-sqlite` SQLiteDatabase
- `ExportToJson()` → fetches all records, maps to IRecordRaw, calls `ExportRecordsToJson()` from core
- `ImportFromJson(jsonText)` → calls `ParseImportJson()` from core, then `INSERT OR IGNORE` per record
- Both methods already handle the full export/import pipeline

## Network Capabilities

- `fetch()` already used in MobileUpdateService for manifest check
- `expo-file-system` for APK downloads
- No TCP/UDP/WebSocket/mDNS libraries present

## UI Patterns (react-native-paper)

- Layout: ScrollView with padding 16, Surface cards with elevation=1, borderRadius=12
- Header: headlineSmall title (teal #0f766e) + bodyMedium subtitle
- Buttons: mode="contained"/"outlined", borderRadius=12, contentStyle height 52
- Feedback: Snackbar with message state
- Settings: List.Section / List.Item / List.Subheader

## State Management

- No external state management
- `useMobileDatabaseService()` → wraps db in MobileDatabaseService (useMemo)
- `useRecords()` → GetRecords on mount, refresh on focus, exposes refresh()
- Mutation pattern: call service method → call refresh()

## Sync Integration Point

- Add sync section to settings/index.tsx
- TextInput for IP:port, Button to trigger sync
- Use `fetch()` to POST to desktop server
- Reuse `ExportToJson()` for request body, `ImportFromJson()` for response handling
