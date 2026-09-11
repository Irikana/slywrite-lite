// 双链（wiki link）：[[标题]] 的提取、反链查找与 HTML 链接化。
// 链接化后的地址走自定义 scheme slywrite-lite://note/<encodeURIComponent(标题)>，
// 由预览页 WebView 的 onSchemeRequest 拦截，在 App 内完成跳转。
import type { NoteMeta } from './frontmatter';

/** 提取正文中的全部 [[标题]]：去重、去首尾空白，保持出现顺序 */
export function extractWikiLinks(body: string): string[] {
  const re = /\[\[([^\[\]\n]+)\]\]/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const title = m[1].trim();
    if (title && !seen.has(title)) {
      seen.add(title);
      out.push(title);
    }
  }
  return out;
}

/** 反链候选：允许携带 body（有正文按正文查，没有退回摘要粗查） */
export type BacklinkSource = NoteMeta & { body?: string };

/** 标题匹配：完全相等，或拉丁场景大小写不敏感（中文无大小写，等价于精确匹配） */
function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** 哪些笔记的正文引用了该标题（排除自己） */
export function findBacklinks(targetTitle: string, all: BacklinkSource[]): NoteMeta[] {
  const out: NoteMeta[] = [];
  for (const meta of all) {
    if (sameTitle(meta.title, targetTitle)) continue;
    const source = meta.body ?? meta.excerpt;
    const links = extractWikiLinks(source);
    if (links.some((t) => sameTitle(t, targetTitle))) {
      const { body: _body, ...clean } = meta;
      out.push(clean);
    }
  }
  return out;
}

/** 把标题解析为对应笔记（大小写不敏感）；找不到返回 null */
export function findNoteByTitle(title: string, all: NoteMeta[]): NoteMeta | null {
  const hit = all.find((m) => sameTitle(m.title, title));
  return hit || null;
}

/**
 * 把正文中的 [[X]] 替换成站内锚链接。
 * 已有同名笔记 → 正常链接；没有 → 加 class="sl-wiki-missing"（预览里显灰，点击可询问创建）。
 * 注意：必须在 Markdown 渲染前执行，让 marked 把生成的 <a> 原样带进 HTML。
 */
export function resolveWikiLinks(body: string, all: NoteMeta[]): string {
  return body.replace(/\[\[([^\[\]\n]+)\]\]/g, (_full, rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) return '';
    const href = `slywrite-lite://note/${encodeURIComponent(title)}`;
    // 链接文字做 HTML 转义，避免尖括号破坏文档结构
    const text = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cls = findNoteByTitle(title, all) ? ' class="sl-wiki"' : ' class="sl-wiki sl-wiki-missing"';
    return `<a href="${href}"${cls}>${text}</a>`;
  });
}
