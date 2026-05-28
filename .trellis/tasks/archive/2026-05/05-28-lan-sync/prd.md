# LAN Sync

## Goal

实现桌面端与移动端的局域网数据同步。桌面端作为 HTTP server，手机端作为 client，通过单次 HTTP POST 完成双向数据合并。数据模型为 append-only（记录只增不改不删），合并策略为集合取并集（INSERT OR IGNORE by UUID）。

## What I already know

* 两端都是 SQLite，schema 完全一致（Records 表 UUID 主键 + Settings 键值表）
* 现有 JSON export/import 已实现完整的序列化/反序列化/去重逻辑（`@dickhelper/core`）
* 桌面端：Electron + sql.js (WASM)，数据在 main process，通过 IPC 暴露给 renderer
* 移动端：Expo SDK 56 + expo-sqlite，直接在 JS 层操作
* `@dickhelper/shared` 有完整的 type 定义（IRecord, IRecordRaw 等）
* Settings 不需要同步（设备私有配置）

## Requirements

* 桌面端起临时 HTTP server，暴露局域网 IP + 端口
* 桌面端 UI 显示连接信息（IP:Port）
* 移动端 UI 支持手动输入 IP:Port 并发起同步
* 单次 POST 请求完成双向同步：手机发送全量记录 → 桌面合并后返回桌面的全量记录
* 合并策略：INSERT OR IGNORE by UUID（全量同步，无需追踪同步状态）
* 同步协议类型定义放到 `@dickhelper/shared`
* 合并逻辑复用 `@dickhelper/core` 现有的 import 能力

## Acceptance Criteria

* [ ] 桌面端能启动/停止 HTTP sync server
* [ ] 桌面端 UI 显示可连接的 IP 地址和端口
* [ ] 移动端能输入 IP:Port 并发起同步
* [ ] 手机新增的记录能同步到桌面端
* [ ] 桌面端新增的记录能同步到手机端
* [ ] 重复同步不会产生重复记录

## Definition of Done

* 单元测试覆盖同步协议序列化/反序列化
* 端到端手动测试：两端各新增记录，同步后两端数据一致
* Lint / typecheck 通过
* 现有 JSON export/import 功能不受影响

## Technical Approach

### Sync Protocol

单次 `POST /api/sync` 完成双向全量同步：

```
Request:  { records: string }   // IMobileExportV1 JSON string (mobile sends all records)
Response: { result: IImportResult; records: string }  // import result + desktop's all records as JSON string
```

- `records` 字段复用 `ExportRecordsToJson()` 输出的 JSON 字符串格式（`{ version: 1, records: [...] }`）
- 两端各自用 `ParseImportJson()` 解析对方的 records
- 无需新增 `@dickhelper/core` 函数，仅在 `@dickhelper/shared` 新增 `ISyncResponse` 类型

### Desktop (Electron main process)

- 新建 `src/main/syncService.ts`，参照 `UpdateService` 模式
- 使用 Node.js 原生 `http.createServer()`，无新依赖
- `os.networkInterfaces()` 获取候选 IP，过滤 loopback 和虚拟网卡
- IPC 通道：`sync:start`, `sync:stop`, `sync:get-status`
- 复用 `databaseService.GetRecords()` 和 `databaseService.ImportRecords()`
- 设置页新增"局域网同步"section，显示 IP:Port 和启停按钮

### Mobile (Expo)

- 使用 `fetch()` 发送 POST 请求，无新依赖
- 复用 `MobileDatabaseService.ExportToJson()` 构造请求体
- 复用 `MobileDatabaseService.ImportFromJson()` 处理响应
- 设置页新增"局域网同步"section，TextInput 输入 IP:port，Button 触发同步

### No New Dependencies

- Desktop: Node.js 原生 `http` + `os` 模块
- Mobile: `fetch()` 已可用
- 两端: 现有 `@dickhelper/core` import/export 函数

## Out of Scope

* Settings 同步
* 实时/自动同步（仅手动触发）
* QR 扫码连接
* mDNS 自动发现
* WebSocket
* 云端同步

## Technical Notes

* 桌面端 main process 已有完整的数据库操作能力（`src/main/database.ts`）
* 移动端 `MobileDatabaseService` 已有 `ImportFromJson` 和 `ExportToJson` 方法
* `@dickhelper/core` 的 `ParseImportJson` 和 `ExportRecordsToJson` 可直接复用
