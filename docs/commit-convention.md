# Commit 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 风格，中文描述。

## 格式

```
<type>(<scope>): <简短描述>

- 详细说明 1
- 详细说明 2
```

## Type

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `refactor` | 重构（不改功能） |
| `style` | 样式/文案调整 |
| `docs` | 文档 |
| `chore` | 构建、CI、工具链、任务归档 |
| `test` | 测试 |

## Scope

可选，常用的 scope：

| Scope | 含义 |
|-------|------|
| `mobile` | 移动端 |
| `desktop` | 桌面端 |
| `core` | 核心逻辑（packages/core） |
| `ci` | CI/CD |
| `task` | Trellis 任务管理 |

## 规则

- **标题用中文**，简洁概括改动目的
- **正文用列表**，每条说明一个独立改动点
- 标题不加句号
- 正文说明"做了什么"和"为什么"，不写"怎么做的"（代码本身说明）
- scope 可省略（如 `docs: 更新 README`）

## 示例

```
fix(mobile): 优化移动端版本号与页面文案

- 移动端版本号从 0.1.0 调整为 0.0.1，与 GitHub tag mobile-v0.0.1 对齐
- 修复历史页空白状态文案截断问题，添加 numberOfLines={0} 防止窄屏裁剪
- 优化四个页面的 subtitle 文案，去除冗余描述，统一无句号风格
- 新增版本管理说明文档
```

```
feat(mobile): 新增预测页面

- 基于历史记录计算平均间隔
- 预测下一次时间并展示
```

```
chore(ci): 改用先删后建 Release 策略

- 避免 gh release view 误判导致创建失败
```

```
fix(ci): 修复 Android CI 构建失败

- 补充 expo prebuild 步骤
- 修正 artifact 上传路径
```
