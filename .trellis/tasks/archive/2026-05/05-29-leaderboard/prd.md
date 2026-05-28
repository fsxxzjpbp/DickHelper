# Cloudflare Worker + D1 排行榜系统

## Goal

为 DickHelper 添加在线排行榜功能，用户可以查看自己在"每日自慰次数"和"每周自慰次数"维度上的排位百分比（"你超过了 X% 的人"）。使用 Cloudflare Worker 作为 API 层，D1 作为数据库。

## What I already know

- 项目是 Electron + Expo monorepo，本地用 SQLite 存储记录
- 现有记录结构：Id, StartTime, EndTime, Duration, Notes
- 现有同步机制是 LAN 局域网同步（桌面端做服务端，移动端做客户端），无云端同步
- 核心数据（自慰次数/时长）无法验证真实性，因此不做反作弊
- 排行榜只上传聚合结果（某人某天的次数和总时长），不上传原始记录
- 平均时长是派生指标，服务端从 count 和 duration 计算，不需要客户端上报

## Decision: 上报数据结构

客户端上报 `{uuid, date, count, duration}`，服务端聚合计算平均时长。

## Decision: 用户身份方案

采用"UUID 身份 + 服务端分配昵称"方案：

- **UUID** = 身份标识 + 认证凭证（bearer token），客户端生成后持久化
- **昵称** = 服务端从预设池中分配，用户不可自定义（规避不当名称的政治风险）
- **注册流程**：客户端生成 UUID → POST /api/register → 服务端创建用户，从昵称池分配昵称 → 返回昵称
- **后续请求**：UUID 作为 bearer token 传入，服务端不返回 UUID（响应中只有昵称）
- 由于软件性质（自慰记录），强制登录不可行，必须保持低门槛匿名访问
- UUID 后续会用于更多在线功能，不仅仅是排行榜

## Decision: 昵称生成方案

采用"形容词 + 动物名"硬编码词表组合（方案 A）：
- 约 40 个形容词 × 40 个动物 = 1600 种组合
- 纯 Worker 内存计算，零外部依赖，不需要数据库查询
- 允许重名（v1 用户量小，重名概率低）
- 后期用户量增长可迁移到 D1 昵称池表

## Decision: 时区与周定义

- 统一使用 **UTC+8**（北京时间）作为排行榜日期基准
- 每周定义为**周一到周日**
- 客户端聚合时按 UTC+8 将 StartTime 转为日期字符串
- 旧数据不清理，留着不管
- 当天没有记录则不上报

## Decision: Opt-in 原则与公平交换

- 用户必须手动开启"在线功能"，未开启前不上传任何数据
- 开启在线功能 = 同意上传聚合统计数据
- 公平交换：不上传数据的用户不允许查询排行榜数据（服务端校验 UUID 是否已注册）
- 弱保护：过滤大部分滥用即可，不追求完美防刷

## Decision: 上报时机

- 每次新增记录后立即上报当天聚合数据
- 打开 app 时上报当天聚合数据
- 应用运行期间每 2 小时定时上报
- 以上三种场景均使用 UPSERT（按 uuid+date 去重），天然幂等，无需加锁

## D1 Schema (v1)

```sql
CREATE TABLE users (
    uuid       TEXT PRIMARY KEY,   -- 客户端生成的 UUID，兼作认证凭证
    nickname   TEXT NOT NULL,      -- 服务端从预设池分配
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE daily_stats (
    uuid       TEXT NOT NULL,
    date       TEXT NOT NULL,      -- 'YYYY-MM-DD'
    count      INTEGER NOT NULL,   -- 当天次数
    duration   REAL NOT NULL,      -- 当天总时长（分钟）
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uuid, date),
    FOREIGN KEY (uuid) REFERENCES users(uuid)
);
```

## Decision: UI 设计

