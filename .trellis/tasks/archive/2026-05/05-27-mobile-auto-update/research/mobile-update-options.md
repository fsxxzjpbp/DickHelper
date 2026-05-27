# Mobile Update Options Research

## Repo constraints

### Current desktop pattern

`src/main/updateService.ts` already implements a two-source model:

* direct GitHub
* mirror (`ghfast.top/...`)

It persists the chosen source locally and computes the effective feed URL from that source.

### Current mobile pattern

`apps/mobile/app/settings/index.tsx` currently has no update section.

`apps/mobile/src/services/MobileDatabaseService.ts` already owns a `Settings` SQLite table, so update source preferences can be stored there instead of adding a separate persistence layer.

### Release pipeline

`.github/workflows/android-release.yml` already:

* builds release APKs on `mobile-v*.*.*`
* publishes GitHub Releases
* currently marks mobile releases as `--prerelease`

This is important because a mobile updater that relies on GitHub “latest release” semantics may not match the current release strategy.

### Contract conflict

`docs/mobile-implementation-contract.md` explicitly forbids:

* APK self-update
* update source selection
* update download entry points

So any implementation must first update the contract or be treated as a post-Phase task.

## External constraints

### 1. Expo OTA updates are for JS/assets, not native binaries

Official Expo docs describe `expo-updates` as a library for remote updates to application code, and it requires an update server implementing the Expo Updates protocol. It can be configured via EAS Update or a custom server.

Implication:

* `expo-updates` is suitable for JS/UI/assets changes.
* It is not a GitHub Release APK installer.
* Native dependency / permission / manifest / Expo module changes still require a new APK build.

### 2. Expo OTA can be fairly automatic

Official EAS Update docs indicate:

* non-development builds can automatically download updates on app startup
* updates are applied after restart
* apps can also manually call `checkForUpdateAsync()`, `fetchUpdateAsync()`, and `reloadAsync()`

Implication:

* If the goal is “PC 那种自动检查，有新版本后提示用户下载/应用”，OTA is the closest equivalent on mobile.

### 3. Runtime switching of OTA source/channel is risky

Expo documents runtime override via `Updates.setUpdateURLAndRequestHeadersOverride`, but the docs mark this as something to use with caution, especially around rollback and preview use cases.

Implication:

* Exposing arbitrary OTA source switching in production settings is higher-risk than the desktop feed switch.
* If OTA is adopted, the safest default is one stable production channel, not end-user channel switching.

### 4. Android APK install is not silent for normal apps

Android documents that apps requesting package installs need `REQUEST_INSTALL_PACKAGES`, and from Android 8+ the user explicitly controls whether the app is trusted to install packages from unknown sources.

Implication:

* A GitHub Release APK updater can do:
  * check latest version
  * download APK
  * hand off to system installer
* But it cannot behave like a silent background installer for ordinary users.

## Feasible approaches

## Approach A: APK-only updater via GitHub Release manifest

### How it works

* Mobile app checks a remote JSON manifest on startup / foreground / manual action.
* Manifest contains:
  * `version`
  * `versionCode`
  * `publishedAt`
  * `notes`
  * `apkUrl`
  * `apkSha256`
  * optional `force`
* App compares remote `versionCode` with installed `versionCode`.
* If newer:
  * show “发现新版本”
  * download APK to cache using `expo-file-system`
  * launch Android installer flow

### Pros

* Closest to user’s stated GitHub Release idea
* Reuses current GitHub Actions mobile release pipeline
* Source switching is simple: manifest URL and APK URL both derive from selected base URL
* Mirrors are easy if they proxy GitHub release asset URLs

### Cons

* Not true silent auto-update
* Needs Android install permission / unknown sources flow
* Requires an installer handoff path; Expo does not give a “one-call APK install” product abstraction like desktop `quitAndInstall`
* Every bugfix still requires shipping a new APK

### Design notes

Recommended manifest URL pattern:

