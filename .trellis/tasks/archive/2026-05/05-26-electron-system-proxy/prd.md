# PRD: Electron 应用支持系统代理

## 背景

DickHelper 是一个 Electron 桌面应用。自动更新功能提供两个更新源：GitHub 官方源和 ghfast.top 镜像源（中国大陆默认）。部分用户有代理软件，选择 GitHub 官方源时需要应用走系统代理才能正常下载更新。

当前代码完全没有代理配置：`electron-updater` 直连、AI API 请求 (`fetch`) 也不走系统代理。

## 需求

1. **启动时自动检测系统代理** — 如果系统代理已配置，所有网络请求自动走系统代理
2. **设置页增加代理开关** — 用户可手动关闭代理（逃生舱），默认开启（auto）
3. **全网络栈覆盖** — Chromium 层（fetch、渲染进程）和 Node.js 层（electron-updater）均应走代理

## 范围

### 涉及文件

| 文件 | 变更 |
|------|------|
| `src/main/index.ts` | 启动时初始化代理配置 |
| `src/main/updateService.ts` | 无直接变更（已有 feed URL 机制），但需验证 updater 是否走 Chromium 代理 |
| `src/main/ai-service.ts` | 无变更（`fetch` 自动走 Chromium 代理） |
| `packages/shared/src/IUpdate.ts` | `IUpdateSettings` 新增 `ProxyEnabled` 字段 |
| `src/main/ipc` 或 `src/main/index.ts` | 新增 `updates:set-proxy` IPC handler |
| `src/preload/index.ts` | 暴露 `SetUpdateProxy` / `GetUpdateProxy` |
| `src/preload/index.d.ts` | 类型声明同步 |
| `src/renderer/services/UpdateService.ts` | 新增 `SetProxy` / `GetProxy` 方法 |
| `src/renderer/views/Settings.tsx` | 新增代理开关 UI |

### 不在范围

- 不提供手动填写代理地址的功能（仅系统代理检测 + 开关）
- 不修改 CI/CD 流程
- 不影响非 Electron 场景

## 技术方案

### 1. Chromium 层代理（fetch、渲染进程 XHR）

使用 Electron 原生 API：

```ts
// 启用系统代理
session.defaultSession.setProxy({ mode: 'system' });
// 关闭代理
session.defaultSession.setProxy({ mode: 'direct' });
```

`session.setProxy()` 是 Electron 级别的配置，持久化到 userData 目录的 `Session Storage` 中，应用重启后保持。这覆盖了 AI API 调用 (`fetch`)、渲染进程所有网络请求。

### 2. electron-updater 层代理

`electron-updater` 使用 `builder-util-runtime` 的 `HttpExecutor`，底层为 Node.js `http`/`https` 模块，不自动使用 Chromium 代理。

两种处理方式：
- **方案 A**：检测到系统代理配置后，设置 `process.env.HTTP_PROXY` / `HTTPS_PROXY`（Node.js 原生支持）
- **方案 B**：确认 `electron-updater` 版本是否已切到 Electron `net` 模块

优先验证方案 B（如果 updater 已用 `net` 模块则无需额外处理），否则采用方案 A。

### 3. 系统代理检测

启动时通过 `session.defaultSession.resolveProxy('https://github.com')` 检测：
- 返回 `"DIRECT"` → 无系统代理
- 返回其他（如 `"PROXY 127.0.0.1:7890"`）→ 系统代理已配置

### 4. 设置持久化

复用现有 `settings:get/set` IPC 通道，新增 key `proxy_enabled`（值为 `"true"` / `"false"`，默认 `"true"`）。

### 5. 设置页面开关

在 Settings 页面的「应用更新」区块内新增 Switch：
- 标签：「使用系统代理」
- 默认：开启
- 关闭时：所有请求直连

## 数据流

```
App 启动
  → 读取 proxy_enabled 设置（默认 true）
  → 若 true: session.setProxy({ mode: 'system' })
  → 若 false: session.setProxy({ mode: 'direct' })

用户切换开关
  → renderer 调用 SetSetting("proxy_enabled", "true"/"false")
  → 主进程 IPC handler 更新数据库 + 立即 setProxy()
  → 下次请求生效
```

## 非功能需求

- 切换代理开关无需重启应用（`session.setProxy` 即时生效）
- 默认开启（auto），新用户无感
