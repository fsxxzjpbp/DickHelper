# 自动更新测试指南

> 自动更新只在已打包安装的应用中启用。`npm run dev` 下会显示“开发模式不检查更新”，不能用于端到端验证自动更新。

---

## Desktop 测试

最可靠的桌面测试方式是：**先安装一个旧版本，再发布一个更高版本的 desktop release**，让旧版本客户端从 `desktop-latest` feed 中发现更新。

以从 `2.0.3` 升级到 `2.0.4` 为例：

1. 从 GitHub Release 下载并安装旧版本 `v2.0.3`。
2. 确认新版本代码中的 `package.json` 为：

   ```json
   {
     "version": "2.0.4"
   }
   ```

3. 创建并推送桌面端 tag：

   ```bash
   git tag desktop-v2.0.4
   git push origin desktop-v2.0.4
   ```

4. 等待 Release workflow 完成。
5. 在 GitHub Release 页面确认上传了安装包、blockmap 和 updater metadata。
6. 打开已安装的 `2.0.3` 客户端，等待启动自动检查，或进入设置页手动点击检查更新。
7. 看到更新弹窗后，点击下载，确认设置页能显示下载进度。
8. 下载完成后点击重启安装，应用重启后确认当前版本变为 `2.0.4`。

桌面更新地址应始终指向：

```text
https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/latest.yml
```

镜像源对应地址：

```text
https://ghfast.top/https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/latest.yml
```

不要再使用 `releases/latest`。那条路径会把发布策略绑到 GitHub 的 repo Latest UI 上，而桌面 updater 只应该依赖 `desktop-latest`。

---

## 版本号规则

Electron updater 比较的是应用包版本，也就是 `package.json.version`。GitHub tag 只是发布入口。

正确对应关系：

| GitHub tag | `package.json.version` |
|------------|------------------------|
| `desktop-v2.0.4` | `2.0.4` |

注意事项：

- tag 必须是 `desktop-vX.Y.Z`，例如 `desktop-v2.0.4`。
- `package.json.version` 必须是不带 `v` 的 `X.Y.Z`。
- 新版本号必须高于已安装版本，否则客户端不会提示更新。
- 当前 release workflow 会在版本不匹配时提前失败，避免发布错误 metadata。
- 当前配置不启用 prerelease 更新。
- Desktop 是唯一允许占用 GitHub repo Latest UI 的线路；mobile release 不得占用。

---

## Release 资产检查

自动更新依赖 `electron-builder` 生成的 metadata 文件。Release 里必须同时存在 metadata 和它引用的原始文件名，不能重命名安装包后只上传旧 metadata。

按平台检查：

| 平台 | 必需资产 |
|------|----------|
| Windows | `latest.yml`、`*.exe`、`*.exe.blockmap` |
| macOS | `latest-mac.yml`、`*.dmg`、`*.zip`、`*.zip.blockmap` |
| Linux | `latest-linux.yml`、`*.AppImage`、`*.AppImage.blockmap` |

可以下载 metadata 文件并检查其中的 `path` / `files.url` 是否能在同一个 Release 中找到对应文件。

---

## Mobile 测试

Mobile 不通过枚举 releases 发现更新。它只读固定 manifest：

```text
https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/mobile-update.json
```

最新 APK 资产地址为：

```text
https://github.com/zzzdajb/DickHelper/releases/download/mobile-latest/DickHelper-mobile-latest.apk
```

建议在旧版本 mobile 客户端上验证：

1. 安装一个较旧的 mobile APK。
2. 确认 `mobile-vX.Y.Z` 和 `mobile-latest` 都已发布，且都不是 repo Latest。
3. 打开旧版本客户端，确认启动时自动检查会命中 `mobile-update.json`。
4. 在设置页手动点击检查更新，确认可以再次触发同一条检查路径。
5. 确认 UI 显示的版本号、下载入口和安装入口都来自固定 manifest，而不是 release 列表。
6. 下载完成后走 Android 系统安装器，确认新版 APK 安装成功。

如果当前源失败，应用只会显示错误并提示切换更新源，不会自动回退到另一个源。这是预期行为。`mobile-update.json` 和 APK 下载必须始终走同一个源。

---

## 发布前快速检查

在发 tag 前建议先做这些检查：

```bash
npx tsc -b --noEmit
npm run build
```

完整安装包和 updater metadata 以 GitHub Actions 的 Release workflow 输出为准。Windows 本机运行 `electron-builder` 时可能受符号链接权限影响，遇到本地权限问题时优先以 CI 结果判断。
