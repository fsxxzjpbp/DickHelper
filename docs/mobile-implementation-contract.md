# DickHelper 移动端实现契约

> 本文档面向后续 LLM/AI 编码代理。它不是建议清单，而是实现契约。
>
> 若本文档与通用最佳实践冲突，先遵守本文档。要改变本文档中的决策，必须先修改本文档并获得人工确认。

---

## 1. 目标

移动端第一阶段只交付 **独立 Android MVP**：

- Android 作为唯一一等目标平台。
- 移动端可独立记录数据、查看历史、删除记录。
- 移动端可通过 JSON 与桌面端迁移数据。
- 移动端数据契约必须与当前 Electron 桌面端兼容。

当前移动端还不是完整跨平台同步版本，不实现局域网同步、Expo OTA/EAS Update、复杂统计图表或完整预测体验；但 Android APK-only 更新检查、下载、安装以及稳定 release 约定已经属于当前开发范围。

---

## 2. 硬禁止事项

当前禁止以下行为：

1. 禁止配置 iOS 构建流程，禁止声称 iOS 可用或保证可编译。
2. 禁止引入 `expo-secure-store`、Keychain、Keystore 或其他安全存储依赖。
3. 禁止实现历史记录滑动删除；删除必须使用显式按钮和确认弹窗。
4. 禁止实现桌面/移动局域网同步。
5. 禁止把更新方案做成 Expo OTA/EAS Update、EAS Update 或其他 JS 热更新；Android 更新必须走 APK-only 方案。
6. 禁止替换冻结技术栈。
7. 禁止把移动端 app 代码放进根目录 `src/**`。
8. 禁止绕过 `packages/core` 自己实现另一套 JSON import/export、record validation 或 schema 常量。
9. 禁止在设置页添加不可用或半成品入口，例如“同步”占位；已定义的 APK 更新入口（检查更新、下载、安装）除外。
10. 禁止让移动端更新依赖 GitHub `releases/latest`；稳定通道必须使用独立的 `mobile-latest` 约定。
11. 禁止为了“最佳实践”自动纠正本文档中的业务决策。

---

## 3. 冻结技术栈

当前必须使用：

| 领域 | 必须使用 |
|------|----------|
| 移动框架 | Expo + React Native + TypeScript |
| UI | react-native-paper |
| 路由 | expo-router |
| 本地数据库 | expo-sqlite |
| 图表 | victory-native 作为后续图表库；第一阶段不要求完整图表 |

未经本文档更新，禁止替换为：

- Bare React Native 或其他移动框架。
- NativeWind、Tamagui、纯自定义组件系统或其他 UI 库。
- 手写导航状态或替代路由架构。
- Realm、WatermelonDB、AsyncStorage-only persistence 或其他数据库方案。
- Redux、Zustand 等全局状态库。

---

## 4. Monorepo 结构

目标结构：

```text
apps/
  desktop/        # 未来迁移 Electron 桌面端；第一阶段可不存在
  mobile/         # Expo React Native app
packages/
  shared/         # 跨端 TypeScript 类型
  core/           # 跨端纯业务逻辑和数据契约
docs/
  mobile-architecture.md
  mobile-implementation-contract.md
```

当前过渡规则：

- 现有 Electron 代码可以继续保留在根目录 `src/**`。
- 新移动端代码必须放在 `apps/mobile/**`。
- 新跨端类型必须放在 `packages/shared/**`。
- 新跨端纯业务逻辑必须放在 `packages/core/**`。
- 根 `package.json` workspaces 必须扩展到包含 `apps/*` 和 `packages/*`。

---

## 5. 共享包边界

### 5.1 `packages/shared`

只放跨端类型定义，例如：

- `IRecord`
- `IRecordRaw`
- `IImportResult`
- 统计结果类型
- 设置 key 类型或 update 类型

`packages/shared` 不应访问 React、React Native、Electron、SQLite 或文件系统。

### 5.2 `packages/core`

放跨端纯逻辑和数据契约，例如：

- JSON import/export。
- record validation。
- schema/table/column 常量。
- 新旧格式转换。
- import result 统计。
- `Id` 去重规则。

`packages/core` 不应访问 React、React Native、Electron、expo-sqlite、sql.js、文件系统或网络。

---

## 6. 权威数据契约

当前桌面端数据格式是移动端 Phase 1 的权威契约。

### 6.1 Record 字段

| 字段 | 类型 | 必填 | 语义 |
|------|------|------|------|
| `Id` | string | 是 | 记录唯一 ID，去重主键 |
| `StartTime` | ISO string | 是 | 实际开始时间 |
| `EndTime` | ISO string | 是 | 实际结束时间 |
| `Duration` | number | 是 | 分钟 |
| `Notes` | string 或 null/undefined | 否 | 备注 |

边界规则：

- 存储和导出边界使用 ISO string。
- UI 和业务计算可以转换为 `Date`，但跨包/跨端数据边界不得传递裸 `Date`。
- `Duration` 单位固定为分钟，不得改为秒或毫秒。
- 去重固定使用 `Id`。

