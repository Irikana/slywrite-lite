# SlyWrite Lite

完全本地的 Markdown 笔记应用（Expo + React Native + TypeScript）。零账号、零 Token、零云端：不登录、不联网同步，任何数据都只留在设备上。

## 与 SlyWrite 的关系

SlyWrite（牧羊人图书馆写作管理 App）负责内容生产与发布：GitHub Token、提交站点仓库、上传发布等能力全部留在 SlyWrite 一侧。

SlyWrite Lite 与 SlyWrite 互不依赖：

- Lite 没有 GitHub Token，也没有任何写仓库、上传、发布到站点的能力，不联网写任何远端。
- Lite 与外部网络的唯一交集是可选项：从公开站点 URL 拉取网站 CSS，仅用于预览排版效果；拉取失败时自动回退到内置排版样式，不影响任何功能。
- 两个应用各自独立构建、独立发布，不共享代码包，也不读写对方的数据。

## 数据模型

- 一篇笔记就是应用私有目录（`FileSystem.documentDirectory`）下的一个 `.md` 文件。
- 每篇笔记带 YAML front-matter（标题、时间、标签等元数据），正文为 Markdown。
- 支持把全部笔记整体导出为备份包，也支持从备份包整体导入，用于换机与容灾。
- 没有数据库，没有隐藏状态：删掉应用数据即彻底清空，导出文件即全部资产。

## 功能一览

- 笔记本首页：搜索（标题 / 摘要 / 标签）、标签筛选、三种排序（更新 / 创建 / 标题，置顶恒在前）、篇数与总字数统计。
- 笔记页：编辑与预览两段式；标题、标签、状态（草稿 / 进行中 / 归档）、置顶；600ms 防抖自动保存，离开页面立即落盘；
  锁定后可滑动浏览但不能编辑。
- 笔记向 Markdown 工具栏：标题、加粗、斜体、高亮 `==文本==`、删除线、行内代码、代码块、引用、列表、有序、
  待办 `- [ ]`、已完成、表格、链接、双链 `[[标题]]`、图片、分割线、备注块、日期戳、行内与独立公式，另有数学符号面板。
- 双链与反向链接：正文里的 `[[标题]]` 在预览中成为可点链接，指向已有笔记则站内跳转，指向不存在的笔记则询问是否创建；
  页内列出「谁引用了本篇」与「本篇引用了谁」；改名时若仍有引用会提示会断开。
- 预览排版：Markdown 渲染 + 任务方框 + 高亮 + MathJax 公式，优先使用公开站点的网站 CSS（缓存 24 小时），
  拉取失败回退内置中文阅读排版（明暗两套）；正文里的 http(s) 外链交系统浏览器打开。
- 回收站：删除先进回收站，可恢复或彻底删除，可清空。
- 数据管理：整体导出为备份 JSON（可经系统分享发走）、从 `backups/` 选择导入（同名跳过不覆盖）、删除旧备份、存储统计。
- 11 套主题模式（含跟随系统），深浅色跟随主题设置；扁平化直角风格。

## 已知边界（v0.1.0）

- 双链按**标题**寻址：改标题会让别处的 `[[旧标题]]` 失效（App 会在改名时提醒，但不会自动改写其它笔记正文）。
- 笔记只存在本机：清应用数据即丢失，换机必须先导出备份。请养成「写完一段就导出一份」的习惯。
- 不做多端同步、不做协同、不做平台侧内容展示；发布到牧羊人图书馆是 SlyWrite 的职责，Lite 刻意不含这些能力。
- 图片以链接形式写在 Markdown 里（网络地址或经分享导出的本地文件），暂不作为附件体系管理。
- 平板（769-1024px）与桌面形态未做专门适配，按手机布局自然放大。

## 目录结构约定

- `app/` — expo-router 路由页面（文件即路由）。
- `src/lib/` — 存储与解析：`.md` 文件读写、front-matter 解析与序列化、导入导出、CSS 拉取与回退。
- `src/components/` — 编辑器与只读视图等全部界面组件。
- `src/store/` — zustand 状态。
- `src/assets/` — 图标等静态资源（`app.json` 中引用的图片放在这里）。
- `src/theme.ts` — 色板与主题 hook（`useTheme`、`SPACING`、`FONT`）。
- `changelog/` — 每版本一份 `CHANGELOG-{version}.md`。
- `.github/workflows/` — 自动构建 Release APK 的 Actions 流程。

## 开发命令

```powershell
npm install     # 安装依赖（首次）
npm start       # 启动 Expo 开发服务器
npm run android # 本机调试 Android
npm run typecheck # 类型检查（tsc --noEmit），提交前必须通过
```

## 构建与发布

推送到 `main`（或手动触发 `Build APK` workflow）后，GitHub Actions 会执行：

1. `npm ci` 安装依赖；
2. `npx expo prebuild --platform android --no-install --clean` 生成原生工程；
3. `./gradlew assembleRelease` 产出 release APK；
4. 上传构建产物（artifact 名为 `slywrite-lite-v{version}-release`）；
5. 按 `package.json` 的 version 创建 GitHub Release 并挂上 APK（tag 已存在时跳过）。

注意：workflow 使用 `npm ci` 与 `cache: 'npm'`，仓库必须提交 `package-lock.json`（本地 `npm install` 后一并提交）。

版本号改动需三处同步：`package.json` 的 `version`、`app.json` 的 `expo.version`、workflow 里的 artifact name。

## 开发规范

通用硬性要求（禁止 emoji、扁平化 `border-radius: 0`、改动后跑 `npx tsc --noEmit`、写 changelog、版本号三处同步）见工作区根目录 `AGENTS.md`；Lite 特有的硬约束见本目录 `AGENTS.md`。
