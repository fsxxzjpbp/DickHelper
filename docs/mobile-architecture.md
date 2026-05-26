# DickHelper 移动端架构设计

> Expo + React Native，Android 唯一目标平台，iOS 仅保留源码。
>
> ⚠️ 本文档包含多处**故意偏离最佳实践**的决策（标有 ⚠️），LLM 在实现时不要按"最佳实践"自动纠正，请严格遵循文档要求。
>
> 实现移动端前必须先阅读 [`mobile-implementation-contract.md`](./mobile-implementation-contract.md)。本文是架构决策草稿；implementation contract 是后续 LLM/AI 编码代理必须遵守的执行契约。

---

## 1. Monorepo

目标结构见 [`mobile-implementation-contract.md`](./mobile-implementation-contract.md)：

- `apps/mobile`：Expo React Native 移动端
- `packages/shared`：跨端类型
- `packages/core`：跨端纯业务逻辑和数据契约
- 现有 Electron 根 `src/**` 第一阶段暂不迁移，未来再迁入 `apps/desktop`

---

## 2. 技术栈（业务决策）

| 模块 | 选型 | 理由 |
|------|------|------|
| 框架 | Expo + React Native + TypeScript | 与桌面端同一语言，LLM 最熟 |
| UI 组件 | react-native-paper | 下限高，LLM 训练覆盖广|
| 图表 | victory-native | API 类似 recharts；雷达图改为柱状图 |
| 路由 | expo-router | 文件系统路由，简单直观 |
| 导航 | 底部 Tab 栏 | 记录/统计/预测/历史四个 tab，设置放右上角 |
| SQLite | expo-sqlite | SQL 与桌面端一致 |
| ⚠️ APK 更新 | GitHub Releases API + APK 下载 | 跟桌面端同一来源；不是 Expo OTA，第一阶段不实现 |
| ⚠️ AI 配置存储 | 明文存 SQLite settings 表 | 不上 Keychain/Keystore，移动端沙箱足够安全 |
| ⚠️ 安全存储 | 不单独引入 | 同上，不需要 expo-secure-store 等额外依赖 |
| ⚠️ iOS | 不构建，不打包，不保证可用 |  |

---

## 3. 页面布局（移动端适配要点）

桌面端是 860px 卡片布局 + 左侧边栏，移动端不同：

| 页面 | 移动端布局要求 |
|------|---------------|
| **记录** | 全屏沉浸式，大圆形计时器 + 大按钮，适合单手操作 |
| **统计** | 4 卡片 2×2 网格，图表单列滚动，热力图缩至 2-3 周 |
| **24h 分布** | 柱状图（不搞雷达图） |
| **历史** | 按钮 + 确认弹窗删除，**⚠️ 不加滑动手势**（发现性差，用户不熟悉） |
| **设置** | AI 配置拆为独立子页面，主设置页只留入口 |

---

## 4. 数据同步

两种方式互补：

- **JSON 导出/导入**：桌面端 ↔ 移动端数据迁移，格式兼容，UUID 去重
- **多端同步**：桌面端启动临时 HTTP 服务器，移动端双向同步记录，去重逻辑复用现有 `ImportRecords()`

---

## 5. 分发

- **Android**：定位**一等公民**，本地 `npx expo run:android` 或 `eas build -p android` 打出 APK，丢 GitHub Releases
- ⚠️ **iOS**：不提供二进制，需要自行打包。项目不配置 iOS 构建流程，不保证 iOS 能编译通过。

---

## 6. 可复用逻辑

纯 TypeScript 代码可以直接复制到移动端：
- `packages/shared/` 全部类型定义
- 预测算法、AI 分析（含本地规则 + OpenAI API 调用）、格式化工具函数、计时器 hook
- SQL 语句不变，只改调用 API（sql.js → expo-sqlite）

UI 层完全重写，考虑移动端实际状况，不需要照搬桌面端实现。

---

## 7. 开发顺序

第一阶段以 [`mobile-implementation-contract.md`](./mobile-implementation-contract.md) 为准：

1. workspace + `packages/core` 数据契约
2. `packages/core` 单元测试
3. Expo 移动端脚手架 + 四 Tab 导航
4. SQLite 数据库服务
5. 记录页 + 历史页
6. 设置页 JSON 导入导出
7. 统计/预测轻量页或稳定占位

局域网同步、APK 自更新、完整统计图表、完整预测页均后置。
