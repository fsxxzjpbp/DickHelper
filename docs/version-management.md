# 版本管理说明

## 双版本体系

项目有两个独立的版本号：

| 平台 | 版本来源 | 触发方式 | Tag 格式 |
|------|----------|----------|----------|
| Desktop | `package.json`（根目录） | 手动修改 → 打 tag → CI 构建 | `desktop-vX.Y.Z` |
| Mobile | git tag（CI 自动覆盖） | 打 tag → CI 从 tag 解析版本 → 覆盖 `app.json` → 构建 | `mobile-vX.Y.Z` |

## Mobile 版本机制（重要）

**CI 是唯一的发布版本来源。** `android-release.yml` 会：

1. 从 git tag 提取版本号（如 `mobile-v0.2.0` → `0.2.0`）
2. 自动计算 `versionCode = MAJOR * 10000 + MINOR * 100 + PATCH`
3. 构建前覆盖 `apps/mobile/app.json` 中的 `version` 和 `versionCode`
4. 用覆盖后的 `app.json` 进行 Expo 构建

**因此本地 `app.json` 的版本号仅影响本地开发构建，不影响发版。**

## 需要手动同步的文件

发版时本地文件不需要改版本（CI 会覆盖），但如果想保持本地一致，需要改以下 3 处：

| 文件 | 字段 | 说明 |
|------|------|------|
| `apps/mobile/app.json` | `expo.version` | Expo 配置，CI 构建时会被覆盖 |
| `apps/mobile/package.json` | `version` | npm 包版本，CI **不会**覆盖 |
| `apps/mobile/app/settings/index.tsx` | fallback 值 | 兜底版本，实际读取 `Constants.expoConfig?.version` |

## Desktop 版本机制

Desktop 版本是手动管理的：

1. 修改根目录 `package.json` 的 `version` 字段
2. 打 tag `desktop-vX.Y.Z`（版本号必须匹配，否则 CI 报错）
3. CI 自动构建并发布

## 发版流程

### Mobile
```bash
# 直接打 tag 即可，不需要改任何文件
git tag mobile-v0.2.0
git push origin mobile-v0.2.0
```

### Desktop
```bash
# 1. 修改根目录 package.json 的 version
# 2. 提交
git commit -am "调整版本号为X.Y.Z"
# 3. 打 tag
git tag desktop-vX.Y.Z
git push origin desktop-vX.Y.Z
```
