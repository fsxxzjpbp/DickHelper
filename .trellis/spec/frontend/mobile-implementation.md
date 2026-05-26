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
- Duplicate `Id` skip behavior.
- Schema constants for `Records` and `Settings`.

### 7. Wrong vs Correct

#### Wrong

```text
src/mobile/App.tsx
src/renderer/mobileImportJson.ts
```

#### Correct

```text
apps/mobile/app/(tabs)/index.tsx
packages/core/src/recordImportExport.ts
```

---

## Required Reading

Before implementing mobile work, read:

1. `docs/mobile-architecture.md`
2. `docs/mobile-implementation-contract.md`
3. `.trellis/spec/frontend/mobile-implementation.md`
