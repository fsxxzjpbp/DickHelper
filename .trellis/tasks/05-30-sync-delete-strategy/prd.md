# 设计数据删除与多端同步策略

## Goal

在 Workers 服务器后端尚未上线的窗口期，实现软删除机制和 LAN 同步删除传播，并为排行榜多设备冲突预留扩展能力。

## Requirements

### R1. 软删除机制
- Records 表新增 `Deleted INTEGER DEFAULT 0` 和 `DeletedAt TEXT` 字段
- `DeleteRecord()` 改为软删除：设置 `Deleted=1, DeletedAt=当前时间`
- 所有查询默认加 `WHERE Deleted = 0`（不含已删除记录）
- `ClearAll()` 改为软删除全部记录，而非物理删除
- 提供回收站 UI：显示已删除记录，支持单条恢复

### R2. LAN 同步删除传播
- 同步时交换所有记录（含墓碑，即 `Deleted=1` 的记录）
- 合并规则：
  - 本地无此记录 → 插入（无论是否已删除）
  - 本地有此记录，对方 `Deleted=1` → 本地标记为 `Deleted=1`
  - 本地有此记录，对方 `Deleted=0` → 保持本地状态不变
- 恢复不传播：一端恢复不影响另一端的删除状态（各端独立操作）

### R3. 排行榜适配
- 聚合函数 `aggregateAllDailyStats()` 加 `WHERE Deleted = 0` 条件
- 已删除记录不参与 count 和 duration 计算
- `daily_stats` 表新增 `records_detail TEXT` 列（JSON 数组，存储每条记录的 `{id, duration}`）
- `daily_stats` 表新增 `device_id TEXT` 列，主键改为 `(uuid, device_id, date)`
- 每个设备首次启动生成随机 `device_id`（UUID），存本地 Settings 表
- `POST /api/v1/report/batch` 请求体新增 `device_id` 和 `records` 字段
- 排行榜查询时，按 uuid 聚合所有 device_id 的 records_detail，取并集（按 id 去重），用并集的 count 和 duration 作为最终值
- 设备端 `aggregateAllDailyStats()` 输出每条记录的 UUID，随聚合数据一起上报

### R4. 客户端兼容
- 客户端不做 breaking change
- 同步协议兼容旧客户端：旧客户端发来的记录没有 `Deleted` 字段时，默认视为 `Deleted=0`
- Workers/D1 后端可以做 breaking change（尚未上线）

## Acceptance Criteria

- [ ] 桌面端删除记录后，LAN 同步能传播到移动端
- [ ] 移动端删除记录后，LAN 同步能传播到桌面端
- [ ] 删除的记录不出现在主列表，出现在回收站
- [ ] 回收站支持恢复单条记录
- [ ] 排行榜聚合不包含已删除记录
- [ ] 旧客户端（无 Deleted 字段）同步时不报错
- [ ] 数据库迁移：已有记录的 Deleted 默认为 0
- [ ] 排行榜上报包含 record_ids，服务器正确存储
- [ ] 多设备上报同一天数据时，服务器取 record_ids 并集计算正确 count

## Definition of Done

- 所有 Acceptance Criteria 通过
- Lint / typecheck / CI 绿灯
- 桌面端和移动端的数据库 schema 一致
- 同步协议文档更新

## Out of Scope

- 云端单条记录存储（排行榜继续只存聚合数据，但新增 record_ids 字段）
- 恢复操作的跨设备传播
- 设置同步
- 自动 LAN 同步（保持手动模式）

## Technical Approach

### 数据库 Schema 变更

Records 表新增两列：
```sql
ALTER TABLE Records ADD COLUMN Deleted INTEGER DEFAULT 0;
ALTER TABLE Records ADD COLUMN DeletedAt TEXT;
```

桌面端（sql.js）和移动端（expo-sqlite）都需要执行此迁移。

### 同步协议变更

`POST /api/sync` 请求和响应的 records JSON 中，每条记录新增 `Deleted` 和 `DeletedAt` 字段。

`ImportRecords()` / `ImportFromJson()` 的合并逻辑变更：
- 现有：`INSERT OR IGNORE`（UUID 已存在则跳过）
- 新增：如果 UUID 已存在且对方 `Deleted=1`，执行 `UPDATE SET Deleted=1, DeletedAt=?`

### 排行榜聚合变更

`aggregateAllDailyStats()` 的 SQL 查询加 `WHERE Deleted = 0`。聚合结果新增 `record_ids` 字段（当天所有记录的 UUID 数组）。

### 排行榜服务器变更

D1 `daily_stats` 表新增 `records_detail TEXT` 列：
```sql
ALTER TABLE daily_stats ADD COLUMN records_detail TEXT;
```

`POST /api/v1/report/batch` 请求体扩展：
```json
{
  "stats": [
    { "date": "2026-05-30", "count": 3, "duration": 45.5, "records": [{ "id": "uuid1", "duration": 10 }, { "id": "uuid2", "duration": 15 }, { "id": "uuid3", "duration": 20.5 }] }
  ]
}
```

排行榜查询合并逻辑：
1. 获取同一天所有设备上报的 `records` 数组
2. 按 id 取并集（去重），同一 id 的 duration 取最新值
3. 并集的长度作为最终 count
4. 并集的 duration 之和作为最终 duration

## Technical Notes

- `packages/core/src/schema.ts` 定义表名和列名常量，需同步更新
- `packages/shared/src/IRecord.ts` 的 `IRecord` 和 `IRecordRaw` 接口需加 `Deleted` 和 `DeletedAt` 字段
- `packages/shared/src/IMobileExport.ts` 的 `IMobileExportV1` 格式需兼容新字段
- 桌面端 `src/main/database.ts` 的 `DeleteRecord()`、`ClearAll()`、`GetAllRecords()`、`ImportRecords()` 需修改
- 移动端 `apps/mobile/src/services/MobileDatabaseService.ts` 的对应方法需修改
- LAN 同步 `src/main/syncService.ts` 和 `apps/mobile/src/services/MobileSyncService.ts` 需修改
- 排行榜聚合 `packages/core/src/leaderboardAggregation.ts` 需修改
- 删除 UI `src/renderer/views/HistoryList.tsx` 需增加回收站入口

## Decision (ADR-lite)

**Context**: 多端同步场景下，本地删除不会传播到其他设备，导致已删除记录在下次同步时"复活"。同时排行榜基于全量聚合上报，多设备删除后数据不一致。

**Decision**:
1. 引入软删除 + 墓碑机制，LAN 同步时传播删除标记
2. 恢复不传播（各端独立操作），降低复杂度
3. 排行榜聚合排除已删除记录，多设备 ID 列表合并延后到移动端接入时实现

**Consequences**:
- 删除操作需要两步（软删除 + 回收站清空），但数据安全性更高
- 恢复需要各端独立操作，用户体验上多一步
- 墓碑记录会占用存储空间，直到用户清空回收站
- 未来扩展云端同步时，软删除方案可直接复用
