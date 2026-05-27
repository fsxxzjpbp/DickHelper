# Mobile Implementation

> Code-spec entry point for DickHelper mobile development.

Mobile implementation work is governed by `docs/mobile-implementation-contract.md`. APK-only update work for Android is part of the approved mobile scope; this spec exists so Trellis-loaded frontend context points future agents to that contract and the mobile release workflow before they write code.

---

## Scenario: Phase 1 Mobile App

### 1. Scope / Trigger

Read this spec whenever a task:

- Creates or edits the Expo React Native mobile app.
- Adds or changes cross-platform record/data import logic.
- Changes workspace layout for `apps/*` or `packages/*`.
- Touches mobile SQLite schema, JSON import/export, or record validation.
- Touches the Android APK update manifest, startup/manual update checks, or APK install handoff.
- Modifies `.github/workflows/android-release.yml` or mobile release tag/asset naming.

### 2. Signatures

Authoritative contract document:

```text
docs/mobile-implementation-contract.md
```

Required Phase 1 target paths:

```text
apps/mobile/**
packages/shared/**
packages/core/**
```

Canonical JSON export boundary:

```typescript
interface IMobileExportV1 {
    version: 1;
    records: IRecordRaw[];
}
```

Canonical import result:

```typescript
interface IImportResult {
    Imported: number;
    Skipped: number;
    Rejected: number;
}
```

Record identity boundary:

```typescript
interface IRecordRaw {
    Id: string; // runtime validation must reject empty or whitespace-only values
}
```

Canonical mobile update manifest:

```typescript
interface IMobileUpdateManifest {
    version: string;
    versionCode: number;
    publishedAt: string;
    notes: string;
    apkUrl: string;
    apkSha256: string;
    force?: boolean;
}
```

### 3. Contracts

- Mobile app code belongs under `apps/mobile/**`.
- Existing Electron root `src/**` may remain in place during Phase 1, but mobile code must not be added there.
- Cross-platform types belong in `packages/shared/**`.
- Cross-platform pure data logic belongs in `packages/core/**`.
- Current desktop JSON and record semantics are the Phase 1 authority for mobile compatibility.
- Mobile Phase 1 is Android-only; iOS build support is explicitly out of scope.
- APK-only update checks, downloads, and installer handoff are in scope for Android and must not be rejected as post-phase work.
- Expo OTA / EAS Update is out of scope; the approved solution is APK-only.
- If update source switching is implemented, manifest fetch and APK download must stay on the same selected source.
- `mobile-vX.Y.Z` and `mobile-latest` must be published with `latest=false`, so mobile never occupies GitHub repo Latest.
- Mobile update discovery must read the fixed `mobile-latest/mobile-update.json` manifest; it must not enumerate mobile releases.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| A task touches mobile implementation | Read `docs/mobile-implementation-contract.md` before coding |
| Mobile code is proposed under root `src/**` | Reject and move it under `apps/mobile/**` |
| Import/export logic is implemented outside `packages/core` | Reject or refactor into `packages/core` |
| New JSON format diverges from desktop v1 | Reject unless the implementation contract is updated first |
| Canonical `Id` or legacy `id` is empty or whitespace-only | Reject the record and increment `Rejected` |
| Agent suggests SecureStore, LAN sync, Expo OTA, or iOS build support in Phase 1 | Reject as out of scope |
| Agent rejects APK-only update checks, downloads, or release metadata work as out of scope | Reject that rejection; the contract now approves mobile APK updates |
| Agent routes mobile update discovery through `releases/latest` or a release list | Reject; mobile is fixed to `mobile-latest/mobile-update.json` |

### 5. Good/Base/Bad Cases

- Good: `apps/mobile` imports record validation and JSON conversion from `packages/core`.
- Base: Existing Electron code remains in root `src/**` while new mobile code lives in `apps/mobile/**`.
- Bad: A mobile screen duplicates JSON import/export parsing locally instead of using `packages/core`.

### 6. Tests Required

Phase 1 mobile implementation must add and run `packages/core` unit tests for:

- Canonical v1 JSON export.
- Canonical v1 JSON import.
- Legacy top-level array import.
- Legacy `startTime` to new `EndTime` mapping.
- Rejected malformed records.
- Rejected empty or whitespace-only `Id` values for canonical and legacy imports.
- Duplicate `Id` skip behavior.
- Schema constants for `Records` and `Settings`.
- `android-release.yml` syntax validation when release workflow or asset naming changes.
- `mobile-update.json` / `mobile-latest` asset checks when release metadata changes.

### 7. Wrong vs Correct

#### Wrong

```text
src/mobile/App.tsx
src/renderer/mobileImportJson.ts
NormalizeId(value) accepts ""
```

#### Correct

```text
apps/mobile/app/(tabs)/index.tsx
packages/core/src/recordImportExport.ts
NormalizeId(value) rejects "" and "   "
```

---

## Required Reading

Before implementing mobile work, read:

1. `docs/mobile-architecture.md`
2. `docs/mobile-implementation-contract.md`
3. `.trellis/spec/frontend/mobile-implementation.md`

---

## Scenario: Mobile CI & Release

### 1. Scope / Trigger

Read this section when adding or modifying:

