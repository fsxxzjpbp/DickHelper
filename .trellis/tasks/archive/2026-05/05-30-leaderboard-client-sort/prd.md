# Leaderboard client: add sort parameter support

## Goal

同步后端 ranking API 的变更，更新客户端类型定义和调用函数，支持 `sort` 参数和 `stats` 响应字段。

## Requirements

- `ILeaderboard.ts` 新增 `IRankingStats` 接口（`avgCount`, `avgDuration`）
- `IRankingResponse` 新增 `stats: IRankingStats` 字段
- `getDailyRanking` 和 `getWeeklyRanking` 函数新增可选 `sort` 参数（`'count'` | `'duration'`）

## Acceptance Criteria

- [ ] `IRankingStats` 接口定义正确
- [ ] `IRankingResponse` 包含 `stats` 字段
- [ ] `getDailyRanking` 支持 `sort` 参数
- [ ] `getWeeklyRanking` 支持 `sort` 参数
- [ ] TypeScript 编译通过

## Definition of Done

- 类型定义与后端响应结构一致
- 调用函数参数与后端 API 一致

## Technical Notes

- 共享类型：`packages/shared/src/ILeaderboard.ts`
- 客户端调用：`packages/core/src/leaderboardClient.ts`
- 后端已实现：`worker/src/index.ts`（`sort` 参数 + `stats` 字段）
