# Desktop Codebase Patterns

## Main Process Architecture

- Entry: `src/main/index.ts` — singletons for mainWindow, tray, databaseService, updateService
- Startup: `DatabaseService.create()` → `InitProxy()` → `new UpdateService()` → `RegisterIpcHandlers()` → `CreateWindow()` → `CreateTray()`
- IPC: flat `RegisterIpcHandlers()` function, `ipcMain.handle(channel, handler)`, naming `"namespace:action"`
- Push to renderer: `mainWindow.webContents.send("records-updated")`

## New Module Pattern (UpdateService analog)

Create `src/main/syncService.ts`:
- Constructor takes `databaseService` reference
- Methods: `Start(port)`, `Stop()`, `GetStatus()`
- Instantiated in `app.whenReady()` after database creation
- IPC channels: `sync:start`, `sync:stop`, `sync:get-status`

## Database API (main process)

- `GetRecords()` → all records ordered by EndTime DESC
- `ImportRecords(records)` → bulk insert with `RecordExists(id)` dedup, returns `IImportResult`
- `RecordExists(id)` → boolean existence check

## Preload Bridge Pattern

- Add methods to `electronAPI` object in `src/preload/index.ts`
- Add type signatures in `src/preload/index.d.ts`
- Pattern: `MethodName: (args) => ipcRenderer.invoke("channel", args)`

## Renderer Service Pattern

- Static class with `GetApi()` returning `window.electronAPI`
- Static methods delegate to preload API

## Settings

- Stored in SQLite Settings table (key-value)
- `ALLOWED_AI_SETTING_KEYS` set in `src/main/index.ts` needs sync keys added
- Or create dedicated IPC channels like update service does

## UI (Settings page)

- Mantine 7, Paper/Stack/Group layout, `maw={760} mx="auto"`
- Sections: Data Management, AI Config, App Update, About
- Sync section can be added following same pattern

## IP Detection

- `os.networkInterfaces()` — enumerate all interfaces
- Filter loopback (127.x), virtual (VMware, WSL, Docker, VPN)
- Show remaining IPv4 addresses to user
