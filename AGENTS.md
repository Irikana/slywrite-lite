# SlyWrite Lite 子项目规范

## 项目性质

- 本目录 `slywrite-lite/` 是**独立子项目**：与同工作区的 `shepherd-library-app/`（SlyWrite）、`Irikana.github.io/`（网站）**互不依赖**。
- 不得 import 或复制运行另外两个子项目的任何源码；Lite 需要的排版样式通过公开站点 URL 在线拉取（可选项），需要的色板在本目录 `src/theme.ts` 内自持一份。
- 改动本目录文件不需要动其他子项目；反之其他子项目的改动也不应波及本目录。

## 规范来源

1. 工作区根目录 `AGENTS.md` 的通用硬性要求（对 Lite 全部生效）。
2. 本文件的 Lite 特有约束。

通用硬性要求摘要（详见根 AGENTS.md）：

- 界面文案与代码注释禁止使用 emoji。
- UI 扁平化，`border-radius: 0`。
- 任何代码改动后必须通过 `npx tsc --noEmit`。
- 每次发版写 `changelog/CHANGELOG-{version}.md`。
- 版本号三处同步：`package.json` 的 `version`、`app.json` 的 `expo.version`、`.github/workflows/build-apk.yml` 的 artifact name（`slywrite-lite-v{version}-release`）。

## 版本号规则（与 SlyWrite 完全一致）

- 版本号采用**四位**：`主.次.修订.构建`，例如 `0.0.1`、`0.0.1.1`、`0.0.15.11`。前三位与 SlyWrite 同规则，第四位是每次正式发布的自增量。
- 版本线从 **0.0.1** 起（此前的 `0.1.0` 首个 CI 构建即失败、从未发布，故重起版本线）。
- **不轻易加 tag，也就是不轻易发版**。日常改动只在 `main` 上累积，`package.json` 的版本号保持不变；
  只有当作者明确说「**添加 tag**」（或明确要求发版）时，才执行：版本号自增第四位 → 三处版本号同步 → 写 changelog → 提交推送。
  push 到 `main` 后 workflow 会从 `package.json` 推导 tag（`v{version}`）并创建 GitHub Release，即视为正式发布。
- 作者未明确要求发版时：可以改代码、可以推送，但不要动版本号、不要建新 tag、不要建新 Release。
- `app.json` 的 `android.versionCode` 与版本号同步自增（每次正式发布 +1，`0.0.1` 为 1）。
- 发布时写 `changelog/CHANGELOG-{version}.md`（第四位自增的小版本可合并写进同一修订号的 changelog，跨修订号则新建文件）。

## Lite 硬约束（不可违反）

- **不得引入 GitHub Token 或任何形式的凭据存储**：不安装 `expo-secure-store`，不出现 personal access token、仓库写入 API 调用、上传/发布到站点的任何逻辑。发布是 SlyWrite 的职责，不是 Lite 的职责。
- **不得联网写任何远端**。允许的外部网络请求只有两类，且都是匿名只读 GET，不带任何凭据：
  1. 从公开站点 URL 以 GET 拉取网站 CSS 文本，仅用于预览排版；拉取失败必须静默回退到内置排版样式，不得报错阻塞功能。
  2. 检查应用更新：匿名 GET 本仓库公开 Release 元数据（`src/lib/releases.ts`），并下载 Release 附件 APK，
     交给系统安装界面完成安装（`app/updates.tsx`）。任何情况下不得上传、提交或写入远端，也不得存储任何凭据。
- **界面文案保持独立**：Lite 的界面（标题、说明、提示、对话框、错误信息）不出现 SlyWrite、牧羊人图书馆、GitHub、Token、账号以及
  「无账号 / 无 Token / 不向远端写入」这类对照性说明；界面只讲本机存储、备份导入导出、排版预览、更新与版本。
  必要的技术标识（应用名 `SlyWrite Lite`、包名 `com.irikana.slywritelite`、更新源的仓库标识常量）不受影响。
  源码注释允许保留来源说明（如「自 SlyWrite 同名组件复制，Lite 自持一份」），它是「不跨子项目引用」这条约束的凭证，不要删。
- **数据只存本机**：笔记为应用私有目录下带 YAML front-matter 的 `.md` 文件；导出/导入是唯一的跨设备通道。单篇可分享/导入 `.md` 原文件；整机备份为 JSON 清单（内含每篇的完整 `.md` 原文，仍可逐篇还原，不引入私有数据库格式）。

## 目录约定

- `app/` — expo-router 路由页（业务代码）；`app/updates.tsx` 是「更新与版本」页（匿名读发布信息 + 应用内下载安装）。
- `src/lib/` — 存储与解析：`.md` 读写、front-matter、导入导出、在线样式拉取与回退、更新检查（`releases.ts`，无凭据）。
- `src/components/` — 编辑器与只读视图组件；`BrandName.tsx` 统一渲染「SlyWrite + 边框底色 Lite 徽标」的品牌标识。
- `src/store/` — zustand 状态（`theme.ts` 依赖 `src/store/settings-store.ts` 的 `useSettingsStore`，新建 store 时注意对齐）。
- `src/assets/` — `app.json` 引用的图标等静态资源（缺图会导致 `expo prebuild` 失败）。
- `changelog/` — 每版本一份 CHANGELOG。

## 构建注意

- **原生 Expo 依赖一律用 `~` 锁在本 SDK 的主版本线**，不要用 `^`。`^16.0.6` 会解到 `expo-image-picker@16.1.x`（SDK 53 线），
  它和它的传递依赖 `expo-image-loader@5.1.x` 的 `android/build.gradle` 写的是 `id 'expo-module-gradle-plugin'`，
  而 SDK 52 的 `expo prebuild` 生成的 `android/settings.gradle` 不含该插件的 `includeBuild`，
  `assembleRelease` 必然报 `Plugin [id: 'expo-module-gradle-plugin'] was not found`（2026-09-11 首次 CI 失败即此因）。
  可用 `npx expo install --check` 复查漂移；改完依赖必须重新生成并提交 `package-lock.json`。
- CI 在 `npm ci` 之后显式跑 `node scripts/patch-android.js`（`package.json` 的 `postinstall` 亦调用，脚本幂等）：
  1. 给 `expo-modules-core/android/ExpoModulesCorePlugin.gradle` 的 `from components.release` 包一层
     `components.findByName('release')` 判空——SDK 52 + AGP 8 的已知问题，症状是配置 `project ':expo'` 时抛
     `Could not get unknown property 'release' for SoftwareComponent container`；补丁结果与
     `shepherd-library-app/scripts/patch-android.js` 逐字节一致。
  2. 扫描被自动链接的模块，若再次出现 SDK 53 才有的 `expo-module-gradle-plugin`，在安装阶段就以中文错误退出，
     不用等几分钟后只看 Gradle 堆栈。
- Lite 不安装 `@expo/dom-webview`，因此本目录的补丁脚本不含主 App 那两项 dom-webview 处理。
  更新检查（`app/updates.tsx`）只做匿名读与本地下载安装，不需要安装期补丁。
- `android/`、`ios/` 是 `expo prebuild` 生成物，已在 `.gitignore` 中，不要提交。
- workflow 依赖 `package-lock.json`（`npm ci` + `cache: 'npm'`），锁文件必须随代码提交。
