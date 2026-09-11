// Markdown 笔记的 front-matter 解析与序列化（纯函数、零依赖）。
// 约定：文件开头第一对 --- 之间为 front-matter；正文中再出现的 --- 不参与解析。
// 与 Obsidian / Joplin 的手写 front-matter 互通：只支持 title / tags / created / updated / status / pinned 六个键，
// 未知键直接丢弃；任何缺字段或格式异常一律回退默认值，绝不抛错。

/** 笔记状态：draft 草稿 / active 进行中 / archived 归档 */
export type NoteStatus = 'draft' | 'active' | 'archived';

/** 状态中文文案（界面统一从这里取，避免散落硬编码） */
export const STATUS_LABELS: Record<NoteStatus, string> = {
  draft: '草稿',
  active: '进行中',
  archived: '归档',
};

/** 列表项元数据（不含正文，省内存） */
export interface NoteMeta {
  id: string;
  file: string;
  title: string;
  tags: string[];
  /** 创建日期 YYYY-MM-DD */
  created: string;
  /** 更新日期 YYYY-MM-DD HH:mm */
  updated: string;
  status: NoteStatus;
  pinned: boolean;
  excerpt: string;
  words: number;
}

/** 完整笔记 = 元数据 + 正文 */
export interface Note extends NoteMeta {
  body: string;
}

const FRONT_DELIM = /^---[ \t]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;
const STATUSES: NoteStatus[] = ['draft', 'active', 'archived'];

/** 本地时间的 YYYY-MM-DD */
export function todayDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地时间的 YYYY-MM-DD HH:mm */
export function nowStamp(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${todayDate(d)} ${hh}:${mi}`;
}

/** 从文件名推导标题：去扩展名，作为 front-matter 缺 title 时的回退 */
function titleFromFile(file: string): string {
  const base = file.split('/').pop() || file;
  return base.replace(/\.(md|markdown)$/i, '') || '未命名笔记';
}

/** 解析 tags 值：支持 [a, b] 与 []，也容忍 a, b 的裸写法 */
function parseTags(raw: string): string[] {
  let s = raw.trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  return s
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter((t) => t.length > 0);
}

/**
 * 把原始 md 文本解析为 Note。
 * 容错要求：无 front-matter、键缺失、值格式错误都给出默认值，绝不报错。
 */
export function parseNote(raw: string, file: string): Note {
  let body = raw;
  const fields: Record<string, string> = {};

  // 只认文件开头的第一对 ---；找不到闭合分隔符则视为没有 front-matter（正文不被吞掉）
  const lines = raw.split(/\r?\n/);
  if (lines.length > 0 && FRONT_DELIM.test(lines[0])) {
    const close = lines.findIndex((l, i) => i > 0 && (FRONT_DELIM.test(l) || /^\.\.\.[ \t]*$/.test(l)));
    if (close > 0) {
      for (let i = 1; i < close; i++) {
        const m = lines[i].match(/^([A-Za-z_][\w-]*)[ \t]*:[ \t]?(.*)$/);
        if (m) fields[m[1].toLowerCase()] = m[2];
      }
      body = lines.slice(close + 1).join('\n');
    }
  }

  const title = (fields.title || '').trim() || titleFromFile(file);
  const tags = fields.tags !== undefined ? parseTags(fields.tags) : [];

  let created = (fields.created || '').trim();
  if (!DATE_RE.test(created)) {
    // 只有日期部分（如 YAML 输出 2026-09-11T00:00:00）截断后再验一次
    const m = created.match(/^(\d{4}-\d{2}-\d{2})/);
    created = m ? m[1] : todayDate();
  }

  let updated = (fields.updated || '').trim();
  if (DATETIME_RE.test(updated)) {
    updated = updated.replace(' ', ' ').replace('T', ' ');
  } else {
    const m = updated.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    updated = m ? `${m[1]} ${m[2]}` : created === todayDate() ? nowStamp() : `${created} 00:00`;
  }

  let status = (fields.status || '').trim().toLowerCase() as NoteStatus;
  if (!STATUSES.includes(status)) status = 'draft';

  const pinned = /^(true|1|yes)$/i.test((fields.pinned || '').trim());

  return {
    id: titleFromFile(file),
    file,
    title,
    tags,
    created,
    updated,
    status,
    pinned,
    body,
    excerpt: buildExcerpt(body),
    words: countWords(body),
  };
}

/** 序列化回 md 文本：--- front-matter --- + 空行 + body */
export function serializeNote(note: Note): string {
  const title = note.title.replace(/[\r\n]+/g, ' ').trim() || '未命名笔记';
  const tags = note.tags.map((t) => t.replace(/[\r\n,\]]+/g, ' ').trim()).filter(Boolean);
  const head = [
    '---',
    `title: ${title}`,
    `tags: [${tags.join(', ')}]`,
    `created: ${DATE_RE.test(note.created) ? note.created : todayDate()}`,
    `updated: ${DATETIME_RE.test(note.updated) ? note.updated : nowStamp()}`,
    `status: ${STATUSES.includes(note.status) ? note.status : 'draft'}`,
    `pinned: ${note.pinned ? 'true' : 'false'}`,
    '---',
  ].join('\n');
  const body = note.body.replace(/^\n+/, '');
  return `${head}\n\n${body}`;
}

/** 去掉 Markdown 记号后的前 80 字，用于列表摘要 */
export function buildExcerpt(body: string): string {
  let s = body;
  s = s.replace(/```[\s\S]*?```/g, ' '); // 代码块整段剔除
  s = s.replace(/`[^`\n]*`/g, ' '); // 行内代码
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1'); // 图片保留 alt
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // 链接保留文字
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1'); // 双链保留标题
  s = s.replace(/<\/?[A-Za-z][^>]*>/g, ' '); // HTML 标签
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, ''); // 标题井号
  s = s.replace(/^\s{0,3}>+\s?/gm, ''); // 引用符号
  s = s.replace(/^\s*\|?\s*:?-{2,}[-: |]*\|?\s*$/gm, ' '); // 表格分隔行
  s = s.replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, ''); // 列表与任务记号
  s = s.replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1'); // 加粗斜体删除线
  s = s.replace(/==([^=\n]+)==/g, '$1'); // 高亮记号
  s = s.replace(/\|/g, ' '); // 表格竖线
  s = s.replace(/^[ \t]+|[ \t]+$/gm, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 80).join('');
}

/** 字数统计：中日韩按单字计数，拉丁字母与数字按词计数 */
export function countWords(body: string): number {
  const cjkRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g;
  const latinRe = /[A-Za-z\u00C0-\u024F0-9]+(?:['\u2019\u2005-][A-Za-z\u00C0-\u024F0-9]+)*/g;
  const cjk = (body.match(cjkRe) || []).length;
  const latin = (body.replace(cjkRe, ' ').match(latinRe) || []).length;
  return cjk + latin;
}
