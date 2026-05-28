# Auto Update

> electron-updater with generic provider — dual-source updates, user-controlled download, and runtime source switching.

---

## Overview

The app uses `electron-updater` with the `generic` provider to fetch updates. Two update sources are supported — GitHub direct and a ghfast.top mirror — and users can switch between them at runtime without restarting. Update checks happen on startup and on manual trigger from the Settings page.

- **Library**: `electron-updater` (generic provider)
- **Location**: `src/main/updateService.ts` — all update logic in one `UpdateService` class
- **Access pattern**: Renderer → IPC invoke → Main handler → UpdateService method → electron-updater

---

## Tech Stack Decision: Generic Provider

The app uses the `generic` provider rather than `electron-updater`'s built-in `github` provider:

```typescript
this._autoUpdater.setFeedURL({
    provider: "generic",
    url: this.GetFeedUrl(this._source),
});
```

> **WHY generic over github**: The `github` provider hard-codes `api.github.com` as the update feed URL. The `generic` provider accepts an arbitrary URL, which enables runtime switching between the direct GitHub releases URL and the ghfast.top mirror. Chinese users who cannot reach GitHub directly can switch to the mirror without a restart.

---

## Update Sources

Two update feed URLs are defined as constants:

```typescript
const DIRECT_UPDATE_FEED_URL = "https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/";
const MIRROR_UPDATE_FEED_URL = `https://ghfast.top/${DIRECT_UPDATE_FEED_URL}`;
```

| Source key | Label in UI | Feed URL | Use case |
|-----------|-------------|----------|----------|
| `"mirror"` (default) | ghfast 镜像 | `https://ghfast.top/https://github.com/.../releases/download/desktop-latest/` | Users behind restrictive networks |
| `"github"` | GitHub 直连 | `https://github.com/.../releases/download/desktop-latest/` | Users with direct GitHub access |

The mirror URL is constructed by prefixing the direct URL with `https://ghfast.top/`. ghfast.top is a GitHub release acceleration proxy that forwards the `latest.yml` and installer files.

> **WHY `desktop-latest` tag instead of `/releases/latest/download/`**: This repo has both desktop and mobile releases. GitHub's `/releases/latest/download/` redirects to the most recent release overall, which could be a mobile release. Using a dedicated `desktop-latest` tag with its own GitHub Release ensures the URL always points to the latest desktop build. The release workflow creates/updates both the git tag and the GitHub Release for `desktop-latest` on every desktop release.

### Source Persistence

The selected source is saved to `update-settings.json` in `app.getPath("userData")` and loaded on next startup:

```typescript
interface IUpdateConfig {
    Source: UpdateSource;
}

// Load
const rawConfig = JSON.parse(fs.readFileSync(this._configPath, "utf-8"));

// Save
fs.writeFileSync(this._configPath, JSON.stringify(config, null, 2), "utf-8");
```

The default source is `"mirror"`.

---

## Update Lifecycle

### State Machine

```
idle ──► checking ──► available ──► downloading ──► downloaded ──► (quitAndInstall)
  │                      │                │
  │                      ▼                ▼
  │                  not-available      error
  │
  └── disabled (dev mode)
```

### State Type

```typescript
type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error"
    | "disabled";
```

### State Interface

```typescript
interface IUpdateState {
    readonly Status: UpdateStatus;
    readonly Source: UpdateSource;
    readonly CurrentVersion: string;
    readonly AvailableVersion: string | null;
    readonly DownloadProgress: number | null;
    readonly ErrorMessage: string | null;
    readonly IsChecking: boolean;
    readonly IsUpdateAvailable: boolean;
    readonly IsDownloading: boolean;
    readonly IsUpdateDownloaded: boolean;
}
```

### Transitions

| Event | From | To | Trigger |
|-------|------|----|---------|
| Start | — | `idle` (or `disabled` in dev) | Constructor |
| Check requested | `idle`, `not-available`, `error` | `checking` | User clicks "检查更新" or `StartStartupCheck()` |
| Update found | `checking` | `available` | electron-updater `update-available` event |
| No update | `checking` | `not-available` | electron-updater `update-not-available` event |
| Download requested | `available` | `downloading` | User clicks "下载更新" |
| Download progress | `downloading` | `downloading` | electron-updater `download-progress` event |
| Download complete | `downloading` | `downloaded` | electron-updater `update-downloaded` event |
| Install | `downloaded` | — | User clicks "重启安装" → `quitAndInstall()` |
| Error | any active state | `error` | electron-updater `error` event |
| Source changed | any | `idle` (or `disabled`) | User switches update source in UI |

---

## Key Design Decisions

### autoDownload: false

```typescript
this._autoUpdater.autoDownload = false;
this._autoUpdater.autoInstallOnAppQuit = false;
```

> **WHY user-controlled download**: The update flow is: check → notify user of new version → user decides to download → download → user decides to install. This respects user bandwidth and prevents unexpected background downloads. The user sees the new version number before committing to a download.

### Dev Mode Disabled

```typescript
if (!app.isPackaged) {
    this.UpdateState({ Status: "disabled", ErrorMessage: "开发模式不检查更新" });
}
```

> **WHY disabled in dev**: In development, `electron-updater` would try to find a `latest.yml` at the dev URL root, which doesn't exist. Additionally, the dev version reported by `app.getVersion()` is the version from `package.json`, which would incorrectly match against release versions. All update operations (`CheckForUpdates`, `DownloadUpdate`) gate on `app.isPackaged` and return early in dev mode.

