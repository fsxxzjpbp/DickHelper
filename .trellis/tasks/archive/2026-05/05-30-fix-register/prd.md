# Fix: 注册后不自动上报历史本地数据到排行榜

## Goal

用户注册排行榜后，只有当天的数据被上报到服务端。历史数据（本周其他天的记录）从未同步，导致排行榜和"我的本周数据"显示 0 次。

## What I already know

- `enableOnline()` 注册后只调用一次 `reportStats()`，该函数只聚合当天数据
- `aggregateDailyStats(records, today)` 按给定日期过滤，只返回当天的 count/duration
- 服务端 `/api/v1/report` 接受单日数据（UPSERT），不支持批量
- 排行榜只有"每日"和"每周"两种维度
- 每周排行按 ISO 周（周一到周日）聚合

## Requirements

- 每次上报都做全量同步：聚合本地所有记录按日期分组，逐日上报
- 服务端 UPSERT 天然幂等，重复上报不会产生重复数据
- 同步间隔从 2 小时改为 12 小时（1000 用户 × 2 次/天 × 30 天 = 6 万次，安全）
- 所有触发点（注册、启动、定时、记录变更）都走同一个全量上报逻辑

## Acceptance Criteria

- [ ] 用户开启在线功能后，本周所有有记录的天都出现在排行榜中
- [ ] "我的本周数据"显示正确的总次数和总时长
- [ ] 如果用户之前已经开启过在线功能（幂等），重复开启不会产生多余请求

## Out of Scope

- 批量上报 API 端点（当前单日 UPSERT 足够，循环调用即可）
- 历史数据的增量同步（首次全量同步后，后续只同步当天）

## Technical Notes

- `packages/core/src/leaderboardAggregation.ts` — 需要新增按周聚合的函数，或改造现有函数支持多日
- `src/renderer/hooks/useOnlineService.ts` — `enableOnline()` 中的上报逻辑需要改为同步本周所有天
- `packages/core/src/leaderboardClient.ts` — `reportDailyStats` 已支持单日上报，循环调用即可
- 服务端无需改动
