# 遥测系统（Telemetry）实现计划

## 概述

为 DickHelper 新增用户非敏感数据上报系统（遥测功能），同时支持桌面端和移动端。采用 opt-in 原则，用户手动开启后才收集和上报数据。

---

## 架构设计

### 数据流

```
客户端 (Electron / Mobile)
  → packages/core/telemetryClient.ts (共享上报逻辑)
    → Cloudflare Worker /api/v1/telemetry/events
      → D1 telemetry_events 表
```

### 分层职责

| 层 | 职责 | 文件 |
|---|---|---|
| `packages/shared` | 遥测相关 TypeScript 类型定义 | `src/ITelemetry.ts` |
| `packages/core` | 遥测客户端逻辑（事件队列、批量上报、配置存储） | `src/telemetryClient.ts`, `src/telemetryStorage.ts` |
| `worker` | 遥测 API 端点 + D1 表 | `src/index.ts` (新增路由), `migrations/` |
| `src/renderer` | 桌面端 UI（设置页开关）+ 事件采集钩子 | `views/Settings.tsx`, `hooks/useTelemetry.ts` |
| `apps/mobile` | 移动端 UI（设置页开关）+ 事件采集钩子 | `app/settings/index.tsx`, `src/hooks/useTelemetry.ts` |

---

## 上报数据定义（非敏感）

### 事件类型

| 事件名 | 触发时机 | 上报字段 |
|---|---|---|
| `app_launch` | 应用启动 | `platform`, `app_version`, `os` |
| `record_created` | 新增记录 | `duration_range`（区间，非精确值） |
| `feature_used` | 使用特定功能 | `feature_name`（如 "ai_analysis", "prediction", "export", "sync"） |

### 字段说明

- `platform`: `"desktop"` / `"mobile"` — 来源平台
- `app_version`: 应用版本号（如 `"2.0.8"`）
- `os`: 操作系统（如 `"windows"`, `"android"`, `"macos"`, `"linux"`）
- `duration_range`: 时长区间（如 `"<1min"`, `"1-5min"`, `"5-15min"`, `"15-30min"`, `">30min"`），不上传精确时长
- `feature_name`: 功能名称字符串

### 不收集的数据

- ❌ 记录的精确时间、时长、备注
- ❌ 用户输入内容
- ❌ 设备硬件信息（IMEI、序列号等）
- ❌ IP 地址（Worker 层不记录）
- ❌ 地理位置

---

## 实现步骤

### Step 1: 类型定义（packages/shared）

新增 `src/ITelemetry.ts`：

```typescript
export interface ITelemetryEvent {
  readonly event: string;
  readonly timestamp: string;       // ISO 8601
  readonly platform: "desktop" | "mobile";
  readonly app_version: string;
  readonly os: string;
  readonly properties?: Record<string, string | number | boolean>;
}

export interface ITelemetryConfig {
  readonly enabled: boolean;
  readonly uuid: string | null;     // 复用在线功能的 UUID
  readonly lastReportTime: string | null;
}
```

在 `src/index.ts` 中导出新类型。

### Step 2: 遥测客户端（packages/core）

**`src/telemetryStorage.ts`** — 配置存储（localStorage）：
- `getTelemetryConfig(): ITelemetryConfig`
- `setTelemetryConfig(config: ITelemetryConfig): void`
- 默认 `enabled: false`

**`src/telemetryClient.ts`** — 上报逻辑：
- `reportTelemetryEvents(baseUrl, uuid, events): Promise<void>` — 批量上报到 Worker
- 复用 `apiFetch` 模式（与 leaderboardClient 一致）
- 端点：`POST /api/v1/telemetry/events`

在 `src/index.ts` 中导出新函数。

### Step 3: Worker 后端

**D1 migration** (`migrations/0004_create_telemetry.sql`)：
```sql
CREATE TABLE telemetry_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid       TEXT NOT NULL,
    event      TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    platform   TEXT NOT NULL,
    app_version TEXT NOT NULL,
    os         TEXT NOT NULL,
    properties TEXT,  -- JSON string
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uuid) REFERENCES users(uuid)
);

CREATE INDEX idx_telemetry_event ON telemetry_events(event);
CREATE INDEX idx_telemetry_time ON telemetry_events(timestamp);
```

