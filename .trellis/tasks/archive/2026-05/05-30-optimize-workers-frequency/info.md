# 技术设计

## 改动范围

### 1. `src/renderer/hooks/useOnlineService.ts`

**添加 dirty flag**：
- `dirtyRef = useRef<boolean>(false)` — 追踪数据是否自上次上报后有变化
- `records-updated` 监听器里设置 `dirtyRef.current = true`
- 新增 `consumeDirty()` 方法：读取并重置 dirty 状态，返回 boolean
- 新增 `resetDirty()` 方法：外部重置 dirty（OnlineView mount 时用）
- `reportStats` 本身不变，始终全量上报

**暴露给 OnlineView**：
- 返回值新增 `isDirty: () => boolean` 和 `resetDirty: () => void`

### 2. `src/renderer/views/OnlineView.tsx`

**Dirty flag 控制 reportStats**：
- mount 时的 useEffect：检查 dirty，如果 false 则跳过 reportStats
- 重置 dirty 放在 `await reportStats()` 之前（解决 corner case #4）

**Ranking 缓存**：
- `useRef<Map<string, { data: IRankingResponse, timestamp: number }>>` 作为缓存
- key = `${period}-${rankingType}-${offset}-${dateOrWeek}`
- TTL = 2 分钟
- `loadRanking` 里先查缓存，命中且未过期则直接用，不发请求
- "刷新"按钮强制跳过缓存

## 不改动的文件

- `leaderboardClient.ts` — API 层保持原样
- `leaderboardAggregation.ts` — 聚合逻辑不变
- Worker 后端 — 不改

## 命名约定

- 遵循 C# 风格：PascalCase 方法名，camelCase 局部变量
- Hook 内部用 `useRef` 存 mutable 状态
- 注释只写 WHY，不写 WHAT
