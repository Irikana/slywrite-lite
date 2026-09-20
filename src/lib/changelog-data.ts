// 自动生成：node scripts/gen-changelog.js —— 请勿手改
// 静态内置的全部更新日志（与 changelog/CHANGELOG-*.md 同步），App 内离线展示。
// 开发者节（构建与发布 / 硬约束记录 / 规则与文档等）不收录，界面只讲本机功能。
export type ChangelogBlockKind = 'section' | 'bullet';

export interface ChangelogBlock {
  kind: ChangelogBlockKind;
  text: string;
}

export interface ChangelogEntry {
  /** 版本号，如 0.0.3 */
  key: string;
  /** 文件头之后的摘要段落，显示在版本卡片顶部 */
  summary: string;
  /** 摘要缺失时的兜底标题 */
  title: string;
  blocks: ChangelogBlock[];
}

export const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    "key": "0.0.1",
    "summary": "首个功能版本：只在设备上运行的 Markdown 笔记本。 笔记为应用私有目录下的真实 .md 文件（YAML front-matter），可与 Obsidian / Joplin 互通；数据不出本机。",
    "title": "首个功能版本：只在设备上运行的 Markdown 笔记本。 笔记为应用私有目录下的真实 .md 文件（YAML front-matter），可与 Obsidian / Joplin 互通；数据不出本机。",
    "blocks": [
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "主题设置存储（`src/store/settings-store.ts`）：themeMode 持久化到 AsyncStorage（键 `slywrite-lite-theme-mode`）， 满足 `src/theme.ts` 的依赖；提供 11 种模式（跟随系统 / 浅色 / 深色 / 暖米 / 雾蓝 / 森绿 / 日暮 / 海洋 / 薰衣草 / 咖啡 / 薄荷）的中文名与说明。"
      },
      {
        "kind": "bullet",
        "text": "front-matter 解析（`src/lib/frontmatter.ts`）：纯函数、零依赖；只认文件开头第一对 `---`， 支持 `tags: [a, b]` 与 `[]`，缺字段全部给默认值；提供序列化、摘要提取（去 Markdown 记号前 80 字）与中日韩按字 / 拉丁按词的字数统计。"
      },
      {
        "kind": "bullet",
        "text": "笔记仓库（`src/lib/notes-vault.ts`）：`notes/` 读写、置顶优先按更新时间倒序的列表、新建 / 保存 / 删除移入 `.trash/`、 回收站恢复与彻底删除、整体导出 / 导入 JSON 备份（同名跳过不覆盖、导入重新规范化）、存储统计、单篇分享临时文件； 所有读写失败抛出中文说明的 Error 供界面直接展示。"
      },
      {
        "kind": "bullet",
        "text": "双链（`src/lib/links.ts`）：`[[标题]]` 提取去重、反向链接查找、渲染前替换为 `slywrite-lite://note/<标题>` 站内链接， 指向不存在笔记的加 `sl-wiki-missing` 样式。"
      },
      {
        "kind": "bullet",
        "text": "预览渲染（`src/lib/preview.ts` + `src/lib/fallback-style.ts`）：marked 渲染后处理 `==高亮==`、任务方框（纯文字 `[ ]` / `[x]`，不用字体图标）、 含公式时注入 MathJax 3；可选拉取公开站点 CSS（AsyncStorage 缓存 24 小时，键 `slywrite-lite-site-css`）， 失败或超时静默回退内置中文阅读排版（明暗两套，全部直角）；输出按 `force-dark-mode` / `force-light-mode` 适配深浅色。"
      },
      {
        "kind": "bullet",
        "text": "组件（`src/components/`）：ReadOnlyText（分块只读滚动浏览）、HtmlPreview（WebView，新增 `onSchemeRequest` 拦截自定义 scheme）、 MarkdownEditor（仅受控模式，22 项笔记向工具栏预设，保留数学符号面板与锁定态）。"
      },
      {
        "kind": "bullet",
        "text": "笔记列表状态（`src/store/notes-store.ts`）：只存元数据不存正文；搜索（标题 / 摘要 / 标签小写包含）、标签过滤、 更新 / 创建 / 标题三种排序（置顶永远排前）、单条 upsert 与错误展示。"
      },
      {
        "kind": "bullet",
        "text": "路由页（`app/`）：根布局（Stack + 主题 + 首次加载，无登录门禁）、笔记本首页（品牌行统计、搜索、标签 chips、排序、 卡片列表、新建、回收站 / 设置入口）、笔记页（编辑 / 预览分段、标题 / 标签 / 状态 / 置顶编辑、600ms 防抖自动保存与离开即落盘、 双链跳转与缺失时询问创建、反向链接区块、改名时提示会断开已有双链、删除进回收站、系统分享导出此篇、插入双链选择器）、回收站、设置 （主题模式、备份导出 / 导入 / 删除、存储统计、输入文字确认的清空全部笔记、关于）、未匹配路由兜底。"
      },
      {
        "kind": "bullet",
        "text": "空白笔记不留壳：新建后一个字都没写就返回，该篇直接删除（不进回收站），笔记本不会被空文件淹没。"
      },
      {
        "kind": "bullet",
        "text": "预览中的 http(s) 外链交系统浏览器打开，不会把笔记页替换掉；自定义 scheme 仍由 App 内双链跳转处理。"
      },
      {
        "kind": "bullet",
        "text": "应用图标：`src/assets/shephrdsLibraryWriteWithBackround.png`（`app.json` 引用所需，Lite 自持一份）。"
      },
      {
        "kind": "section",
        "text": "改进"
      },
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "工具栏「待办 / 已完成」不再把光标占位符 `§` 当作正文写进笔记（改为插入 `- [ ] ` / `- [x] ` 并把光标留在方框之后）。"
      },
      {
        "kind": "bullet",
        "text": "文件信息读取按 expo-file-system SDK 52 的 `FileInfo` 联合类型正确收窄（该类型只有 `modificationTime`，没有 `mtime`；`size` 与时间字段只存在于「文件存在」分支）， 回收站与备份列表不再因取不到字段而类型不通过或读到 undefined。"
      },
      {
        "kind": "bullet",
        "text": "内置排版样式（`src/lib/fallback-style.ts`）改为 TypeScript 常量导出，避免 `require()` 加载 CSS 资源在 Metro 下的额外不确定性与配置成本。"
      }
    ]
  },
  {
    "key": "0.0.2",
    "summary": "自 0.0.1 以来的净变更：PC（Windows 桌面）版上线、应用内更新检查、界面独立化与品牌徽标， 版本规则切换为「三段正式版本 + CI 注入构建号」，CI 两条流水线与主 App 同源整改。",
    "title": "自 0.0.1 以来的净变更：PC（Windows 桌面）版上线、应用内更新检查、界面独立化与品牌徽标， 版本规则切换为「三段正式版本 + CI 注入构建号」，CI 两条流水线与主 App 同源整改。",
    "blocks": [
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "**PC 桌面版（Electron）**：Expo Web 静态导出 + `desktop/` 壳（`slite:` 协议服务静态产物、vault 文件 IPC、另存为对话框）。 存储、分享、安装按平台分文件（`vault-fs` / `file-export` / `installer` 的 `.web` 实现）： 桌面端笔记仍在 `%APPDATA%\\SlyWrite Lite\\vault\\` 下为真实 `.md` 文件，浏览器端回退 localStorage。 构建链：`npm run build:desktop`（导出 + strip + electron-builder portable exe）；`npm run verify:desktop` 冒烟。"
      },
      {
        "kind": "bullet",
        "text": "**应用内「更新与版本」页**（`app/updates.tsx` + `src/lib/releases.ts`）：匿名 GET 公开 Release 元数据检查更新， Android 端下载附件 APK 交系统安装界面完成安装；桌面端按钮改为打开发布页下载。全程无凭据、无远端写入。"
      },
      {
        "kind": "bullet",
        "text": "**品牌标识**（`src/components/BrandName.tsx`）：「主名 + 边框底色 Lite 徽标」统一渲染，徽标固定银灰、不随主题强调色。"
      },
      {
        "kind": "bullet",
        "text": "**按压与入场动效**（`src/components/PressFX.tsx`）与 `slide_from_right` 页面转场。"
      },
      {
        "kind": "bullet",
        "text": "**预览 iframe 组件**（`src/components/HtmlPreview.web.tsx`）：桌面/Web 端以 sandbox 隔离渲染，双链经 postMessage 回传。"
      },
      {
        "kind": "section",
        "text": "改进"
      },
      {
        "kind": "bullet",
        "text": "**界面文案独立化**：界面措辞改为只讲本机存储、备份、排版预览与更新与版本，不再出现与其他产品对照的说明。"
      },
      {
        "kind": "bullet",
        "text": "**版本规则切换**：仓库字段只维护三段正式版本 `A.B.C`；第四位构建号由 CI 注入（`scripts/ci-version.js`， 写成 semver 前发布 `A.B.C-<run_number>`），产物命名 `slywrite-lite-v{A.B.C-N}-release` / `-pc`，仓库里不再出现四段号。"
      },
      {
        "kind": "bullet",
        "text": "预览加载根路径，消除 not-found 页闪现。"
      },
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "**桌面/Web 首屏 React hydration 崩溃（#418/#425）**：SDK 52 `web.output: \"static\"` 强制预渲染与异步存储首帧必然不一致， 新增 `scripts/strip-hydration.js` 在导出后剥离预渲染内容与 hydrate 标记（`build:web` 已串联）。"
      },
      {
        "kind": "bullet",
        "text": "**PC CI 秒退真因**：注入版本改回 semver 前发布写法——electron-builder 拒收四段点分号 `0.0.1.48`（Invalid version 即败）； 并启用 Win32 长路径注册表、打包参数显式 `--x64 --publish never`、`CSC_IDENTITY_AUTO_DISCOVERY=false` 禁自动签名探测， 失败时把 electron-builder 日志尾部写入公开 annotation 并留存 artifact。"
      }
    ]
  },
  {
    "key": "0.0.3",
    "summary": "自 0.0.2 以来的净变更：预览支持 LaTeX 数学公式渲染，公式不再被 Markdown 排版吃掉； MathJax 改为「真有公式才加载」；网络白名单与发版规则按作者指令更新。",
    "title": "自 0.0.2 以来的净变更：预览支持 LaTeX 数学公式渲染，公式不再被 Markdown 排版吃掉； MathJax 改为「真有公式才加载」；网络白名单与发版规则按作者指令更新。",
    "blocks": [
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "**LaTeX 公式预览**（`src/lib/math-guard.ts`）：在 Markdown 解析之前把公式抽成占位符，渲染完再放回， 公式内容不再被排版规则改写。识别 `$$…$$` 与 `\\[…\\]` 为独立公式、`$…$` 与 `\\(…\\)` 为行内公式， 与注入的 MathJax 配置一套定界符。"
      },
      {
        "kind": "bullet",
        "text": "**代码区识别**：围栏（` ``` ` / `~~~`）、行内反引号与四空格／制表符缩进的代码行不参与公式抽取 （其中的 `$` 只是普通字符），但原样交给 Markdown 解析器渲染，`<code>` / `<pre>` 不受影响。"
      },
      {
        "kind": "bullet",
        "text": "**独立公式排版**（`src/lib/fallback-style.ts` 的 `.sl-math-block`）：居中、上下留白，并把首行缩进归零—— 套用网站 CSS 时正文缩进会把居中的公式推歪。"
      },
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "**工具栏「独立公式」插的公式从来不渲染**：预览按 `breaks: true` 渲染，`$$` 与换行组合会变成 `$$<br>公式<br>$$`，公式被拆进不同文本节点后 MathJax 配不上对，屏幕上只剩原始 LaTeX； 行内公式里的 `_` 会被读成斜体、`\\` 被当成转义、公式内的 `==` 会被后处理读成高亮。现全部规避。"
      },
      {
        "kind": "bullet",
        "text": "**没有公式的笔记不再联网**：加载开关由「正文里出现过 `$`」改为「真的识别出一段公式」， 只写了价格、美元符号的笔记不再去拉 CDN 脚本。"
      },
      {
        "kind": "bullet",
        "text": "**公式里的 `<` `>` `&` 不再截断公式**：抽出时做 HTML 转义。"
      }
    ]
  },
  {
    "key": "0.0.4",
    "summary": "自 0.0.3 以来的净变更：新增应用内「更新日志」页，全部版本的变更说明随应用内置，离线可查。",
    "title": "自 0.0.3 以来的净变更：新增应用内「更新日志」页，全部版本的变更说明随应用内置，离线可查。",
    "blocks": [
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "**应用内「更新日志」页**（`app/changelog.tsx`）：顶部是可横向滑动的版本时间线——菱形节点代表各版本， 游标与进度线标出当前定位的版本；点击节点直接跳到该版本的说明卡片，向下滚动列表时时间线自动跟随。 内容来自 `src/lib/changelog-data.ts`，随应用打包，**不需要联网**即可查看历史全部版本。"
      },
      {
        "kind": "bullet",
        "text": "**两个入口**：首页底部新增「更新日志」按钮，设置页「关于」段同样加入口；首页底部按钮行改为可换行， 窄屏上四个按钮不会被挤出屏幕。"
      },
      {
        "kind": "bullet",
        "text": "**生成脚本 `scripts/gen-changelog.js`**：从 `changelog/CHANGELOG-*.md` 生成上面那份内置数据。 只收录面向读者的节（新增 / 改进 / 修复）与版本摘要，构建与发布、硬约束记录等开发者节不进界面。"
      },
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "**首页底部按钮行在窄屏上会被挤出屏幕**：三个按钮已经贴近小屏宽度，加入「更新日志」后必然溢出； 按钮行改为可换行（换行间距 8px），窄屏下自动折成两行而不是被裁掉。"
      }
    ]
  }
];
