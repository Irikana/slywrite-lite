// 生成静态内置更新日志数据：读取 changelog/CHANGELOG-*.md，解析为结构化块，
// 输出 src/lib/changelog-data.ts（App 内「更新日志」页离线展示，不联网）。
// 正式发布链的一步：写完 CHANGELOG 就必须跑一次 `node scripts/gen-changelog.js`，
// 否则 App 里看不到新版本（结构与 SlyWrite 同名脚本同源，Lite 自持一份）。
//
// 本仓库 changelog 的书写约定（决定哪些内容会进 App）：
//   # CHANGELOG x.y.z        文件头，跳过
//   紧跟其后的普通段落        该版本的摘要，显示在版本卡片顶部
//   ## 新增 / 改进 / 修复     面向读者的节，其中每条 `- ` 逐项进入 App
//   ## 构建与发布 / 硬约束记录 / 规则与文档 …
//                            开发者节：命中 DEV_KEYWORDS 即整节不进 App
//                            （这类内容含 CI、凭据、上游项目名等，不属于应用界面）
//   缩进续行                 并入上一条（长条目常换行书写）
//   > 引用块与普通说明行      摘要之外的一律忽略
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG_DIR = path.join(ROOT, 'changelog');
const OUT_FILE = path.join(ROOT, 'src', 'lib', 'changelog-data.ts');

/** 从文件名提取版本号：CHANGELOG-0.0.3.md → 0.0.3 */
const verOf = (name) => name.replace(/^CHANGELOG-/, '').replace(/\.md$/, '');

/** 版本号比较，升序（按点分段取数，缺位补 0） */
const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
};

/** 节标题命中这些关键词即视为开发者内容，整节不进 App 界面 */
const DEV_KEYWORDS = ['构建', '发布', 'CI', '硬约束', '规则', '依赖', '验证'];
const isDevSection = (title) => DEV_KEYWORDS.some((k) => title.includes(k));

function parseChangelog(md, key) {
  const blocks = [];
  const summaryParts = [];
  let inSummary = true;
  let devOnly = false;
  let inBullet = false;

  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) {
      inBullet = false;
      continue;
    }
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      inSummary = false;
      inBullet = false;
      devOnly = isDevSection(title);
      if (!devOnly) blocks.push({ kind: 'section', text: title });
    } else if (line.startsWith('# ')) {
      inBullet = false;
    } else if (line.startsWith('- ') && !devOnly) {
      inSummary = false;
      inBullet = true;
      blocks.push({ kind: 'bullet', text: line.slice(2).trim() });
    } else if (line.startsWith('#') || line.startsWith('>')) {
      inBullet = false;
    } else if (inBullet) {
      // 缩进续行并入上一条，避免长条目被截断
      const last = blocks[blocks.length - 1];
      last.text += ' ' + line;
    } else if (inSummary && !devOnly) {
      summaryParts.push(line);
    }
  }

  const summary = summaryParts.join(' ').trim();
  return { key, summary, title: summary || `v${key}`, blocks };
}

const files = fs
  .readdirSync(CHANGELOG_DIR)
  .filter((f) => f.startsWith('CHANGELOG-') && f.endsWith('.md'))
  .sort((a, b) => compareVersions(verOf(a), verOf(b)));

const entries = files.map((f) => parseChangelog(fs.readFileSync(path.join(CHANGELOG_DIR, f), 'utf8'), verOf(f)));

const data = `// 自动生成：node scripts/gen-changelog.js —— 请勿手改
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

export const CHANGELOG_DATA: ChangelogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

fs.writeFileSync(OUT_FILE, data, 'utf8');
const bullets = entries.reduce((n, e) => n + e.blocks.filter((b) => b.kind === 'bullet').length, 0);
console.log(`生成 ${OUT_FILE}（共 ${entries.length} 个版本，${bullets} 条变更）`);
