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
- 每次正式发布写 `changelog/CHANGELOG-{A.B.C}.md`。
- 版本号遵循根 AGENTS.md「版本号规则（全软件统一）」；本仓库的落点见下文。

## 版本号规则（全软件统一规则的 Lite 落点）

- 格式 `A.B.C.X`：`A.B.C` 正式版本 + `X` 测试构建号。规则全文见根 `AGENTS.md`，Lite 的具体落点：
- **仓库内版本字段只维护三位正式版本**：`package.json.version` 与 `app.json.expo.version` = `0.0.1`。
  日常改动不动版本号、不打 tag、不建 Release；push 与手动触发产生的都是**测试构建**。
- **第四位 X 由 CI 注入，不提交**：`scripts/ci-version.js <run_number>` 在构建开始时把
  `A.B.C.<run_number>` 写进 package.json / app.json（versionCode 也用构建号填充），
  产物命名 `slywrite-lite-v{A.B.C.X}-release` / `slywrite-lite-{A.B.C.X}-pc`，
  所以 artifact 与「关于」页显示的永远是完整四段，而仓库里永远是三段。
  本地 `npm run desktop` / `build:desktop` 不注入，显示三段。
- **正式发布**（作者明确说「正式发布 / 添加 tag」才做）：
  1. 第三位 +1（如 `0.0.1` → `0.0.2`），同步 package.json 与 app.json 两处；
  2. 写 `changelog/CHANGELOG-{新版本}.md`（概述自上一正式版以来累积的变更）；
  3. commit + push 后打 tag `v{A.B.C}` 并推送（GitHub Desktop 或 `git push origin v...`）；
  4. tag 触发 build-apk.yml / build-pc.yml 的正式分支：产物为三段版本，创建 Release 并挂 APK + PC exe。
- 历史：`0.0.1`（2026-09 发布，Android 单端）属旧规则时期产物，保持原样不回改；
  PC 版自本次起与 APK 共用同一版本线与同一 Release。

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
  - PC 版同义保证：桌面壳（Electron）下「应用私有目录」= `%APPDATA%\SlyWrite Lite\vault\`，仍是真实 `.md` 文件；
    存储、分享、安装全部经平台分文件（`vault-fs` / `file-export` / `installer` 的 `.web.ts` 实现），
    Web 产物只打包匿名只读请求（发布页 / 站点 CSS），**没有也不得有**任何凭据或远端写入通道。

## 目录约定

- `app/` — expo-router 路由页（业务代码）；`app/updates.tsx` 是「更新与版本」页（匿名读发布信息 + 应用内下载安装；桌面版按钮改为打开发布页下载）。
- `src/lib/` — 存储与解析：`.md` 读写、front-matter、导入导出、在线样式拉取与回退、更新检查（`releases.ts`，无凭据）。
  - 平台分文件（Metro 按 `.web` 后缀自动选择，两端签名必须保持一致）：
    `vault-fs.ts(.web)` 底层文件接口、`file-export.ts(.web)` 文件交付（分享面板 / 另存为）、`installer.ts(.web)` 更新包安装。
  - **原生专属模块（expo-file-system / expo-intent-launcher / expo-sharing）只允许出现在 `.ts` 版实现里**，
    否则会被打进 Web/桌面 bundle 并在运行时报错。
- `src/components/` — 编辑器与只读视图组件；`BrandName.tsx` 统一渲染「SlyWrite + 边框底色 Lite 徽标」的品牌标识（徽标固定银灰，不随主题强调色）。
- `src/store/` — zustand 状态（`theme.ts` 依赖 `src/store/settings-store.ts` 的 `useSettingsStore`，新建 store 时注意对齐）。
- `src/assets/` — `app.json` 引用的图标等静态资源（缺图会导致 `expo prebuild` 失败）。
- `desktop/` — Electron 壳（`main.js` 主进程：slite 协议服务静态产物 + vault 文件 IPC + 另存为对话框；`preload.js` 仅经 contextBridge 暴露这两类能力）。
- `scripts/strip-hydration.js` — 桌面/ Web 导出后处理：剥离预渲染内容与 hydrate 标记（原因见「构建注意」）。
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

### PC（桌面）构建

- 命令：`npm run build:desktop`（= `build:web` 静态导出 + strip + `electron-builder --win portable`）；
  开发直跑：`npm run desktop`。产物在 `desktop-build/`（已 gitignore），版本号从 `package.json` 推导
  （`slywrite-lite-{version}-win-x64.exe`），与 APK 共用同一发布 tag，不单独动版本号。
- CI：`.github/workflows/build-pc.yml`，与 build-apk.yml 完全独立；Release 存在时才把 exe 追加为附件，不建 tag。
- **hydration 坑（必须保留 strip-hydration.js）**：SDK 52 的 `web.output: "static"` 强制预渲染整棵树并注入
  `__EXPO_ROUTER_HYDRATE__`，本应用首屏依赖异步存储，SSR 与客户端首帧必然不一致，React 18 hydration 直接抛
  #418/#425。导出后必须跑 `node scripts/strip-hydration.js dist-web` 把预渲染剥掉（`build:web` 已串联）。
- Web 端 `react-dom` 必须与 `react` 严格同版本（18.3.1），不要单独升级。
- Electron 壳不走 npm 发包：`desktop/package.json` 只是 `electron desktop` 的入口声明；
  打包入口由 `electron-builder.yml` 的 `extraMetadata.main` 覆盖根 `main` 字段，两者互不干扰。
