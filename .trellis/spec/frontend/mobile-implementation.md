# Mobile Implementation

> Code-spec entry point for DickHelper mobile development.

Mobile implementation work is governed by `docs/mobile-implementation-contract.md`. This spec file exists so Trellis-loaded frontend context points future agents to that contract before they write code.

---

## Scenario: Phase 1 Mobile App

### 1. Scope / Trigger

Read this spec whenever a task:

- Creates or edits the Expo React Native mobile app.
- Adds or changes cross-platform record/data import logic.
- Changes workspace layout for `apps/*` or `packages/*`.
- Touches mobile SQLite schema, JSON import/export, or record validation.

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

### 3. Contracts

- Mobile app code belongs under `apps/mobile/**`.
- Existing Electron root `src/**` may remain in place during Phase 1, but mobile code must not be added there.
- Cross-platform types belong in `packages/shared/**`.
- Cross-platform pure data logic belongs in `packages/core/**`.
- Current desktop JSON and record semantics are the Phase 1 authority for mobile compatibility.
- Mobile Phase 1 is Android-only; iOS build support is explicitly out of scope.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|-----------|-------------------|
| A task touches mobile implementation | Read `docs/mobile-implementation-contract.md` before coding |
| Mobile code is proposed under root `src/**` | Reject and move it under `apps/mobile/**` |
| Import/export logic is implemented outside `packages/core` | Reject or refactor into `packages/core` |
| New JSON format diverges from desktop v1 | Reject unless the implementation contract is updated first |
| Canonical `Id` or legacy `id` is empty or whitespace-only | Reject the record and increment `Rejected` |
| Agent suggests SecureStore, LAN sync, APK self-update, or iOS build support in Phase 1 | Reject as out of scope |

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
```

**Auto-update feed URLs:**

```typescript
// src/main/updateService.ts
const DIRECT_UPDATE_FEED_URL = "https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/";
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

### 5. Good/Base/Bad Cases

- Good: Push `desktop-v2.0.6` → CI builds, publishes release, force-pushes `desktop-latest` → push `mobile-v0.0.1` → CI builds APK, publishes separate release. Both channels isolated.
- Base: `releases/latest` URL used for auto-update — works until first mobile release breaks it.
- Bad: Keystore password hardcoded in `build.gradle` or workflow YAML — leaks credentials in git history.

### 6. Tests Required

Before merging CI workflow changes, verify:

- `android-release.yml` YAML syntax is valid (`python -c "import yaml; yaml.safe_load(open('.github/workflows/android-release.yml'))"`)
- `release.yml` YAML syntax is valid
- Signing injection Node.js script correctly modifies a sample `build.gradle` (second `signingConfigs.debug` → `signingConfigs.release`, first unchanged)
- `updateService.ts` TypeScript compiles without errors

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
