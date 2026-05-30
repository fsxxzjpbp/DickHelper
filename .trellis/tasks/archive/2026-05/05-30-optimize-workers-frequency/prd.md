# 优化 Workers 调用频率，减少不必要的请求

## Goal

当前 Cloudflare Workers Free Plan 每天 10 万次请求。单用户一天测试就产生 560 次请求，如果上线后有 100 个日活用户，一天就是 56000 次，接近限额。需要从客户端优化请求频率，确保在合理用户量下不触达限额。

## What I already know

### 问题根源（已从代码 + 用户反馈确认）

**主要来源：排行榜切换无缓存（占 560 次的大部分）**

`OnlineView.tsx` 中 `loadRanking` 的依赖链：
```
useCallback 依赖 [period, rankingType, fetchDailyRanking, fetchWeeklyRanking]
  → useEffect 依赖 [loadRanking, reportStats]
    → period/rankingType 变化 → loadRanking 重建 → useEffect 重执行 → 真实网络请求
```

每次点击切换日/周榜、次数/时长排行 = 1 次 Workers 请求，UI 卡顿。无任何缓存。

**次要来源：OnlineView 挂载时无条件上报**

`OnlineView` 在 `App.tsx:268` 是条件渲染：
```tsx
{activeView === "online" && <OnlineView ... />}
```
每次切到排行榜标签页 → 组件重新 mount → `reportStats()`（全量上报）+ `loadRanking(0)` = 2 次请求。即使数据没变化也上报。

### 请求来源完整表

| 触发场景 | 请求 | 文件:行 | 频率 | 日请求数估算 |
|---|---|---|---|---|
| **切换排行类型/周期** | `getDailyRanking`/`getWeeklyRanking` | `OnlineView.tsx:113` | **高频** | **主要来源** |
| 打开 OnlineView（mount） | `reportStats` + `getDailyRanking` | `OnlineView.tsx:107-111` | 每次切标签页 | 中等 |
| App 启动（online enabled） | `batchReportDailyStats` | `useOnlineService.ts:218` | 每次启动 | 低 |
| `records-updated` IPC 事件 | `batchReportDailyStats`（5s debounce） | `useOnlineService.ts:236-238` | 记录变化时 | 低 |
| 翻页 | `getDailyRanking`/`getWeeklyRanking` | `OnlineView.tsx:121-126` | 翻页时 | 低 |
| 启用在线 | `registerLeaderboard` + `batchReportDailyStats` | `useOnlineService.ts:101,124` | 一次性 | 极低 |
| 禁用在线 | `deleteAccount` | `useOnlineService.ts:139` | 一次性 | 极低 |
| 换昵称 | `rerollNickname` | `useOnlineService.ts:170` | 极少 | 极低 |

### 关键代码特征

- **无 ranking 缓存**：每次切 tab/切周期都重新请求，即使数据完全一样
- **无 dirty tracking**：`reportStats` 不知道数据是否有变化，无条件全量上报
- **全量上报**：`batchReportDailyStats` 每次发送所有天的所有记录（KB 级，保持不变）
- **后端无限流**：worker 没有 rate limiting

## Requirements (evolving)

### 优先级 1：Ranking 请求缓存（解决主要问题）

1. **Ranking 结果内存缓存**：以 `period + rankingType + offset + date/week` 为 key，缓存排行榜数据
2. **缓存 TTL**：2 分钟内同参数请求直接返回缓存，不发网络请求
3. **手动刷新按钮绕过缓存**：点击"刷新"按钮时忽略缓存，强制请求

### 优先级 2：消除无意义的 reportStats

4. **Dirty flag 机制**：记录本地数据自上次上报后是否变化，没变化则跳过 reportStats
5. **OnlineView mount 时检查 dirty**：只在 dirty 时才调用 reportStats

### 设计约束

- **始终全量上报**：每次 reportStats 发送所有天的完整数据，不做增量。数据量小（KB 级），全量更简单可靠
- 优化方向仅限"控制何时上报"，不改变"上报什么"

### Corner Case 处理

- **#3 reportStats 失败**：`try { ...; dirtyRef.current = false } catch {}` — 失败不重置 dirty，下次 mount 再试
- **#4 上报期间有新记录**：在 OnlineView mount 的 useEffect 里，`await reportStats()` **之前**重置 dirty（而非 reportStats 成功后）。如果上报期间 records-updated 触发 → dirty 设回 true → 下次 mount 再报。最坏漏报一次，12h 定时器兜底
- **其余 corner case**：自然处理，无需额外代码

## Acceptance Criteria (evolving)

- [ ] 日/周、次数/时长切换不产生重复网络请求（5 分钟内同参数走缓存）
- [ ] 点击"刷新"按钮时绕过缓存，强制获取最新数据
- [ ] OnlineView 挂载时，数据没变化不触发 reportStats
- [ ] 单用户一天正常使用（记录 3-10 次，查看排行 5-10 次，切换 20-30 次）产生的 Workers 请求数 ≤ 30
- [ ] 不改变现有功能行为和用户体验（排行榜数据一致性不受影响）
- [ ] 不引入新的外部依赖
- [ ] lint / typecheck 通过

## Definition of Done

- [ ] 所有 Acceptance Criteria 满足
- [ ] lint / typecheck 通过
- [ ] 代码改动有清晰的注释说明优化策略
- [ ] 无 breaking changes

## Out of Scope

- **增量上报**：不做，始终全量上报
- Worker 后端 rate limiting（可单独做，不阻塞客户端优化）
- 排行榜功能的 UI 改动
- 移动端优化（移动端目前不调 Workers）
- 离线队列 / 离线支持

## Technical Notes

- `useOnlineService.ts` 是所有 Workers 调用的唯一入口（通过 `leaderboardClient.ts`）
- `records-updated` IPC 事件由 `src/main/index.ts` 在每次 mutation 后发送（SaveRecord, DeleteRecord, ClearAll, RestoreRecord, PurgeDeleted, ImportRecords）
- `aggregateAllDailyStatsWithRecords` 遍历所有 records 按天聚合
- Workers 的 `batchReportDailyStats` 后端用 `ON CONFLICT DO UPDATE`（upsert），天然支持幂等
- Ranking 缓存应放在 `useOnlineService` hook 或 `leaderboardClient.ts` 中
- Dirty flag 应在 `useOnlineService` hook 中维护，监听 `records-updated` 事件设置 dirty
