# Android CI Workflow — GitHub Actions 自动构建 Release APK

## Goal

为 DickHelper 移动端（Expo + React Native）创建 GitHub Actions workflow，在推送 `mobile-v*.*.*` 标签时自动构建 Release APK 并发布到 GitHub Release。同时改造桌面端 auto-update 机制，确保两种 Release 互不干扰。

## What I already know

### 项目结构
- Monorepo: `apps/mobile/` (Expo SDK 56, RN 0.85.3), `packages/shared/`, `packages/core/`
- `apps/mobile/android/` 已被 gitignore，CI 必须先运行 `expo prebuild` 生成 Android 原生项目
- 已有桌面端 workflow: `.github/workflows/release.yml`（触发前缀 `v*.*.*`）

### 需求对齐（已确认）
- **触发**: `mobile-v*.*.*` 标签 + workflow_dispatch 手动触发
- **构建类型**: Release APK
- **签名**: 自签名 keystore（已生成于 `apps/mobile/release.keystore`，已 gitignore），CI 通过 GitHub Secrets 注入
- **发布**: GitHub Release（和桌面端一致）
- **版本**: 从 tag 提取版本号，自动写入 `app.json` 和 `build.gradle`
- **起始版本**: `mobile-v0.0.1`，versionCode=1

### Keystore 信息
- 文件: `apps/mobile/release.keystore`（PKCS12，2.7KB）
- Alias: `dickhelper`
- 密码: `<已存入 Bitwarden，CI 通过 GitHub Secrets 注入>`
- Base64 编码: 已生成，用户可存入 Bitwarden 备份

### 技术细节
- Java: JDK 17（ubuntu-latest 默认，runner 已预装 Android SDK）
- Gradle: 8.14.3（gradlew wrapper 自动下载）
- ABI: `arm64-v8a,x86_64`
- Hermes: 启用，New Architecture: 启用
- Node.js: 18（沿用现有 workflow 版本）

## Requirements

### 移动端 CI Workflow
1. 新建 `.github/workflows/android-release.yml`
2. `mobile-v*.*.*` 标签推送时自动触发
3. 支持 workflow_dispatch 手动触发
4. CI 内执行 `npx expo prebuild --platform android` 生成原生项目
5. 从 tag 提取版本号，自动写入 `app.json` (version) 和 `build.gradle` (versionName, versionCode)
6. 通过环境变量注入签名配置到 Gradle
7. `./gradlew assembleRelease` 构建 Release APK
8. APK 上传为 GitHub Release 资产

### 桌面端 Auto-Update 改造（防 Broken Change）
9. 桌面端 `release.yml` 触发前缀从 `v*.*.*` 改为 `desktop-v*.*.*`
10. 桌面端发布后自动维护 `desktop-latest` 标签，指向最新桌面 Release
11. `updateService.ts` feed URL 改为 `releases/download/desktop-latest/`
12. `electron-builder.yml` publish url 同步更新

### 过渡策略（发版顺序约束）
13. **Step 1**: 手动创建 `desktop-latest` 标签 → 指向当前 v2.0.5
14. **Step 2**: 合入本次所有代码改动（workflow + updateService.ts + electron-builder.yml）
15. **Step 3**: 发布 `desktop-v2.0.6` → `releases/latest` 和 `desktop-latest` 都指向它，老客户端可无痛升级
16. **Step 4**: 等老客户端升级窗口（建议一周），然后才能发第一个 `mobile-v0.0.1`

## Acceptance Criteria

- [ ] 推送 `mobile-v0.0.1` 标签触发 Android workflow 自动构建
- [ ] workflow_dispatch 手动触发可用
- [ ] CI 构建成功生成签名的 Release APK
- [ ] APK 可安装到真机正常运行
- [ ] GitHub Release 自动创建并包含 APK 资产
- [ ] 桌面端 `release.yml` 触发改为 `desktop-v*.*.*`，发布后自动更新 `desktop-latest` 标签
- [ ] `updateService.ts` 和 `electron-builder.yml` 的 feed URL 改为 `desktop-latest`
- [ ] Keystore 密码等敏感信息通过 GitHub Secrets 注入，不硬编码
- [ ] v2.0.5 客户端可正常检测并升级到 v2.0.6

