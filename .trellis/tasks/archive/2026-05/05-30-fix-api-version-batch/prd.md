# PRD: Fix API Versioning and D1 Batch Transaction

## Overview

修复代码审查中发现的两个 Medium 级别问题：
1. M1: API 版本控制（发版前最后机会）
2. M3: 删除账户使用 D1 batch 确保原子性

## Requirements

### M1: API 版本控制

**问题**：所有路由都是 `/api/...`，没有版本号。发版后无法做 breaking changes。

**修改**：
- 所有路由从 `/api/...` 改为 `/api/v1/...`
- 涉及文件：`worker/src/index.ts`
- 前端客户端 `packages/core/src/leaderboardClient.ts` 也需要同步更新

**路由清单**：
- `POST /api/register` → `POST /api/v1/register`
- `POST /api/report` → `POST /api/v1/report`
- `GET /api/ranking/daily` → `GET /api/v1/ranking/daily`
- `GET /api/ranking/weekly` → `GET /api/v1/ranking/weekly`
- `DELETE /api/account` → `DELETE /api/v1/account`

### M3: D1 Batch 事务

**问题**：删除账户时先删 daily_stats 再删 users，两个操作不是原子的。

**修改**：
- 使用 `c.env.DB.batch()` 替代两个独立的 `.run()`
- 涉及文件：`worker/src/index.ts`

**当前代码**：
```typescript
await c.env.DB.prepare('DELETE FROM daily_stats WHERE uuid = ?').bind(auth.uuid).run();
await c.env.DB.prepare('DELETE FROM users WHERE uuid = ?').bind(auth.uuid).run();
```

**目标代码**：
```typescript
await c.env.DB.batch([
  c.env.DB.prepare('DELETE FROM daily_stats WHERE uuid = ?').bind(auth.uuid),
  c.env.DB.prepare('DELETE FROM users WHERE uuid = ?').bind(auth.uuid),
]);
```

## Out of Scope

- M2（分页参数验证）- 不修改
- 其他 Low 优先级问题

## Success Criteria

- [ ] 所有 API 路由使用 `/api/v1/` 前缀
- [ ] 前端客户端同步更新路径
- [ ] 删除账户使用 D1 batch
- [ ] typecheck 通过
- [ ] lint 通过
