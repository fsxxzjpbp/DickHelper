# 版本管理说明

## 三个不同概念

项目里要区分三件事：

| 概念 | 示例 | 作用 | 是否可能成为 GitHub Releases UI 的 Latest |
|------|------|------|------|
| 版本化 release | `desktop-vX.Y.Z`、`mobile-vX.Y.Z` | 对外可下载、可追溯的正式发布物 | 只有 desktop release 可以；mobile release 必须 `latest=false` |
| 机器更新通道 | `desktop-latest`、`mobile-latest` | 给自动更新程序读取的稳定入口 | 不是 UI Latest；desktop 是 tag/feed，mobile 是 tag + release assets |
| GitHub repo Latest UI | GitHub Releases 页面里的 Latest 标记 | 给人看的发布标签 | 只允许 desktop 线路出现；mobile 绝不能占用 |

结论很简单：

- Desktop 的自动更新永远走 `desktop-latest`。
- Mobile 的自动更新永远走 `mobile-latest/mobile-update.json`。
- 程序逻辑都不应该依赖 `releases/latest`。

## Desktop 版本与更新

Desktop 版本仍然由根目录 `package.json` 管理：

1. 修改根目录 `package.json` 的 `version` 字段。
2. 打 tag `desktop-vX.Y.Z`。
3. `release.yml` 构建并发布版本化 release。
4. `release.yml` force-push `desktop-latest` tag，供桌面 updater 读取。

桌面更新配置使用的是：

```text
https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/
```

`electron-updater` 会在这个前缀后面继续读取对应平台的 metadata 文件。

## Mobile 版本与更新

Mobile 版本由 CI 从 `mobile-vX.Y.Z` tag 解析：

1. 从 tag 提取版本号，例如 `mobile-v0.2.0` -> `0.2.0`。
2. 自动计算 `versionCode = MAJOR * 10000 + MINOR * 100 + PATCH`。
3. 构建前覆盖 `apps/mobile/app.json` 中的 `version` 和 `versionCode`。
4. 生成两个 mobile 产物：
   - 版本化 release：`mobile-vX.Y.Z`
   - 稳定机器通道：`mobile-latest`

Mobile 不通过“列出所有 mobile releases”发现更新。它只读固定 manifest：

```text
https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/mobile-update.json
```

manifest 里会给出最新 APK 的下载地址、版本号和 SHA-256。

## Mobile release 规则

`android-release.yml` 必须把两个 mobile release 都显式标记为 `latest=false`：

```bash
gh release create mobile-v0.2.0 ... --latest=false
gh release create mobile-latest ... --latest=false
```

如果 release 已经存在，更新时也要保持 `latest=false`：

```bash
gh release edit mobile-v0.2.0 --latest=false
gh release edit mobile-latest --latest=false
```

这表示：

- 它们都是正式 release，不是 prerelease。
- 它们都不会抢占 GitHub repo Latest UI。
- Mobile updater 仍然只消费 `mobile-latest/mobile-update.json`。

`mobile-latest` 产物必须至少包含：

- `mobile-update.json`
- 最新 APK 资产
- APK `sha256`，写在 manifest 里或单独作为校验文件

## 本地版本字段

如果想让本地开发环境和 CI 看起来一致，需要同步这几个地方：

| 文件 | 字段 | 说明 |
|------|------|------|
| `apps/mobile/app.json` | `expo.version` | 仅影响本地开发构建；CI 会覆盖 |
| `apps/mobile/package.json` | `version` | npm 包版本，CI 不覆盖 |
| `apps/mobile/src/services/MobileUpdateService.ts` | fallback 值 | 当前版本优先读 `Application.nativeApplicationVersion` / `nativeBuildVersion`，本地开发时回退到 `Constants.expoConfig` |

## 发版示例

### Mobile

```bash
git tag mobile-v0.2.0
git push origin mobile-v0.2.0
```

### Desktop

```bash
git commit -am "调整版本号为X.Y.Z"
git tag desktop-vX.Y.Z
git push origin desktop-vX.Y.Z
```
