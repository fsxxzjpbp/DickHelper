# System Proxy

> Per-session proxy configuration for both renderer traffic and electron-updater HTTP requests — no restart required.

---

## Overview

The app supports toggling between system proxy and direct connection modes. This is critical for users who need a VPN or system proxy to reach GitHub (for updates) but also want the option to bypass proxies when not needed. The proxy setting is persisted in the database and takes effect immediately on both the default session and the electron-updater's dedicated Chromium partition.

- **Mechanism**: `session.setProxy()` (Electron Chromium API, real-time effect, no restart)
- **Scope**: Two Electron sessions — `defaultSession` and `"electron-updater"` partition
- **Persistence**: `proxy_enabled` in the Settings table of the SQLite database
- **Default**: `true` (system proxy enabled)

---

## Motivation

> **WHY proxy support at all**: The app's update feeds are hosted on GitHub. Many users in China cannot reach `github.com` directly, so they use system-level VPNs or HTTP proxies. When `proxy_enabled` is `true`, the app uses `{ mode: "system" }`, which tells Chromium to resolve the OS-level proxy settings. When users switch to a direct connection (e.g., after enabling a TUN-mode VPN or when GitHub is reachable directly), they can toggle to `{ mode: "direct" }`.

---

## Dual Session Architecture

This is the most critical design aspect. **Both sessions must be configured separately.**

```typescript
session.defaultSession.setProxy(proxyConfig);
session.fromPartition("electron-updater").setProxy(proxyConfig);
```

> **WHY two sessions**: `electron-updater` creates its own Chromium `session` using the partition name `"electron-updater"`. This session is distinct from `session.defaultSession`. The renderer process and any `fetch()` calls in the main process use `defaultSession`. The electron-updater's HTTP requests go through the `"electron-updater"` session. If only `defaultSession` is configured, electron-updater's download requests bypass the proxy and fail for users behind restrictive networks. Both must be set for the proxy to work end-to-end.

### Session Partition Internals

When `electron-updater` is initialized, it calls:

```
session.fromPartition("electron-updater", { cache: false })
```

This creates an isolated Chromium session without disk cache. The proxy setting on `defaultSession` does **not** cascade to partition sessions. Each partition is an independent browser context with its own network stack.

---

## Proxy Modes

Chromium's `session.setProxy()` supports a config object. The app uses two modes:

| Mode | Config | Behavior |
|------|--------|----------|
| System proxy (enabled) | `{ mode: "system" }` | Chromium resolves proxy settings from the OS (Windows: Internet Options; macOS: System Proxy Settings) |
| Direct (disabled) | `{ mode: "direct" }` | All connections bypass proxies entirely |

The mode is derived from the `proxy_enabled` setting:

```typescript
const proxyEnabled: boolean = databaseService.GetSetting("proxy_enabled") !== "false";
const proxyConfig: { mode: "system" | "direct" } = proxyEnabled
    ? { mode: "system" as const }
    : { mode: "direct" as const };
```

The default (`"proxy_enabled"` key not yet set in DB) evaluates to `true` because `GetSetting` returns `undefined` for missing keys, and `undefined !== "false"` is `true`.

---

## Startup Initialization

`InitProxy()` is called during `app.whenReady()`, **after** the database is initialized and **before** the update service is created and the window is shown:

```typescript
app.whenReady().then(async () => {
    databaseService = await DatabaseService.create();
    InitProxy();                              // <-- proxy configured here
    updateService = new UpdateService(...);   // <-- updater created after proxy is ready
    RegisterIpcHandlers();
    CreateWindow();
    updateService.StartStartupCheck();        // <-- first update check uses proxy
});
```

> **WHY this ordering**: `InitProxy()` must run before `StartStartupCheck()` so that the update check (which goes through the `"electron-updater"` session) already has the correct proxy configuration. If the proxy was set after the update check, the first request might fail.

The `InitProxy()` implementation:

```typescript
function InitProxy(): void {
    if (!databaseService) {
        console.error("[Main] databaseService is null, skipping proxy init");
        return;
    }

    const proxyEnabled: boolean = databaseService.GetSetting("proxy_enabled") !== "false";
    const proxyConfig: { mode: "system" | "direct" } = proxyEnabled
        ? { mode: "system" as const }
        : { mode: "direct" as const };

    session.defaultSession.setProxy(proxyConfig);
    session.fromPartition("electron-updater").setProxy(proxyConfig);
    console.log(`[Main] Proxy mode: ${proxyConfig.mode}`);
}
```

---

## Runtime Toggle (IPC)

