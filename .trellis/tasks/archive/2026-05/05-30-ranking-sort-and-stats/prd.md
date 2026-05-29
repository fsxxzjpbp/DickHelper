# Ranking API: add sort parameter and server-side statistics

## Goal

排行榜 API 支持按"次数"或"时长"两种维度排名，并在响应中附带服务端计算的统计量（均值、分位数），避免客户端获取原始数据后自行计算。

## Requirements

- `GET /api/v1/ranking/daily` 和 `GET /api/v1/ranking/weekly` 新增 `sort` 查询参数
  - `sort=count`（默认）：按次数降序，时长升序作 tiebreaker
  - `sort=duration`：按时长降序，次数升序作 tiebreaker
- 响应新增 `stats` 字段，包含 `avgCount` 和 `avgDuration`（与 `sort` 无关，始终返回两个均值）
- `me.percentile` 的含义跟随 `sort` 字段变化：
  - `sort=count` 时，percentile = 次数低于自己的用户占比
  - `sort=duration` 时，percentile = 时长低于自己的用户占比
- Breaking change 可接受（项目未上线）

## Acceptance Criteria

- [ ] `sort=count` 排序正确（count DESC, duration ASC）
- [ ] `sort=duration` 排序正确（duration DESC, count ASC）
- [ ] 无效 `sort` 值返回 400 错误
- [ ] `stats` 字段包含均值
- [ ] `me.percentile` 根据 `sort` 字段动态计算
- [ ] 日榜和周榜行为一致

## Definition of Done

- Worker 后端代码通过 lint / typecheck
- DEPLOY.md API 文档更新

## Deferred (后续单独处理)

- 客户端类型定义更新（`ILeaderboard.ts`）
- 客户端调用函数支持 `sort` 参数（`leaderboardClient.ts`）

## Out of Scope

- 中位数（median）等其他统计量
- 前端 UI 排序切换（本次只做 API 层）
- 缓存 / 性能优化

## Decision (ADR-lite)

**Context**: 排行榜需要支持按次数和时长两种维度排名，并返回统计量供客户端展示。D1 (SQLite) 没有内置 MEDIAN 函数。

**Decision**: 响应中新增 `stats` 字段，仅包含均值（avgCount, avgDuration），不包含中位数。percentile 已经提供了分位数信息，均值 + percentile 足够用户了解自己的位置。

**Consequences**: 如果未来需要更精确的"中位数"统计，需要在 Worker 层用窗口函数实现，或引入缓存机制。

## Technical Notes

- 入口文件：`worker/src/index.ts`
- 类型定义：`worker/src/types.ts`
- 共享类型：`packages/shared/src/ILeaderboard.ts`
- 客户端调用：`packages/core/src/leaderboardClient.ts`