### 6.2 新版 JSON 导出格式

必须导出：

```json
{
  "version": 1,
  "records": [
    {
      "Id": "uuid-or-existing-id",
      "StartTime": "2026-05-26T10:00:00.000Z",
      "EndTime": "2026-05-26T10:05:00.000Z",
      "Duration": 5,
      "Notes": "optional"
    }
  ]
}
```

### 6.3 旧版 JSON 导入格式

必须继续接受旧版数组格式：

```json
[
  {
    "id": "uuid-or-existing-id",
    "startTime": "2026-05-26T10:05:00.000Z",
    "duration": 5,
    "notes": "optional"
  }
]
```

旧版 `startTime` 字段语义是结束时间。导入时必须映射为新版 `EndTime`，并用 `EndTime - Duration` 推导 `StartTime`。

### 6.4 SQLite schema

移动端 SQLite schema 必须保持以下语义：

```sql
CREATE TABLE IF NOT EXISTS Records (
    Id        TEXT PRIMARY KEY,
    StartTime TEXT NOT NULL,
    EndTime   TEXT NOT NULL,
    Duration  REAL NOT NULL,
    Notes     TEXT
);

CREATE TABLE IF NOT EXISTS Settings (
    Key   TEXT PRIMARY KEY,
    Value TEXT NOT NULL
);
```

不得自行改名为 snake_case、小写字段或不同表名。

### 6.5 导入结果

导入函数必须返回：

```typescript
interface IImportResult {
    Imported: number;
    Skipped: number;
    Rejected: number;
}
```

- `Imported`: 成功插入的记录数。
- `Skipped`: 因 `Id` 已存在而跳过的记录数。
- `Rejected`: 格式无效、日期无效或 duration 无效的记录数。

### 6.6 APK 更新清单

Android APK 更新必须使用独立的 `mobile-update.json` 清单，作为移动端更新的权威元数据。

清单形状如下：

```json
{
  "version": "1.2.3",
  "versionCode": 10203,
  "publishedAt": "2026-05-27T08:00:00.000Z",
  "notes": "optional release notes",
  "apkUrl": "https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/DickHelper-mobile-latest.apk",
  "apkSha256": "hex-encoded-sha256",
  "force": false
}
```

约束：

- `version` 必须与 `mobile-vX.Y.Z` release tag 对应。
- `versionCode` 必须是可比较的整数，由 release workflow 从 tag 生成。
- `publishedAt` 记录发布时间，使用 UTC ISO string。
- `notes` 是面向用户的发布说明，可为空字符串但必须存在。
- `apkUrl` 必须指向 `mobile-latest` 稳定通道下的 APK 资产，不得使用 GitHub `releases/latest`。
- `apkSha256` 必须明确存在；可以内嵌在清单里，也可以另外产出 checksum 资产，但发布物里必须可验证。
- `force` 是可选字段，仅用于标记强制升级场景。
- `mobile-vX.Y.Z` 和 `mobile-latest` 都是正式 release，不是 prerelease。
- `mobile-vX.Y.Z` 和 `mobile-latest` release 都必须显式创建/编辑为 `latest=false`，这样它们不会占用 GitHub repo Latest UI。
- Mobile 更新发现必须只读取 `mobile-latest/mobile-update.json`，不得通过枚举所有 mobile releases 来找新版本。

### 6.7 更新源与入口

如果移动端提供多个更新源，必须把 manifest 和 APK 下载视为同一条更新通道来切换：

- `github` 表示 GitHub Release 直连源。
- `mirror` 表示镜像源，必须代理同一套 `mobile-latest` 资产路径。
- 更新源选择可以持久化到 `Settings` 表，但不得让 manifest 和 APK 下载走不同源。
- 更新检查必须在启动时自动执行一次，同时也要能从设置页手动触发。
- 当有可用更新时，设置页或更新弹窗必须提供下载与安装入口，而不是只显示只读提示。
- GitHub repo Latest UI 只允许 desktop 线路占用，mobile release 不能通过 repo Latest 被发现或宣传。

---

## 7. 移动端 UI 范围

底部 Tab 必须固定为：

1. 记录
2. 统计
3. 预测
4. 历史

设置从右上角入口进入，不作为底部 Tab。

### 7.1 记录页

必须实现：

- 全屏移动端优先布局。
- 大圆形计时器或同等显著的计时显示。
- 开始、暂停、继续、结束等主操作。
- 结束后保存记录到 SQLite。
- 适合单手操作的大按钮。

### 7.2 历史页

必须实现：

- 按 `EndTime` 倒序展示记录。
- 显示时间、持续时长、备注。
- 删除按钮。
- 删除前确认弹窗。

禁止滑动删除。

### 7.3 统计页

第一阶段只做轻量实现：

- 可显示 2x2 基础指标卡，或稳定占位页。
- 不要求完整图表。
- 不要求热力图。
- 不要求 24h 分布图。

### 7.4 预测页

第一阶段只做轻量实现：

- 可显示本地简单提示，或稳定占位页。
- 不要求完整预测模型 UI。
- 不要求 AI 分析。