* Direct: `https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/mobile-update.json`
* Mirror: `https://ghfast.top/https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/mobile-update.json`

Why not `releases/latest` or GitHub REST latest API:

* Repo already separates desktop/mobile release tags and protects desktop auto-update from channel pollution.
* Current mobile releases are prereleases.
* A pinned `mobile-latest` tag or dedicated release asset is more stable and mirror-friendly.

### CI implications

Extend `android-release.yml` to also upload:

* `mobile-update.json`
* optionally checksum file

Then move/force-update a `mobile-latest` tag or dedicated release in the same way desktop uses `desktop-latest`.

## Approach B: OTA-only via expo-updates

### How it works

* Add `expo-updates`
* Configure production update URL and runtimeVersion
* Publish JS/assets updates via EAS Update or a custom Expo Updates server
* App auto-checks on launch or manually checks through Updates API

### Pros

* This is the most “automatic” user experience available in Expo
* Small bugfixes ship quickly without rebuilding the APK
* Better parity with desktop “check -> download -> apply” experience

### Cons

* Does not replace APK/native updates
* Needs EAS Update or a custom server implementing Expo Updates protocol
* Runtime source switching is not as clean as desktop mirror switching
* Introduces a second release/distribution system beyond GitHub Releases

### Mirror implications

Mirror support is not just “prefix ghfast to a GitHub URL” unless the OTA service itself is behind a controllable URL.

Feasible sub-options:

* use EAS Update and do not expose mirror switching to end users
* self-host an Expo Updates protocol server behind your own domain/CDN, then switch that domain if needed

## Approach C: Hybrid (Recommended)

### How it works

Use two update channels with different responsibilities:

* OTA via `expo-updates` for JS/assets-only fixes
* APK updater via GitHub Release manifest for native/runtime changes

UI copy should distinguish them:

* “内容更新” or “热更新” for OTA
* “新安装包” or “版本更新” for APK

### Why this is recommended

It matches the actual technical split of Expo:

* JS/assets can be updated in place
* native binary changes cannot

It also matches your current repo state:

* GitHub Release pipeline already exists
* desktop already has source-selection UX
* mobile already has settings storage

### Risks

* More moving parts than APK-only
* Need very clear UX so users understand why some updates restart the app and others open the installer
* OTA channel switching should probably stay internal/admin-only, not user-facing

## Recommended MVP

If you want the smallest credible next step:

1. Implement **APK-only updater** first.
2. Keep the desktop-like source toggle, but scope it only to:
   * update manifest
   * APK download URL
3. Use a dedicated `mobile-latest` release/tag and manifest asset.
4. Do not use GitHub “latest release” endpoints for the updater.
5. Defer OTA until the APK updater is stable.

Reason:

* it best matches your current idea
* it fits the existing release pipeline
* it keeps mirror handling simple
* it avoids introducing Expo OTA infrastructure too early

## Suggested code shape for a future implementation

### Shared types

Extend `packages/shared/src/IUpdate.ts` or add mobile-specific update types:

* `IMobileUpdateManifest`
* `MobileUpdateStatus`
* separate flags for `IsInstallerRequired`

### Mobile services

Likely new modules:

* `apps/mobile/src/services/MobileUpdateService.ts`
* `apps/mobile/src/hooks/useMobileUpdateState.ts`

### Mobile settings persistence

Persist in existing `Settings` SQLite table:

* `update_source`
* optional `update_skip_version`

### Mobile UI

Add a new settings section in `apps/mobile/app/settings/index.tsx`:

* current version
* update source selector
* check update button
* available version
* download/install action
* error state

### Native / app config needs

If doing APK installation:

* Android permission/config for package install flow
* possibly an Expo config plugin or native bridge depending on the final install handoff approach

## Decision point to confirm with user

Two sane paths:

1. **APK-only first**: GitHub Release manifest + mirror source toggle + system installer
2. **Hybrid**: APK updater first-class + OTA added for JS/assets fixes

My recommendation is **1 first, then evolve to 2**.
