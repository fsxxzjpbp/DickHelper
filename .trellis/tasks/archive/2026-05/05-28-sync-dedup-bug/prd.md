# P0 Fix: Desktop-Mobile Sync Dedup Logic Broken

## Goal

修复桌面端与移动端 LAN 同步时去重逻辑失效的 P0 Bug。同步后记录被无限重复，每次同步都会多出一份副本。

## Root Cause

`syncService.ts` 的 `ImportMobileRecords` 方法（line 115-142）调用 `SaveRecord()` 插入从移动端收到的记录，但 `SaveRecord()` 每次都生成新的 UUID（`randomUUID()`），丢弃了原始记录的 `Id`。导致：

1. 桌面端存入 UUID-B（本应是 UUID-A）
2. 桌面端把 UUID-B 返回给移动端
3. 移动端认为 UUID-B 是新记录，存入 → 重复
4. 每次同步增加一份副本，无限增长

**关键对比**：同一个 `database.ts` 里的 `ImportRecords()` 方法（line 277-333）正确保留了原始 `Id`，但同步流程没有调用它。

## Requirements

- `ImportMobileRecords` 必须保留传入记录的原始 `Id`
- 使用已有的 `ImportRecords()` 方法替代 `SaveRecord()` 循环
- 移动端侧无需修改（已正确使用 `INSERT OR IGNORE`）

## Acceptance Criteria

- [ ] 桌面端 0 条 + 移动端 1 条 → 同步后双方各 1 条（不重复）
- [ ] 桌面端 1 条 + 移动端 1 条（相同）→ 同步后双方各 1 条（去重成功）
- [ ] 桌面端 1 条 + 移动端 1 条（不同）→ 同步后双方各 2 条
- [ ] 连续同步两次不产生重复记录
- [ ] `npx tsc --noEmit` 无新错误

## Decision (ADR-lite)

**Context**: `ImportMobileRecords` 用 `SaveRecord()` 逐条插入，丢弃原始 Id。`ImportRecords()` 已存在且正确保留 Id。

**Decision**: 重构 `ImportMobileRecords`，将 `ParseImportJson` 解析后的 `IRecordRaw[]` 直接传给 `ImportRecords()`，删除手动循环。

**Consequences**: 修复简单，复用已有逻辑。`ImportRecords` 有自己的验证逻辑，与 `ParseImportJson` 的预验证略有重叠，但不影响正确性。

## Out of Scope

- 移动端代码修改
- 同步协议改动
- 新增单元测试（后续补充）

## Technical Notes

- `src/main/syncService.ts:115-142` — Bug 所在
- `src/main/database.ts:112-121` — `SaveRecord` 生成新 UUID
- `src/main/database.ts:277-333` — `ImportRecords` 正确保留 Id
- `packages/core/src/recordImportExport.ts` — `ParseImportJson` 返回 `IRecordRaw[]`
- 移动端 `MobileDatabaseService.ImportFromJson` 使用 `INSERT OR IGNORE`，已正确