**新增 API 路由** (`src/index.ts`)：
- `POST /api/v1/telemetry/events` — 批量接收事件，需要 Bearer 认证
- 请求体：`{ events: ITelemetryEvent[] }`
- 校验：UUID 已注册、事件格式合法、单次最多 50 条
- 响应：`{ success: true, received: number }`

**新增类型** (`src/types.ts`)：
- `TelemetryEvent`, `TelemetryReportRequest`

### Step 4: 桌面端集成

**`src/renderer/hooks/useTelemetry.ts`**：
- 读写 telemetryConfig（通过 IPC settings:get/set）
- `trackEvent(event, properties?)` — 将事件加入本地队列
- 批量上报：每 30 分钟 / 应用启动时 / 队列满 20 条时
- 通过 IPC 调用 main process 执行网络请求

**`src/main/index.ts`** — 新增 IPC handler：
- `telemetry:report` — 调用 `reportTelemetryEvents`

**`src/preload/index.ts`** — 暴露新 API：
- `reportTelemetry(events)` → IPC invoke

**`src/renderer/views/Settings.tsx`** — 新增遥测开关：
- 与"在线功能"平级的 Switch
- 说明文字："帮助改进应用体验，仅收集非敏感使用数据"

**事件采集点**：
- `App.tsx` — `app_launch` 事件
- `RecordForm.tsx` — `record_created` 事件
- `StatsChart.tsx`, `Prediction.tsx`, `OnlineView.tsx` — `feature_used` 事件

### Step 5: 移动端集成

**`apps/mobile/src/hooks/useTelemetry.ts`**：
- 与桌面端逻辑一致，但使用 `MobileDatabaseService.GetSetting/SetSetting` 存储配置
- 直接调用 `reportTelemetryEvents()`（不需要 IPC）

**`apps/mobile/app/settings/index.tsx`** — 新增遥测开关

**事件采集点**：
- `app/_layout.tsx` — `app_launch` 事件
- `app/(tabs)/index.tsx` — `record_created` 事件
- 各 tab 页面 — `feature_used` 事件

---

## 关键设计决策

1. **复用在线功能 UUID**：遥测系统复用 `leaderboardStorage` 中的 UUID 和 `IOnlineConfig`，用户开启在线功能时自动获得遥测能力。但遥测开关独立于排行榜开关。
2. **事件队列 + 批量上报**：避免频繁网络请求，本地缓存事件后批量发送。
3. **时长区间化**：`record_created` 事件只上报时长区间（如 `"1-5min"`），不上报精确时长。
4. **Worker 认证**：遥测上报需要 Bearer token（UUID），确保只有注册用户可上报。
5. **完全 opt-in**：默认关闭，设置页有明确开关和说明。

---

## 文件变更清单

| 操作 | 文件 |
|---|---|
| 新增 | `packages/shared/src/ITelemetry.ts` |
| 修改 | `packages/shared/src/index.ts` |
| 新增 | `packages/core/src/telemetryStorage.ts` |
| 新增 | `packages/core/src/telemetryClient.ts` |
| 修改 | `packages/core/src/index.ts` |
| 新增 | `worker/migrations/0004_create_telemetry.sql` |
| 修改 | `worker/src/types.ts` |
| 修改 | `worker/src/index.ts` |
| 新增 | `src/renderer/hooks/useTelemetry.ts` |
| 修改 | `src/preload/index.ts` |
| 修改 | `src/preload/index.d.ts` |
| 修改 | `src/main/index.ts` |
| 修改 | `src/renderer/views/Settings.tsx` |
| 修改 | `src/renderer/App.tsx` |
| 新增 | `apps/mobile/src/hooks/useTelemetry.ts` |
| 修改 | `apps/mobile/app/settings/index.tsx` |
| 修改 | `apps/mobile/app/_layout.tsx` |

---

## 验收标准

- [ ] 用户可在设置中开启/关闭遥测
- [ ] 开启后，应用启动时上报 `app_launch` 事件
- [ ] 新增记录时上报 `record_created` 事件（含时长区间）
- [ ] 使用 AI 分析、预测、导出、同步等功能时上报 `feature_used` 事件
- [ ] 事件批量上报，不频繁请求
- [ ] 关闭遥测后不再收集和上报任何数据
- [ ] 桌面端和移动端均可用
- [ ] 不收集任何敏感数据（精确时长、备注、输入内容等）
- [ ] Lint / TypeCheck 通过