### Source Switching Cancels Download

When the user switches update sources, any in-progress download is cancelled:

```typescript
public SetSource(source: string): IUpdateSettings {
    this.CancelDownload();
    // ... reconfigure feed URL and reset state
}
```

> **WHY cancel on source switch**: The download was started against the old feed URL. Switching sources changes where the installer binary will come from, so the in-progress download is stale and must be discarded.

---

## Download Cancellation

Downloads use `CancellationToken` from `builder-util-runtime`:

```typescript
import { CancellationToken } from "builder-util-runtime";

// Start download
const cancellationToken = new CancellationToken();
this._downloadCancellationToken = cancellationToken;
await this._autoUpdater.downloadUpdate(cancellationToken);

// Cancel
this._downloadCancellationToken.cancel();
this._downloadCancellationToken.dispose();
```

A monotonically increasing `_downloadOperationId` guards against stale callbacks: if `CancelDownload()` increments the ID, the old download's `catch` block sees a mismatched ID and suppresses the error (since it was an intentional cancellation, not a real failure):

```typescript
private CancelDownload(): void {
    this._downloadOperationId++;
    this._downloadCancellationToken.cancel();
    this._downloadCancellationToken.dispose();
    this._downloadCancellationToken = null;
}
```

Cancellation errors (message `"cancelled"`) are filtered in the `error` event handler and the download catch block — they never surface as update errors to the user.

---

## IPC Channels

All update-related IPC channels follow the `updates:<action>` pattern:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `updates:get-state` | invoke | Fetch current `IUpdateState` |
| `updates:get-settings` | invoke | Fetch `IUpdateSettings` (source, feed URL, proxy state) |
| `updates:set-source` | invoke | Change update source (`"mirror"` or `"github"`) |
| `updates:set-proxy` | invoke | Enable/disable system proxy for update traffic |
| `updates:check` | invoke | Trigger update check |
| `updates:download` | invoke | Start downloading the available update |
| `updates:install` | invoke | Install the downloaded update (`quitAndInstall`) |
| `updates:state-changed` | push (main→renderer) | Reactive state broadcast whenever `_state` changes |

### State Push Pattern

Every state mutation calls `SendState()`, which sends the full `IUpdateState` to the renderer via `webContents.send`. The renderer's `useUpdateState` hook listens for this event:

```typescript
private SendState(): void {
    const mainWindow = this._getMainWindow();
    if (mainWindow === null || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("updates:state-changed", this.GetState());
}
```

> **WHY push instead of poll**: The renderer does not need to poll for state changes. The main process pushes state on every transition, and the renderer simply updates its React state in the event listener. This keeps the UI always in sync with the actual update status.

---

## Data Flow (End to End)

### Startup Check

```
app.whenReady()
  └─ updateService = new UpdateService(...)
  └─ updateService.StartStartupCheck()
      └─ CheckForUpdates()
          └─ ConfigureFeedUrl() → setFeedURL({ provider: "generic", url: mirror/github })
          └─ UpdateState({ Status: "checking" })
          └─ autoUpdater.checkForUpdates()
              ├─ "update-available" → UpdateState({ Status: "available", AvailableVersion: info.version })
              └─ "update-not-available" → UpdateState({ Status: "not-available" })
```

### Manual Check

```
Settings UI: user clicks "检查更新"
  └─ UpdateService.CheckForUpdates() via IPC "updates:check"
      └─ [same flow as startup check]
  └─ State pushed to renderer via "updates:state-changed"
```

### Download and Install

```
Settings UI: user clicks "下载更新" (visible when Status === "available")
  └─ UpdateService.DownloadUpdate() via IPC "updates:download"
      └─ Create CancellationToken
      └─ autoUpdater.downloadUpdate(cancellationToken)
          ├─ "download-progress" → UpdateState({ DownloadProgress: percent })
          └─ "update-downloaded" → UpdateState({ Status: "downloaded" })
  └─ Settings UI: user clicks "重启安装" (visible when Status === "downloaded")
      └─ UpdateService.InstallUpdate() via IPC "updates:install"
          └─ autoUpdater.quitAndInstall(false, true)
```

---

## electron-updater Feed Requirements

The `generic` provider expects the following files at the feed URL:

| File | Purpose |
|------|---------|
| `latest.yml` | Version manifest (version, release date, file list, SHA512 hashes) |
| `DickHelper-{version}-{os}-{arch}.exe` (or `.dmg`, `.AppImage`) | Installer binary |

The exact filenames are determined by electron-builder's artifact naming and the `latest.yml` manifest. The `updateService.ts` does not construct the binary filename — electron-updater reads it from `latest.yml`.

---

## Common Mistakes

1. **Trying to use `github` provider for dual-source** — The `github` provider hard-codes `api.github.com`. For runtime source switching, the `generic` provider is required.
2. **Not calling `setFeedURL` before `checkForUpdates`** — Changing `this._source` without calling `ConfigureFeedUrl()` means the old feed URL is still active.
3. **Not gating on `app.isPackaged`** — Dev mode must skip all update operations; otherwise `checkForUpdates` hits a non-existent `latest.yml` and produces confusing errors.
4. **Not filtering cancellation errors** — Without the `IsCancellationError` check in the error handler, user-triggered cancellations would show as "update failed" errors.
