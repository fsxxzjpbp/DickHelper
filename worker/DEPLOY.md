# DickHelper Leaderboard - Cloudflare 部署指南

本指南帮助你部署 DickHelper 的排行榜后端服务。基于 Cloudflare Worker + D1，免费额度完全够用。

## 前置条件

- [Cloudflare 账号](https://dash.cloudflare.com)
- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler)

```bash
npm install -g wrangler
wrangler login
```

## 部署步骤

### 1. 创建 D1 数据库

```bash
cd worker
wrangler d1 create dickhelper-leaderboard
```

输出示例：
```
✅ Successfully created DB 'dickhelper-leaderboard'

[[d1_databases]]
binding = "DB"
database_name = "dickhelper-leaderboard"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

将输出的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "dickhelper-leaderboard"
database_id = "你的数据库ID"
```

### 2. 执行数据库迁移

```bash
npm run migrate -- --remote
```

> **注意：** 必须加 `--remote` 参数，否则迁移只会应用到本地开发数据库，不会应用到 Cloudflare 上的远端数据库。`--` 是 npm 传参的分隔符，后面的 `--remote` 会传给 wrangler。

这会创建 `users` 和 `daily_stats` 两张表。

### 3. 部署 Worker

```bash
npm run deploy
```

部署成功后会输出 Worker 的 URL，类似：
```
https://dickhelper-leaderboard.你的用户名.workers.dev
```

### 4. 配置客户端

在 DickHelper 桌面端的设置中开启"在线功能"，首次开启时会提示输入服务器地址。填入上一步获取的 Worker URL 即可。

## 本地开发

```bash
cd worker
npm install
npm run dev
```

本地开发服务器默认运行在 `http://localhost:8787`。可以用 curl 测试：

```bash
# 注册
curl -X POST http://localhost:8787/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"uuid": "test-uuid-123"}'

# 上报数据
curl -X POST http://localhost:8787/api/v1/report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-uuid-123" \
  -d '{"date": "2026-05-29", "count": 3, "duration": 45}'

# 查询每日排行
curl http://localhost:8787/api/v1/ranking/daily \
  -H "Authorization: Bearer test-uuid-123"

# 查询每周排行
curl http://localhost:8787/api/v1/ranking/weekly \
  -H "Authorization: Bearer test-uuid-123"

# 删除账号
curl -X DELETE http://localhost:8787/api/v1/account \
  -H "Authorization: Bearer test-uuid-123"
```

## API 文档

所有需要认证的接口通过 `Authorization: Bearer <uuid>` 头传递身份凭证。

### POST /api/v1/register

注册新用户。幂等操作，重复注册返回已有昵称。

**请求体：**
```json
{ "uuid": "客户端生成的UUID" }
```

**响应（201）：**
```json
{ "nickname": "快乐的海豚" }
```

### POST /api/v1/report/batch

批量上报多天统计数据。一次请求上报所有历史数据，按 (uuid, date) UPSERT，幂等操作。传入单条记录即为单次上报。

**请求体：**
```json
{
  "stats": [
    { "date": "2026-05-27", "count": 2, "duration": 30.5 },
    { "date": "2026-05-28", "count": 1, "duration": 15.0 },
    { "date": "2026-05-29", "count": 3, "duration": 45.5 }
  ]
}
```

**响应：**
```json
{ "success": true }
```

### GET /api/v1/ranking/daily

查询每日排行榜。

**查询参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| date | string | 今天(UTC+8) | 日期，格式 YYYY-MM-DD |
| sort | string | count | 排序维度：`count`（按次数降序）或 `duration`（按时长降序） |
| limit | number | 10 | 每页条数 |
| offset | number | 0 | 偏移量 |

