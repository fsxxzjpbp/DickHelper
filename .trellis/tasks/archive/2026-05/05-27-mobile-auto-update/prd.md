# Mobile Auto Update Research

## Goal

研究 DickHelper 移动端如何实现更新能力，重点评估基于 GitHub Releases 的 APK 更新方案，以及是否需要同时引入 Expo OTA 更新能力；要求沿用桌面端“GitHub / 镜像源可切换”的思路，并结合当前仓库结构、发布流程和 Android / Expo 的能力边界收敛为可实施方案。

## What I already know

* 用户设想：移动端去 GitHub 拉 Release，同时支持镜像源切换。
* 桌面端已实现更新源切换，核心在 `src/main/updateService.ts`，通过 `github` / `mirror` 两个源切换 feed URL。
* 当前移动端位于 `apps/mobile/**`，设置页还没有更新入口，只有导入导出和关于信息。
* 当前移动端发布流程已经存在：`.github/workflows/android-release.yml` 会在 `mobile-v*.*.*` tag 下构建 APK 并发布到 GitHub Release。
* 当前移动端实现契约 `docs/mobile-implementation-contract.md` 明确把 “APK 自更新和 GitHub Releases 下载” 列为后置范围，且禁止在 Phase 1 设置页加入更新入口。

## Assumptions (temporary)

* 本次先做方案研究，不直接实现。
* 目标平台仍然是 Android，iOS 不纳入本次设计。
* 可以接受“应用内检查/下载 + 系统安装器确认”，不要求企业级静默安装。
* 如果需要 OTA，允许新增 `expo-updates` 及对应配置。

## Open Questions

* 无

## Requirements (evolving)

* 本任务采用 APK-only 方案，不引入 Expo OTA 更新。
* 移动端从 GitHub Release 体系检查新 APK，并支持 GitHub 直连 / 镜像源切换。
* 方案必须兼容当前 monorepo 和移动端发布流程。
* 方案必须解释 Android/Expo 下“自动更新”能自动到什么程度。
* 方案必须避免桌面端与移动端 release channel 互相污染。
* 需要更新移动端实现契约，移除/改写 Phase 1 中对更新入口、更新源选择、APK 自更新的禁止表述，使之符合正式开发阶段。
* 需要定义独立的 `mobile-latest` 清单/资源发布约定，不能直接依赖 GitHub `releases/latest`。

## Acceptance Criteria (evolving)

* [x] 明确区分 OTA 更新与 APK 整包更新的能力边界。
* [x] 给出推荐方案及至少一个备选方案。
* [x] 给出镜像源设计建议与 URL 组织方式。
* [x] 给出需要改动的主要模块与 CI / 发布流程方向。
* [x] 给出是否需要更新实现契约文档的结论。
* [x] 明确更新检查触发时机与用户交互方式。
* [x] 明确 `mobile-latest` 产物形态：manifest、apk、校验信息。

## Definition of Done (team quality bar)

* Research artifacts written under `research/`
* Constraints from repo/docs captured
* Recommended technical direction documented
* Risks and out-of-scope items called out

## Out of Scope (explicit)

* 本 turn 不直接实现移动端更新功能
* iOS 更新方案
* 应用商店分发策略
* 企业级静默安装 / MDM 方案

## Technical Notes

* Desktop update reference: `src/main/updateService.ts`
* Desktop settings UI reference: `src/renderer/views/Settings.tsx`
* Mobile settings entry point: `apps/mobile/app/settings/index.tsx`
* Mobile DB/settings infra: `apps/mobile/src/services/MobileDatabaseService.ts`
* Shared update types already exist: `packages/shared/src/IUpdate.ts`
* Mobile release workflow: `.github/workflows/android-release.yml`
* Contract conflict:
  * `docs/mobile-implementation-contract.md` section 2/7/10 currently forbids update entry points in Phase 1 and puts APK self-update in post-Phase scope.
* Research References
  * `research/mobile-update-options.md`

## Technical Approach

* 采用 APK-only 更新链路：
  * App 拉取 `mobile-update.json`
  * 比较远端 `versionCode` 与本地版本
  * 有更新时展示下载入口
  * 下载 APK 到本地缓存
  * 交给 Android 系统安装器完成安装
* 更新检查策略：
  * 启动时自动检查一次
  * 设置页保留“手动检查更新”
* 更新源沿用桌面端思路，提供：
  * `github`
  * `mirror`
* Release 侧新增 `mobile-latest` 约定，避免使用 `releases/latest`
* `mobile-latest` 产物至少包括：
  * `mobile-update.json`
  * 当前最新 APK 资源
  * APK `sha256` 校验值（可放入 manifest，也可单独产出）
* 文档侧需要更新 `docs/mobile-implementation-contract.md`，把移动端更新从“后置禁止项”调整为当前正式开发范围。

## Decision (ADR-lite)

**Context**: 需要为 Android Expo 版本增加正式更新能力，同时保持与桌面端一致的“GitHub / 镜像源”产品思路。

**Decision**: 先实现 APK-only 更新，不引入 Expo OTA。发布侧通过 `mobile-latest` 清单和 APK 资源提供更新信息；客户端负责检查、下载并唤起系统安装器。

**Consequences**:

* 优点：实现路径与现有 GitHub Release 流程最一致，镜像源策略简单。
* 限制：不能静默安装；普通 JS/UI 修复也需要重新发 APK。
* 文档约束必须先更新，否则会和当前移动端契约冲突。

## Implementation Plan (small PRs)

* PR1: 更新契约与发布约定文档，定义 APK-only 更新范围和 `mobile-latest` 产物
* PR2: 扩展 Android release workflow，生成并发布 `mobile-update.json` 与稳定 latest 资源
* PR3: 实现移动端 UpdateService、设置持久化、启动自动检查与设置页更新 UI
* PR4: 补齐错误处理、安装引导、校验与质量检查
