# Research: Electron System Proxy & electron-updater

- **Query**: How to configure system proxy for electron-updater in Electron 35+
- **Scope**: external (Electron docs, electron-builder source)
- **Date**: 2026-05-26

## Key Finding: electron-updater uses its own Session

`electron-updater` v6+ does NOT use Node.js `http` module. It uses `ElectronHttpExecutor`, which calls `electron.net.request()` with a **separate partition**:

```ts
// electron-updater/src/electronHttpExecutor.ts
export function getNetSession(): Session {
    return require("electron").session.fromPartition("electron-updater", { cache: false });
}
```

This means `session.defaultSession.setProxy({ mode: 'system' })` affects the renderer/BrowserWindow but **NOT** electron-updater.

## Answers by Question

### 1. How `session.setProxy({ mode: 'system' })` works

- Applies to one specific Chromium session (NOT globally)
- `mode: 'system'` reads OS proxy config (Windows Settings / macOS Network / Linux env vars)
- All requests through that session (fetch, XHR, `net.request`) go through system proxy
- Electron stores sessions by partition name; each has independent proxy config

### 2. Does electron-updater respect defaultSession proxy?

**No.** It uses partition `"electron-updater"`, which has its own proxy config (defaults to `DIRECT`).

### 3. How to make electron-updater go through system proxy

**Recommended approach** -- apply proxy to the updater's session:

```js
const { session } = require('electron');

// Enable system proxy for auto-updater
session.fromPartition('electron-updater').setProxy({ mode: 'system' });
```

**Important**: Call `forceReloadProxyConfig()` before checking/downloading to pick up any recent OS proxy changes:

```js
session.fromPartition('electron-updater').forceReloadProxyConfig();
```

**NOT effective**: Setting `HTTP_PROXY`/`HTTPS_PROXY` env vars. `builder-util-runtime`'s `configureRequestOptions()` does NOT read them. It only sets auth/cache headers (source: httpExecutor.ts L557-593).

### 4. Detecting whether system proxy is configured

Use `session.resolveProxy(url)`:

```js
const result = await session.fromPartition('electron-updater').resolveProxy('https://github.com');
// Returns "DIRECT" if no proxy, or e.g. "PROXY 127.0.0.1:7890" if configured
const hasProxy = result !== 'DIRECT';
```

## Relevant Source Files (upstream)

| File | Key Detail |
|------|-----------|
| `electron-updater/src/electronHttpExecutor.ts` | Uses `electron.net.request()` with partition `"electron-updater"` |
| `electron-updater/src/AppUpdater.ts:278` | `this.httpExecutor = new ElectronHttpExecutor(...)` |
| `builder-util-runtime/src/httpExecutor.ts:557` | `configureRequestOptions()` -- no proxy/env-var handling |

## Caveats

- Must call `setProxy` on the updater's session **before** `checkForUpdates()` to ensure proxy is active
- On Windows, system proxy changes require `forceReloadProxyConfig()` and possibly `closeAllConnections()`
- Proxy authentication is handled by electron-updater's `ElectronHttpExecutor` via the `login` event -- no extra config needed if the OS stores credentials