- `.github/workflows/android-release.yml` (mobile APK build)
- `.github/workflows/release.yml` (desktop Electron build)
- Auto-update URLs or release tag conventions
- Android signing/keystore management in CI

### 2. Signatures

**Git tag conventions:**

```text
desktop-v<MAJOR>.<MINOR>.<PATCH>   → Electron release workflow
mobile-v<MAJOR>.<MINOR>.<PATCH>    → Android APK release workflow
mobile-latest                      → stable Android update channel
desktop-latest                     → stable desktop update channel
```

**Auto-update feed URLs:**

```typescript
// src/main/updateService.ts
const DIRECT_UPDATE_FEED_URL = "https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/";
```

```text
https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/mobile-update.json
https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/DickHelper-mobile-latest.apk
```

```yaml
# electron-builder.yml
publish:
  provider: generic
  url: https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/
```

**CI signing secret names:**

| GitHub Secret | Injected as | Usage |
|---------------|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | decoded to `apps/mobile/release.keystore` | Keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | env `KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | env `KEY_ALIAS` | Key alias name |
| `ANDROID_KEY_PASSWORD` | env `KEY_PASSWORD` | Key password |

### 3. Contracts

- `android-release.yml` triggers on `mobile-v*.*.*` tags, **not** on `v*.*.*`.
- `release.yml` triggers on `desktop-v*.*.*` tags, **not** on `v*.*.*`.
- After each desktop release, `desktop-latest` lightweight tag **must** be force-pushed to point to the new release tag. This is done by the `release.yml` publish-release job.
- Desktop auto-update MUST use the `desktop-latest` tag URL, never `releases/latest`, to prevent mobile releases from breaking desktop update checks.
- Mobile auto-update MUST use the `mobile-latest` tag/release URL, never `releases/latest`, to keep the mobile channel stable and isolated.
- Mobile releases are formal releases, not prereleases, and they must be published with `latest=false`.
- Mobile releases must be published with `latest=false`, so they never occupy GitHub repo Latest UI.
- `android-release.yml` must publish both the versioned `mobile-vX.Y.Z` release and the stable `mobile-latest` asset set.
- The stable mobile asset set must include `mobile-update.json`, the latest APK asset, and an explicit `apkSha256` (either embedded in the manifest or provided separately).
- Android signing config is **injected at CI time** via a Node.js script (not sed). The script runs after `expo prebuild` and before `assembleRelease`.
- `apps/mobile/android/` is gitignored — CI **must** run `npx expo prebuild --platform android` before Gradle.
- `*.keystore` and `*.jks` are gitignored — keystore files must never be committed.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| Push `mobile-v*` tag before `desktop-v*.*.*` is first published with updated feed URL | Warn — desktop auto-update can break for old clients |
| `ANDROID_KEYSTORE_BASE64` secret is empty or missing | CI fails with explicit error before Gradle runs |
| Signing injection modifies wrong `signingConfigs.debug` occurrence | Release APK is signed with debug key — CI verification grep must catch this |
| `desktop-latest` tag update fails (e.g., no force-push permission) | Release is still published, but auto-update points to stale version |
| `mobile-latest` asset upload fails | Versioned mobile release still publishes, but the stable update channel is stale |
| `mobile-update.json` SHA256 does not match the uploaded APK | Release should be treated as invalid and not promoted as the stable channel |
| Mobile release is created without `latest=false` | Reject; the release can steal GitHub repo Latest from desktop |

### 5. Good/Base/Bad Cases

- Good: Push `desktop-v2.0.6` → CI builds, publishes release, force-pushes `desktop-latest` → push `mobile-v0.0.1` → CI builds APK, publishes the versioned `mobile-v0.0.1` release plus the `mobile-latest` manifest/APK assets. Both channels stay isolated.
- Base: `releases/latest` URL used for auto-update — works until the mobile release channel needs to stay isolated.
- Bad: Keystore password hardcoded in `build.gradle` or workflow YAML — leaks credentials in git history.
- Bad: Mobile updater loops through release listings to find an APK — discovery must stay on the fixed manifest.

### 6. Tests Required

Before merging CI workflow changes, verify:

- `android-release.yml` YAML syntax is valid (`python -c "import yaml; yaml.safe_load(open('.github/workflows/android-release.yml'))"`)
- `release.yml` YAML syntax is valid
- Signing injection Node.js script correctly modifies a sample `build.gradle` (second `signingConfigs.debug` → `signingConfigs.release`, first unchanged)
- `updateService.ts` TypeScript compiles without errors
- `mobile-update.json` and `mobile-latest` asset names match the documented convention.
- `mobile-v*` and `mobile-latest` are created/edited with `latest=false`.

### 7. Wrong vs Correct

#### Wrong

```yaml
# release.yml uses old tags — conflicts with mobile releases
on:
  push:
    tags: ["v*.*.*"]

# updateService.ts points to `releases/latest` — breaks when mobile release is latest
const URL = "https://github.com/.../releases/latest/download/";
```

#### Correct

```yaml
# release.yml — desktop-only trigger
on:
  push:
    tags: ["desktop-v*.*.*"]

# android-release.yml — mobile-only trigger
on:
  push:
    tags: ["mobile-v*.*.*"]
```

```typescript
// updateService.ts — pinned to desktop channel
const URL = "https://github.com/.../releases/download/desktop-latest/";
```