### 7.5 设置页

当前必须实现：

- JSON 导入。
- JSON 导出。
- 关于/版本信息。
- AI 配置入口占位。
- APK 更新卡片：当前版本、远端版本/检查状态、手动检查更新按钮。
- 可用更新时的下载与安装入口。
- 若采用多源发布，提供更新源选择，并联动 manifest 与 APK 基址。

当前禁止实现：

- 完整 AI 配置表单。
- 局域网同步入口。
- Expo OTA / EAS Update 入口。

---

## 8. 实现顺序

当前建议按以下顺序执行：

1. 调整 workspace：支持 `apps/*` 和 `packages/*`。
2. 新增 `packages/core`，实现数据契约、JSON import/export、record validation、schema constants。
3. 给 `packages/core` 添加单元测试。
4. 创建 `apps/mobile` Expo app。
5. 接入 `react-native-paper` 的 `PaperProvider`。
6. 用 `expo-router` 建立四 Tab 导航。
7. 用 `expo-sqlite` 实现 Records/Settings schema 和记录 CRUD。
8. 实现记录页和历史页。
9. 实现设置页 JSON 导入导出。
10. 实现 APK-only 更新检查、下载与安装入口，并接入 `mobile-update.json`。
11. 扩展 `.github/workflows/android-release.yml`，发布 `mobile-vX.Y.Z` 与 `mobile-latest` 两条资产线。
12. 添加统计/预测轻量页或稳定占位。
13. 运行质量门禁。

---

## 9. 质量门禁

### 9.1 必须测试 `packages/core`

必须覆盖：

- 新版 JSON export 输出 `{ version: 1, records: [...] }`。
- 新版 JSON import 接受 canonical v1 格式。
- 旧版数组格式 import 可用。
- 旧版 `startTime` 映射到新版 `EndTime`。
- `StartTime` 可由 `EndTime - Duration` 推导。
- malformed record 被拒绝。
- 重复 `Id` 被跳过。
- schema 常量保持 `Records`、`Settings`、`Id`、`StartTime`、`EndTime`、`Duration`、`Notes`、`Key`、`Value`。

### 9.2 必须运行检查

实现任务完成前必须运行：

- TypeScript type-check。
- Lint。
- `packages/core` 单元测试。
- Mobile app 基础启动或构建检查。

如果项目脚本尚不存在，实现任务必须先添加脚本，再运行；不得声称“检查通过”但没有可执行命令。

### 9.3 第一阶段不强制

- 不强制移动 UI 自动化测试。
- 不强制 Android 真机截图测试。
- 不强制 EAS Build。

### 9.4 更新发布门禁

- 修改 `.github/workflows/android-release.yml` 时必须验证 YAML 语法。
- `mobile-latest` 资产集必须至少包含 `mobile-update.json`、最新 APK 资产，以及明确的 `apkSha256`。
- 发布流程必须同时保留版本化 `mobile-vX.Y.Z` release 和稳定 `mobile-latest` release，不得让移动端和桌面端共用同一个 latest 通道。

---

## 10. 后置范围

以下能力明确后置，必须单独开任务并更新契约：

- 桌面/移动局域网同步。
- Expo OTA / EAS Update / 其他 JS 热更新方案。
- 完整统计图表。
- 24h 分布柱状图。
- 热力图。
- 完整预测页。
- AI 配置表单。
- AI 远程分析。
- iOS 构建支持。
- 将现有 Electron 根 `src/**` 迁移到 `apps/desktop/**`。

---

## 11. 实现前检查清单

后续 LLM 在写代码前必须确认：

- [ ] 已阅读 `docs/mobile-architecture.md`。
- [ ] 已阅读本文档。
- [ ] 已确认当前任务是否仍属于当前 Android/mobile 范围。
- [ ] 已确认 APK-only 更新是当前 Android 范围的一部分，不是 Expo OTA。
- [ ] 已确认更新检查会在启动时自动执行，也可从设置页手动触发。
- [ ] 已确认 `mobile-latest` 与 `mobile-update.json` 的稳定发布约定。
- [ ] 已确认没有把移动端代码写入根 `src/**`。
- [ ] 已确认数据契约相关逻辑进入 `packages/core`。
- [ ] 已确认类型进入 `packages/shared`。
- [ ] 已确认没有引入硬禁止事项中的依赖或功能。

---

## 12. 完成标准

当前 Android/mobile 交付完成时必须满足：

- Android mobile app 位于 `apps/mobile`。
- 跨端 core 逻辑位于 `packages/core`。
- 移动端可新增记录。
- 移动端可查看历史。
- 移动端可删除记录，且删除有确认弹窗。
- 移动端可导入桌面端 JSON。
- 移动端可导出 canonical v1 JSON。
- 移动端可在启动时自动检查更新，并从设置页手动触发检查。
- `mobile-vX.Y.Z` 与 `mobile-latest` 两条 release 线都能正确发布。
- `mobile-update.json` 中的 `apkSha256` 可用于验证最新 APK。
- `packages/core` 测试通过。
- Type-check、lint、测试命令已运行并记录结果。