**响应：**
```json
{
  "rankings": [
    { "rank": 1, "nickname": "快乐的海豚", "count": 5, "duration": 72.3 },
    { "rank": 2, "nickname": "孤独的企鹅", "count": 4, "duration": 58.1 }
  ],
  "total": 150,
  "me": {
    "rank": 12,
    "count": 3,
    "duration": 45.5,
    "percentile": 87
  },
  "stats": {
    "avgCount": 3.45,
    "avgDuration": 52.18
  }
}
```

- `sort=count` 时排序规则：count DESC, duration ASC（tiebreaker）
- `sort=duration` 时排序规则：duration DESC, count ASC（tiebreaker）
- `me.percentile` 的含义跟随 `sort` 变化：`sort=count` 时为次数低于自己的用户占比，`sort=duration` 时为时长低于自己的用户占比
- `stats` 始终返回 `avgCount` 和 `avgDuration`（与 `sort` 无关）
- 无效的 `sort` 值返回 400 错误

### GET /api/v1/ranking/weekly

查询每周排行榜。按周一到周日聚合。

**查询参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| week | string | 本周(UTC+8) | ISO周，格式 YYYY-Www (如 2026-W22) |
| sort | string | count | 排序维度：`count`（按次数降序）或 `duration`（按时长降序） |
| limit | number | 10 | 每页条数 |
| offset | number | 0 | 偏移量 |

**响应结构与 daily 相同。**

### DELETE /api/v1/account

删除用户及其所有数据。

**响应：**
```json
{ "success": true }
```

## 自建服务器

由于本项目是开源的，你可以自行部署排行榜服务：

1. Fork 本仓库
2. 按上述步骤部署 Worker
3. 在客户端设置中填入你自己的 Worker URL

### 自定义域名（可选）

在 Cloudflare Dashboard 中为 Worker 配置自定义域名：

1. 进入 Workers & Pages → 你的 Worker → Settings → Domains & Routes
2. 添加自定义域名（需要该域名已在 Cloudflare 托管）
3. 配置完成后使用自定义域名访问

### 数据管理

通过 Wrangler CLI 直接操作 D1 数据库：

```bash
# 查看总用户数（远端）
wrangler d1 execute dickhelper-leaderboard --remote --command "SELECT COUNT(*) FROM users"

# 查看今日活跃用户（远端）
wrangler d1 execute dickhelper-leaderboard --remote --command "SELECT COUNT(*) FROM daily_stats WHERE date = date('now', '+8 hours')"

# 查看排行榜前10（远端）
wrangler d1 execute dickhelper-leaderboard --remote --command "
  SELECT u.nickname, ds.count, ds.duration
  FROM daily_stats ds
  JOIN users u ON ds.uuid = u.uuid
  WHERE ds.date = date('now', '+8 hours')
  ORDER BY ds.count DESC
  LIMIT 10
"
```

## 免费额度

| 资源 | 免费额度 | 说明 |
|------|----------|------|
| Worker 请求 | 100,000 次/天 | 每用户每天约 100-200 次请求 |
| D1 读取 | 5,000,000 行/天 | 排行榜查询消耗 |
| D1 写入 | 100,000 行/天 | 上报数据消耗 |
| D1 存储 | 5 GB | 用户数据极少 |

按 1000 活跃用户估算，每天约消耗：
- Worker 请求：~200,000 次（可能超过 100K 限制）
- D1 读取：~50,000 行（远低于 5M 限制）
- D1 写入：~2,000 行（远低于 100K 限制）

## 故障排查

**Q: 客户端提示"网络请求失败"**

A: 中国大陆访问 Cloudflare 可能不稳定。确认 Worker URL 正确，尝试使用自定义域名。

**Q: 注册返回 500 错误**

A: 检查 D1 数据库是否已创建并执行了迁移。运行 `npm run migrate -- --remote`（注意 `--remote` 参数，否则只迁移本地数据库）。

**Q: 排行榜数据不更新**

A: 数据上报是幂等的（UPSERT），确认客户端已开启在线功能且网络正常。排行榜显示的是最后一次上报的数据。