**侧边栏导航**
- 新增 "在线" tab（`NavLink`，图标待定），位于现有 4 个 tab 和设置之间
- 未开启在线功能时：tab 可见但 `disabled`，hover 显示 tooltip "请先在设置中开启在线功能"
- 开启后：tab 可点击，进入排行榜页面

**设置页**
- 新增 "在线功能" section（`Paper` 卡片，与 LAN Sync 等 section 平级）
- `Switch` 开关控制在线功能启停
- 开启后显示：昵称 + UUID（脱敏显示如 `a3f8****9b2e`）
- 关闭时弹确认框："将清除服务端所有数据，确定关闭？"

**"在线"页面（OnlineView）**
- 顶部：昵称 + UUID（脱敏）
- `Tabs` 切换：次数排行 / 时长排行
- 每个 tab 内：`SegmentedControl` 切换 日/周
- 百分位展示 + Top N 列表（`?limit=10`，默认 10，支持翻页）
- 列表每行：排名数字 + 昵称 + 数值

**状态管理**
- App.tsx 的 `View` 类型新增 `"online"`
- `onlineConfig`（uuid, nickname, enabled）需要在 App 层管理，设置页和侧边栏共用

## Requirements (evolving)

- 用户手动开启"在线功能"后才激活排行榜（opt-in）
- 开启时生成 UUID 并注册，服务端分配昵称
- 关闭在线功能时发送 DELETE 请求，服务端清除该用户所有数据
- 客户端本地按天聚合记录次数和总时长，上传到 Cloudflare Worker
- Worker 将数据写入 D1（UPSERT 幂等）
- 提供用户注册接口（UUID → 服务端分配昵称）
- 提供用户注销接口（UUID → 服务端删除所有数据）
- 提供每日排行榜查询接口（支持 limit 参数分页）
- 提供每周排行榜查询接口（支持 limit 参数分页）
- 同时支持次数排行和时长排行（UI 复用）
- 返回当前用户的排位百分比
- 排行榜展示：百分位 + Top N 列表（显示昵称和次数/时长）
- 服务端不返回 UUID（响应中只有昵称）
- v1 仅看当天/本周，不支持历史查询
- v1 仅在桌面端（Electron）集成，共用逻辑抽到 packages/core
- 网络失败显式提示用户（中国大陆到 Cloudflare 网络不稳定）

## Open Questions

（无阻塞问题）

## Acceptance Criteria (evolving)

- [ ] 用户可以开启/关闭在线功能
- [ ] 开启时自动注册并获得昵称
- [ ] 关闭时服务端数据被清除
- [ ] 用户可以查看自己的每日次数排位百分比
- [ ] 用户可以查看自己的每周次数排位百分比
- [ ] 用户可以查看自己的每日/每周时长排行
- [ ] 排行榜显示 Top N 列表（昵称 + 数值）
- [ ] 网络失败时显示明确的错误提示
- [ ] 新增记录后自动上报
- [ ] 应用运行期间每 2 小时定时上报

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes

## Out of Scope (explicit)

- 反作弊机制
- 原始记录上传（隐私保护）
- 好友/群组排行榜（v1 不做）
- 用户登录系统（v1 不做）
- 移动端集成（v1 不做，共用逻辑已抽到 packages/core）
- 多设备数据合并（v1 不做）
- 历史日期查询（v1 不做）

## Technical Notes

- Cloudflare Worker 免费额度：每天 100,000 请求
- D1 免费额度：每天 5M 读 + 100K 写
- 客户端需要生成并持久化一个匿名 UUID
- UPSERT 按 (uuid, date) 去重，多设备同时上报后到的覆盖先到的（v1 不处理合并）
- 中国大陆到 Cloudflare 网络不稳定，需显式错误提示
- 昵称使用硬编码形容词+动物名词表（~1600 种组合），Worker 内存中随机选取
- 日期统一使用 UTC+8（北京时间），每周周一到周日
- 历史 daily_stats 数据不清理
