# PRD: Review Cloudflare Workers+D1 Online Features

## Overview

对 DickHelper 的 Cloudflare Workers + D1 排行榜后端进行全面代码审查，识别潜在问题和改进点。**不包括反作弊机制的审查**（反作弊属于"尽力而为"范畴）。

## Review Scope

### Backend (worker/)
- `src/index.ts` - Hono API 路由和业务逻辑
- `src/types.ts` - TypeScript 类型定义
- `src/nicknames.ts` - 昵称生成器
- `migrations/0001_create_tables.sql` - D1 数据库 schema
- `wrangler.toml` - Cloudflare Worker 配置

### Frontend Integration
- `packages/core/src/leaderboardClient.ts` - API 客户端
- `src/renderer/hooks/useOnlineService.ts` - 在线服务 Hook

## Review Dimensions

### 1. API Security (API 安全性)
- [ ] 认证机制是否安全（Bearer token = UUID 是否足够）
- [ ] 输入验证是否完整（所有用户输入）
- [ ] CORS 配置是否过于宽松
- [ ] 是否存在注入风险（SQL injection）
- [ ] Rate limiting 是否需要

### 2. Data Consistency (数据一致性)
- [ ] D1 事务使用是否正确
- [ ] 并发写入处理
- [ ] UPSERT 语句的正确性
- [ ] 外键约束和级联删除

### 3. Error Handling (错误处理)
- [ ] 所有异常路径是否处理
- [ ] 错误信息是否泄露敏感信息
- [ ] 客户端错误处理是否完善
- [ ] 网络失败的重试策略

### 4. Performance (性能)
- [ ] SQL 查询是否有合适的索引
- [ ] N+1 查询问题
- [ ] 分页实现是否高效
- [ ] 是否需要缓存

### 5. Edge Cases (边缘情况)
- [ ] 时区处理（UTC+8 转换）
- [ ] ISO 周计算的正确性
- [ ] 日期边界（跨周、跨月）
- [ ] 空数据处理

### 6. Code Quality (代码质量)
- [ ] TypeScript 类型安全
- [ ] 代码重复
- [ ] 命名一致性
- [ ] 注释完整性

### 7. Deployment & Configuration (部署配置)
- [ ] wrangler.toml 配置
- [ ] 环境变量管理
- [ ] 数据库迁移策略
- [ ] 免费额度估算

### 8. Frontend Integration (前端集成)
- [ ] API 客户端错误处理
- [ ] 定时上报逻辑
- [ ] 离线/在线状态管理
- [ ] 用户体验（加载状态、错误提示）

## Out of Scope

- **反作弊机制** - 不审查数据真实性验证
- **UI/UX 设计** - 只审查功能实现
- **第三方服务** - 只审查自研代码

## Deliverables

1. 问题清单（按严重程度分类）
2. 改进建议（可直接实施的代码修改）
3. 架构建议（如需要重构）

## Success Criteria

- 识别所有 Critical/High 级别问题
- 每个问题都有明确的复现步骤或说明
- 提供可操作的修复建议