## Definition of Done

- Workflow 文件合入 main 分支
- GitHub Secrets 配置完成（4 个）
- `mobile-v0.0.1` 标签推送 → CI 通过 → Release 包含 APK
- 生成的 APK 在真机验证可用
- 桌面端发布 `desktop-v2.0.6` 验证 auto-update 链路正常

## Technical Approach

### Workflow 结构

**android-release.yml**

Job 1: `build-android` (ubuntu-latest)
- Checkout → Setup Node.js 18 (cache npm) → `npm install`
- Setup JDK 17 (`actions/setup-java@v4`, distribution: temurin, cache: gradle)
- 从 tag 提取版本号，写入 `app.json` (version) 和 `build.gradle` (versionName, versionCode)
- 解码 `ANDROID_KEYSTORE_BASE64` → `apps/mobile/release.keystore`
- `npx expo prebuild --platform android` 生成原生项目
- 脚本: 注入 release signingConfig 到 `build.gradle`（读环境变量）
- `./gradlew assembleRelease` 构建 APK
- Upload workflow artifact

Job 2: `publish-release` (ubuntu-latest, needs build-android)
- 下载 artifact → `gh release create` 创建 Release 并上传 APK

**release.yml（改造）**

- 触发条件: `desktop-v*.*.*`（原 `v*.*.*`）
- 发布后新增步骤: `git push origin --force desktop-latest:$DESKTOP_TAG` 更新 desktop-latest 标签

### Signing 配置方案（Approach A: 环境变量）

在 CI 中通过 env 注入，不改 `build.gradle` 的现有 signingConfigs 结构。CI 脚本在 `expo prebuild` 后修改 `build.gradle` 的 release signingConfig，使其读取环境变量：

```groovy
signingConfigs {
    release {
        storeFile file(System.getenv('KEYSTORE_FILE') ?: 'debug.keystore')
        storePassword System.getenv('KEYSTORE_PASSWORD') ?: 'android'
        keyAlias System.getenv('KEY_ALIAS') ?: 'androiddebugkey'
        keyPassword System.getenv('KEY_PASSWORD') ?: 'android'
    }
}
```

### GitHub Secrets 需配置

| Secret | 值 |
|--------|-----|
| `ANDROID_KEYSTORE_BASE64` | keystore base64 编码 |
| `ANDROID_KEYSTORE_PASSWORD` | `<keystore 密码>` |
| `ANDROID_KEY_ALIAS` | `dickhelper` |
| `ANDROID_KEY_PASSWORD` | `<key 密码（同 keystore 密码）>` |

## Decision (ADR-lite)

**Context**: 桌面端 auto-update 通过 `releases/latest` 获取 `latest.yml`。如果移动端也创建 GitHub Release，最新 Release 可能是移动端的，导致桌面 auto-update 404。
**Decision**: 采用方案 A — 桌面端用固定 `desktop-latest` 标签作为更新频道，移动端独立创建 Release。需一次桌面版过渡发布（v2.0.6）来迁移存量客户端。
**Consequences**:
- 桌面和移动 Release 互不干扰，各自独立
- 存量 v2.0.5 及更早客户端必须先升级到 v2.0.6 才能继续自动更新
- 需要在发第一个 `mobile-v*` 之前先发 `desktop-v2.0.6`，并留升级窗口

## Out of Scope

- Play Store 上架签名
- F-Droid 发布
- iOS 构建
- OTA 更新（expo-updates）
- 自动版本号递增

## Technical Notes

### 需修改的文件
| 文件 | 改动 |
|------|------|
| `.github/workflows/android-release.yml` | **新建** |
| `.github/workflows/release.yml` | 触发前缀 `v*` → `desktop-v*`；新增 `desktop-latest` tag push |
| `src/main/updateService.ts` | feed URL → `desktop-latest` |
| `electron-builder.yml` | publish url → `desktop-latest` |
| `apps/mobile/android/app/build.gradle` | release signingConfig 改为读环境变量 |

### Research references
- [`research/github-actions-android-setup.md`](research/github-actions-android-setup.md) — ubuntu-latest 预装 Android SDK + JDK 17；签名注入推荐环境变量方案