The `updates:set-proxy` IPC handler allows the renderer to toggle proxy at runtime:

```typescript
ipcMain.handle("updates:set-proxy", (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") {
        throw new Error("参数格式错误。");
    }

    // Persist to database
    databaseService!.SetSetting("proxy_enabled", enabled ? "true" : "false");

    // Apply to both sessions
    const proxyConfig: { mode: "system" | "direct" } = enabled
        ? { mode: "system" as const }
        : { mode: "direct" as const };

    session.defaultSession.setProxy(proxyConfig);
    session.fromPartition("electron-updater").setProxy(proxyConfig);
});
```

**No restart required**: `session.setProxy()` takes effect immediately within the Chromium process. Existing connections may not be affected, but new connections (including the next update check) will use the updated proxy settings.

---

## Settings Persistence

The `proxy_enabled` setting is stored in the SQLite `Settings` table alongside other application settings:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `proxy_enabled` | TEXT (`"true"` or `"false"`) | `true` (implicit — absent key means enabled) | Whether to use system proxy |

The `updates:get-settings` handler merges the proxy state into the update settings response:

```typescript
ipcMain.handle("updates:get-settings", () => {
    const base = updateService!.GetSettings();
    const proxyEnabled: boolean = databaseService!.GetSetting("proxy_enabled") !== "false";
    return { ...base, ProxyEnabled: proxyEnabled };
});
```

---

## UI Location

The proxy toggle is in the Settings page under the "应用更新" (App Update) section, between the update source selector and the version display:

```
Settings page
  └─ 应用更新 card
      ├─ 更新源 (SegmentedControl: ghfast 镜像 / GitHub 直连)
      ├─ 使用系统代理 (Switch)           <-- proxy toggle
      ├─ 当前版本 (Text)
      ├─ 可用版本 (Text, conditional)
      ├─ Download progress (Progress, conditional)
      ├─ Error message (Alert, conditional)
      └─ Action buttons (检查更新 / 下载更新 / 重启安装)
```

The renderer loads the initial proxy state on mount and updates it on toggle:

```typescript
// Load initial state
useEffect(() => {
    UpdateService.GetProxy()
        .then(setProxyEnabled)
        .catch(() => setProxyEnabled(true));
}, []);

// Handle toggle
const HandleProxyToggle = (enabled: boolean): void => {
    setProxyEnabled(enabled);
    void UpdateService.SetProxy(enabled);
};
```

---

## Data Flow (End to End)

### Startup

```
app.whenReady()
  └─ DatabaseService.create()
  └─ InitProxy()
      └─ GetSetting("proxy_enabled") → true/false
      └─ session.defaultSession.setProxy({ mode: "system"|"direct" })
      └─ session.fromPartition("electron-updater").setProxy({ mode: "system"|"direct" })
  └─ updateService = new UpdateService(...)
  └─ updateService.StartStartupCheck()
      └─ electron-updater downloads latest.yml via "electron-updater" session
          └─ Proxy configured → request uses system proxy → reaches GitHub
```

### Runtime Toggle

```
Settings UI: user toggles Switch
  └─ UpdateService.SetProxy(true/false) via IPC "updates:set-proxy"
      └─ Main: validate enabled is boolean
      └─ Main: SetSetting("proxy_enabled", "true"/"false")
      └─ Main: setProxy on both sessions
  └─ Effect: immediate — next update check/download uses new proxy mode
```

---

## Common Mistakes

1. **Only configuring `defaultSession`** — electron-updater uses its own partition (`"electron-updater"`). If only `defaultSession` is configured, update traffic bypasses the proxy entirely. Always call `setProxy` on both sessions.
2. **Using `session.fromPartition("electron-updater")` before electron-updater creates it** — The partition exists as soon as `session.fromPartition()` is called, even before `electron-updater` uses it. This is safe.
3. **Setting proxy before database is ready** — `InitProxy()` reads `proxy_enabled` from the database. If the database is not yet initialized, the function logs an error and returns. The ordering in `app.whenReady()` ensures database creation precedes `InitProxy()`.
4. **Confusing "system" mode with a hard-coded proxy URL** — `{ mode: "system" }` tells Chromium to use the OS-level proxy settings (PAC files, WPAD, or manually configured proxies). It does **not** hard-code a specific proxy server. Users must configure their proxy at the OS level.
5. **Expecting `GetSetting("proxy_enabled")` to return `false` on first run** — On a fresh install, the key does not exist in the database, so `GetSetting` returns `undefined`. The check `!== "false"` correctly treats this as `true` (system proxy enabled by default).
