# CHANGELOG 0.1.0

SlyWrite Lite 首个功能版本：完全本地、零账号、零 Token 的 Markdown 笔记本。
笔记为应用私有目录下的真实 .md 文件（YAML front-matter），可与 Obsidian / Joplin 互通；不联网写仓库、不发布、不自更新。

## 新增

- 主题设置存储（`src/store/settings-store.ts`）：themeMode 持久化到 AsyncStorage（键 `slywrite-lite-theme-mode`），
  满足 `src/theme.ts` 的依赖；提供 11 种模式（跟随系统 / 浅色 / 深色 / 暖米 / 雾蓝 / 森绿 / 日暮 / 海洋 / 薰衣草 / 咖啡 / 薄荷）的中文名与说明。
- front-matter 解析（`src/lib/frontmatter.ts`）：纯函数、零依赖；只认文件开头第一对 `---`，
  支持 `tags: [a, b]` 与 `[]`，缺字段全部给默认值；提供序列化、摘要提取（去 Markdown 记号前 80 字）与中日韩按字 / 拉丁按词的字数统计。
- 笔记仓库（`src/lib/notes-vault.ts`）：`notes/` 读写、置顶优先按更新时间倒序的列表、新建 / 保存 / 删除移入 `.trash/`、
  回收站恢复与彻底删除、整体导出 / 导入 JSON 备份（同名跳过不覆盖、导入重新规范化）、存储统计、单篇分享临时文件；
  所有读写失败抛出中文说明的 Error 供界面直接展示。
- 双链（`src/lib/links.ts`）：`[[标题]]` 提取去重、反向链接查找、渲染前替换为 `slywrite-lite://note/<标题>` 站内链接，
  指向不存在笔记的加 `sl-wiki-missing` 样式。
- 预览渲染（`src/lib/preview.ts` + `src/lib/fallback-style.ts`）：marked 渲染后处理 `==高亮==`、任务方框（纯文字 `[ ]` / `[x]`，不用字体图标）、
  含公式时注入 MathJax 3（与牧羊人图书馆站点规范一致）；可选拉取公开站点 CSS（AsyncStorage 缓存 24 小时，键 `slywrite-lite-site-css`），
  失败或超时静默回退内置中文阅读排版（明暗两套，全部直角）；输出按 `force-dark-mode` / `force-light-mode` 适配深浅色。
- 组件（`src/components/`）：ReadOnlyText（分块只读滚动浏览）、HtmlPreview（WebView，新增 `onSchemeRequest` 拦截自定义 scheme）、
  MarkdownEditor（仅受控模式，22 项笔记向工具栏预设，保留数学符号面板与锁定态）。
- 笔记列表状态（`src/store/notes-store.ts`）：只存元数据不存正文；搜索（标题 / 摘要 / 标签小写包含）、标签过滤、
  更新 / 创建 / 标题三种排序（置顶永远排前）、单条 upsert 与错误展示。
- 路由页（`app/`）：根布局（Stack + 主题 + 首次加载，无登录门禁）、笔记本首页（品牌行统计、搜索、标签 chips、排序、
  卡片列表、新建、回收站 / 设置入口）、笔记页（编辑 / 预览分段、标题 / 标签 / 状态 / 置顶编辑、600ms 防抖自动保存与离开即落盘、
  双链跳转与缺失时询问创建、反向链接区块、改名时提示会断开已有双链、删除进回收站、系统分享导出此篇、插入双链选择器）、回收站、设置
  （主题模式、备份导出 / 导入 / 删除、存储统计、输入文字确认的清空全部笔记、关于）、未匹配路由兜底。
- 空白笔记不留壳：新建后一个字都没写就返回，该篇直接删除（不进回收站），笔记本不会被空文件淹没。
- 预览中的 http(s) 外链交系统浏览器打开，不会把笔记页替换掉；自定义 scheme 仍由 App 内双链跳转处理。
- 应用图标：`src/assets/shephrdsLibraryWriteWithBackround.png`（`app.json` 引用所需，自 SlyWrite 资源目录复制一份，Lite 自持）。

## 改进

无（首版功能）。

## 修复

- 工具栏「待办 / 已完成」不再把光标占位符 `§` 当作正文写进笔记（改为插入 `- [ ] ` / `- [x] ` 并把光标留在方框之后）。
- 文件信息读取按 expo-file-system SDK 52 的 `FileInfo` 联合类型正确收窄（该类型只有 `modificationTime`，没有 `mtime`；`size` 与时间字段只存在于「文件存在」分支），
  回收站与备份列表不再因取不到字段而类型不通过或读到 undefined。
- 内置排版样式（`src/lib/fallback-style.ts`）改为 TypeScript 常量导出，避免 `require()` 加载 CSS 资源在 Metro 下的额外不确定性与配置成本。

## 硬约束记录

- 未引入 GitHub Token / expo-secure-store / 任何凭据存储；无任何向远端写入的逻辑。
- 唯一外部网络行为：预览时 GET 公开站点 CSS，失败静默回退内置样式。
- 界面文案与代码注释无 emoji；UI 全部直角（无 borderRadius）；颜色走 `useTheme()` 色板。
