# CHANGELOG 0.0.2

自 0.0.1 以来的净变更：PC（Windows 桌面）版上线、应用内更新检查、界面独立化与品牌徽标，
版本规则切换为「三段正式版本 + CI 注入构建号」，CI 两条流水线与主 App 同源整改。

## 新增

- **PC 桌面版（Electron）**：Expo Web 静态导出 + `desktop/` 壳（`slite:` 协议服务静态产物、vault 文件 IPC、另存为对话框）。
  存储、分享、安装按平台分文件（`vault-fs` / `file-export` / `installer` 的 `.web` 实现）：
  桌面端笔记仍在 `%APPDATA%\SlyWrite Lite\vault\` 下为真实 `.md` 文件，浏览器端回退 localStorage。
  构建链：`npm run build:desktop`（导出 + strip + electron-builder portable exe）；`npm run verify:desktop` 冒烟。
- **应用内「更新与版本」页**（`app/updates.tsx` + `src/lib/releases.ts`）：匿名 GET 公开 Release 元数据检查更新，
  Android 端下载附件 APK 交系统安装界面完成安装；桌面端按钮改为打开发布页下载。全程无凭据、无远端写入。
- **品牌标识**（`src/components/BrandName.tsx`）：「SlyWrite + 边框底色 Lite 徽标」统一渲染，徽标固定银灰、不随主题强调色。
- **按压与入场动效**（`src/components/PressFX.tsx`）与 `slide_from_right` 页面转场。
- **预览 iframe 组件**（`src/components/HtmlPreview.web.tsx`）：桌面/Web 端以 sandbox 隔离渲染，双链经 postMessage 回传。

## 改进

- **界面文案独立化**：界面不再出现 SlyWrite、牧羊人图书馆、GitHub、Token、账号等对照性说明，只讲本机存储、备份、预览与更新。
- **版本规则切换**：仓库字段只维护三段正式版本 `A.B.C`；第四位构建号由 CI 注入（`scripts/ci-version.js`，
  写成 semver 前发布 `A.B.C-<run_number>`），产物命名 `slywrite-lite-v{A.B.C-N}-release` / `-pc`，仓库里不再出现四段号。
- 预览加载根路径，消除 not-found 页闪现。

## 修复

- **桌面/Web 首屏 React hydration 崩溃（#418/#425）**：SDK 52 `web.output: "static"` 强制预渲染与异步存储首帧必然不一致，
  新增 `scripts/strip-hydration.js` 在导出后剥离预渲染内容与 hydrate 标记（`build:web` 已串联）。
- **PC CI 秒退真因**：注入版本改回 semver 前发布写法——electron-builder 拒收四段点分号 `0.0.1.48`（Invalid version 即败）；
  并启用 Win32 长路径注册表、打包参数显式 `--x64 --publish never`、`CSC_IDENTITY_AUTO_DISCOVERY=false` 禁自动签名探测，
  失败时把 electron-builder 日志尾部写入公开 annotation 并留存 artifact。

## 构建与发布（CI）

- 新增 `.github/workflows/build-pc.yml`，与 build-apk.yml 完全独立；两条流水线共用三段版本号：
  push main / 手动触发 = 测试构建（注入第四位，产物只出 artifact）；推送 `vA.B.C` tag = 正式发布（创建 Release 挂 APK，PC 构建成功后把 exe 追加为附件）。
- Android CI 不再依赖 `android-actions/setup-android`（该 action 写死的 commandline-tools 构建号已被 Google 清理，必 404），
  改用 runner 镜像自带 Android SDK + `sdkmanager` 按需补装，与主 App 同源。
- 正式构建（`--official`）同样以构建号填 `versionCode`，保证装过测试包的设备能装上正式包。
- `setup-java` 升 v5；`package.json` 补 `author` / `description` 消除 electron-builder 警告。

## 硬约束记录

- 未引入 GitHub Token / expo-secure-store / 任何凭据存储；无向远端写入的逻辑（更新检查为匿名只读）。
- 界面文案与代码注释无 emoji；UI 全部直角；颜色走 `useTheme()` 色板。
