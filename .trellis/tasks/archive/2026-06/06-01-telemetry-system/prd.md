# 遥测系统（Telemetry）

## Goal

为 DickHelper 新增遥测功能，收集匿名设备活跃数据（操作系统、应用版本），用于了解用户规模和版本分布。同时支持桌面端（Electron）和移动端（Expo + React Native）。

## 决策记录

| 决策 | 结论 | 理由 |
|---|---|---|
| 默认行为 | 开启 | opt-in 没人会开，收集不到数据 |
| 首次启动 | 不弹窗 | 上报的是非敏感数据，无需告知 |
| 关闭入口 | 设置页有 | 尊重用户选择 |
| 上报事件 | 仅活跃上报 | 不收集任何和使用记录相关的数据（`record_created`、`feature_used` 暂不做） |
| UUID | 随机生成，存数据库 settings | 和在线功能解耦，不依赖硬件指纹 |
| 触发时机 | 启动时 + 每 18 小时 | 反映持续活跃 |
| 幂等 | `(uuid, date)` UPSERT | 同一天同一设备多次上报只保留最新 |
| 失败处理 | 静默忽略 | 等下一次周期重试 |
| 后端 | 现有 Cloudflare Worker 加端点 | 复用基础设施 |

## 上报数据

### 字段

| 字段 | 说明 | 示例 |
|---|---|---|
| `uuid` | 随机生成的设备标识（首次上报时生成并持久化） | `"a3f8...9b2e"` |
| `platform` | 来源平台 | `"desktop"` / `"mobile"` |
| `app_version` | 应用版本号 | `"2.0.8"` |
| `os` | 操作系统 | `"windows"`, `"macos"`, `"linux"`, `"android"` |

### 不收集的数据

- ❌ 记录的时长、次数、备注
- ❌ 用户输入内容
- ❌ 设备硬件信息（IMEI、序列号、MAC 地址等）
- ❌ IP 地址（Worker 层不记录）
- ❌ 地理位置

## 后端设计

### D1 Migration

```sql
CREATE TABLE telemetry_daily (
    uuid         TEXT NOT NULL,
    date         TEXT NOT NULL,          -- 'YYYY-MM-DD' UTC+8
    platform     TEXT NOT NULL,          -- 'desktop' / 'mobile'
    app_version  TEXT NOT NULL,
    os           TEXT NOT NULL,
    last_seen_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uuid, date)
);

CREATE INDEX idx_telemetry_date ON telemetry_daily(date);
CREATE INDEX idx_telemetry_platform ON telemetry_daily(platform);
```

### API

**POST /api/v1/telemetry/launch**

- 无需认证（UUID 由客户端生成，不需要先注册）
- 请求体：`{ uuid, platform, app_version, os }`
- 服务端按 `(uuid, date)` UPSERT，自动记录 `last_seen_at`
- 响应：`{ success: true }`
- 校验：uuid/platform/app_version/os 非空且类型正确

## 客户端设计

### 遥测配置存储

数据库 settings 表新增 key：
- `telemetry_enabled` — `"true"` / `"false"`，默认 `"true"`
- `telemetry_uuid` — 随机 UUID，首次上报时生成

### 桌面端（Electron）

**新增文件**：
- `src/renderer/hooks/useTelemetry.ts` — 遥测钩子

**修改文件**：
- `src/main/index.ts` — 新增 IPC handler `telemetry:report`
- `src/preload/index.ts` — 暴露 `reportTelemetry(config)` API
- `src/preload/index.d.ts` — 类型声明
- `src/renderer/views/Settings.tsx` — 遥测开关 UI
- `src/renderer/App.tsx` — 挂载 useTelemetry 钩子

### 移动端（Expo + React Native）

**新增文件**：
- `apps/mobile/src/hooks/useTelemetry.ts` — 遥测钩子

**修改文件**：
- `apps/mobile/app/settings/index.tsx` — 遥测开关 UI
- `apps/mobile/app/_layout.tsx` — 挂载 useTelemetry 钩子

### 共享逻辑（packages/core）

**新增文件**：
- `src/telemetryClient.ts` — 上报函数 `reportTelemetryLaunch(baseUrl, data)`

**修改文件**：
- `src/index.ts` — 导出新函数

### 共享类型（packages/shared）

**新增文件**：
- `src/ITelemetry.ts` — 遥测相关类型

**修改文件**：
- `src/index.ts` — 导出新类型

## UI 设计

### 设置页 — 遥测开关

位于设置页**最底部**。

**开启状态**：
- Switch 打开
- 显示收集的数据明牌（不含 UUID）：
  > 上报数据：操作系统（{os}）、应用版本（{version}）

**关闭操作**：
- 点击 Switch 关闭
- 弹出确认 Dialog：
  > **确认关闭遥测？**
  > 关闭后将不再上报任何数据。我们仅收集以下信息：操作系统、应用版本。不涉及任何使用记录和个人信息。
  > [取消] [确认关闭]

## 验收标准

- [ ] 默认开启遥测
- [ ] 应用启动时上报一次活跃数据
- [ ] 每 18 小时定时上报一次
- [ ] 上报失败静默忽略
- [ ] 同一天同一设备多次上报只保留最新（幂等）
- [ ] 设置页最底部显示遥测开关
- [ ] 开启状态下显示收集的数据明牌
- [ ] 关闭时弹确认窗
- [ ] 桌面端和移动端均可用
- [ ] 不收集任何敏感数据
- [ ] Lint / TypeCheck 通过

## Out of Scope

- `record_created` 事件（暂不做）
- `feature_used` 事件（暂不做）
- 硬件指纹 / 设备级持久化 UUID
- 首次启动弹窗告知
- 遥测数据的前端展示（dashboard）
