// 笔记仓库：带 YAML front-matter 的真实 .md 文件读写。业务逻辑单一来源，平台差异全部下沉到 vault-fs：
//   原生端  vault-fs.ts     —— expo-file-system，应用私有目录
//   桌面端  vault-fs.web.ts —— Electron 壳，userData/vault/ 下真实文件
//   浏览器  vault-fs.web.ts —— 无壳时 localStorage 虚拟仓库（开发/降级）
// 目录结构（虚拟路径，相对仓库根）：
//   notes/    笔记正文（.md，带 YAML front-matter）
//   .trash/   回收站（删除的 .md 移入，不直接销毁）
//   backups/  整体导出的 JSON 备份
//   share/    导出/分享临时区（原生端映射系统缓存目录）
// 约定：本层只谈文件与解析，所有失败抛出带中文说明的 Error，由界面直接展示。
import {
  type Note,
  type NoteMeta,
  nowStamp,
  parseNote,
  serializeNote,
  todayDate,
} from './frontmatter';
import {
  copyText,
  ensureDir,
  listDir,
  movePath,
  readText,
  removePath,
  statPath,
  writeText,
  type VaultStat,
} from './vault-fs';

export const NOTES_DIR = 'notes/';
export const TRASH_DIR = '.trash/';
export const BACKUPS_DIR = 'backups/';
const SHARE_DIR = 'share/';

/** 备份文件格式版本（导入时校验） */
const BACKUP_APP_TAG = 'slywrite-lite';
const BACKUP_VERSION = 1;

function noteRel(file: string): string {
  return `${NOTES_DIR}${file.split('/').pop()}`;
}

function trashRel(name: string): string {
  return `${TRASH_DIR}${name.split('/').pop()}`;
}

function backupRel(name: string): string {
  return `${BACKUPS_DIR}${name.split('/').pop()}`;
}

function shareRel(name: string): string {
  return `${SHARE_DIR}${name.split('/').pop()}`;
}

function isMarkdown(name: string): boolean {
  return /\.md$/i.test(name);
}

/** 文件名净化：只保留最后一段，非法字符替换，强制 .md 结尾 */
function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() || '').trim();
  const cleared = base.replace(/[^\w.\- ]+/g, '-').replace(/\s+/g, '-');
  if (!cleared || cleared === '.' || cleared === '..') return '';
  return isMarkdown(cleared) ? cleared : `${cleared}.md`;
}

/** 统一包一层中文错误说明；原始信息附在后面便于排查 */
async function guard<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`${action}失败：${detail}`);
  }
}

/** 确保三个根目录存在（幂等，启动与写入前调用） */
export async function ensureRoot(): Promise<void> {
  await guard('创建笔记目录', async () => {
    for (const dir of [NOTES_DIR, TRASH_DIR, BACKUPS_DIR]) {
      await ensureDir(dir);
    }
  });
}

/** meta 瘦身：列表 state 不携带正文 */
function toMeta(note: Note): NoteMeta {
  const { body: _body, ...meta } = note;
  return meta;
}

/** updated 新者优先（'YYYY-MM-DD HH:mm' 字典序即时间序） */
function compareMeta(a: NoteMeta, b: NoteMeta): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updated.localeCompare(a.updated);
}

/** 列出全部笔记元数据：置顶优先，其余按更新时间倒序。单个文件读取失败时跳过该文件（不让一篇坏文件锁死整个列表）。 */
export async function listNotes(): Promise<NoteMeta[]> {
  await ensureRoot();
  const entries = await guard('读取笔记目录', () => listDir(NOTES_DIR));
  const metas: NoteMeta[] = [];
  for (const name of entries.filter(isMarkdown)) {
    try {
      const raw = await readText(noteRel(name));
      metas.push(toMeta(parseNote(raw, name)));
    } catch {
      // 单篇损坏不阻断列表；打开该篇时 readNote 会给出中文错误
    }
  }
  return metas.sort(compareMeta);
}

/** 读取单篇笔记全文 */
export async function readNote(file: string): Promise<Note> {
  await ensureRoot();
  const raw = await guard(`读取笔记「${file}」`, () => readText(noteRel(file)));
  return parseNote(raw, file);
}

/** 新建笔记的随机文件名（英文 kebab 风格）：note-<时间戳>-<随机段>.md */
function newFileName(): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `note-${Date.now()}-${rand}.md`;
}

export interface CreateSeed {
  title?: string;
  body?: string;
  tags?: string[];
  status?: Note['status'];
  pinned?: boolean;
}

/** 新建一篇笔记并立即落盘，返回完整 Note（含文件名） */
export async function createNote(seed?: CreateSeed): Promise<Note> {
  await ensureRoot();
  const file = newFileName();
  const now = nowStamp();
  const note: Note = {
    id: file.replace(/\.md$/i, ''),
    file,
    title: (seed?.title || '').trim() || '未命名笔记',
    tags: seed?.tags || [],
    created: todayDate(),
    updated: now,
    status: seed?.status || 'draft',
    pinned: seed?.pinned || false,
    body: seed?.body || '',
    excerpt: '',
    words: 0,
  };
  const full = parseNote(serializeNote(note), file);
  await guard('创建笔记', () => writeText(noteRel(file), serializeNote(full)));
  return full;
}

/** 保存笔记：刷新 updated / excerpt / words 后写盘，返回落盘后的 Note */
export async function saveNote(note: Note): Promise<Note> {
  await ensureRoot();
  const refreshed = parseNote(serializeNote({ ...note, updated: nowStamp() }), note.file);
  await guard(`保存笔记「${note.title || note.file}」`, () =>
    writeText(noteRel(note.file), serializeNote(refreshed)),
  );
  return refreshed;
}

/** 删除笔记：移入回收站；回收站内重名时给文件名加时间戳 */
export async function deleteNote(file: string): Promise<void> {
  await ensureRoot();
  const base = file.split('/').pop() || file;
  let target = base;
  const trashInfo = await guard('检查回收站', () => statPath(trashRel(target)));
  if (trashInfo.exists) {
    const stem = base.replace(/\.md$/i, '');
    target = `${stem}-${Date.now()}.md`;
  }
  await guard(`删除笔记「${base}」`, () => movePath(noteRel(base), trashRel(target)));
}

/**
 * VaultStat 是平台层统一后的文件信息（size 字节数 / mtimeMs 毫秒时间戳），
 * 不存在时两值均为 0。统一从 statPath 取值，避免各平台联合类型字段差异。
 */
function fileMtimeMs(stat: VaultStat): number {
  return stat.exists ? stat.mtimeMs : 0;
}

/** 同上，取字节数；不存在给 0 */
function fileSize(stat: VaultStat): number {
  return stat.exists ? stat.size : 0;
}

export interface TrashItem {
  name: string;
  /** 删除时间（毫秒时间戳，取自文件修改时间） */
  deletedAt: number;
}

/** 回收站列表：按删除时间倒序 */
export async function listTrash(): Promise<TrashItem[]> {
  await ensureRoot();
  const entries = await guard('读取回收站', () => listDir(TRASH_DIR));
  const items: TrashItem[] = [];
  for (const name of entries.filter(isMarkdown)) {
    const info = await guard(`读取「${name}」信息`, () => statPath(trashRel(name)));
    items.push({ name, deletedAt: fileMtimeMs(info) });
  }
  return items.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** 从回收站恢复；notes 目录已有同名文件时报错（不覆盖） */
export async function restoreTrash(name: string): Promise<void> {
  await ensureRoot();
  const exists = await guard('检查同名笔记', () => statPath(noteRel(name)));
  if (exists.exists) {
    throw new Error(`恢复「${name}」失败：笔记目录已存在同名文件，请先处理现有笔记`);
  }
  await guard(`恢复「${name}」`, () => movePath(trashRel(name), noteRel(name)));
}

/** 彻底删除回收站中的一个文件 */
export async function deleteForever(name: string): Promise<void> {
  await guard(`彻底删除「${name}」`, () => removePath(trashRel(name)));
}

/**
 * 丢弃一篇从未被编辑过的空笔记（进新建页又直接返回的情况）。
 * 直接删文件、不进回收站——回收站里存空壳只会干扰真正需要找回的内容。
 */
export async function discardBlankNote(file: string): Promise<void> {
  await guard(`删除空笔记「${file}」`, () => removePath(noteRel(file), true));
}

/** 清空回收站 */
export async function emptyTrash(): Promise<void> {
  await ensureRoot();
  const items = await listTrash();
  for (const item of items) {
    await guard(`彻底删除「${item.name}」`, () => removePath(trashRel(item.name)));
  }
}

export interface BackupFile {
  name: string;
  /** 仓库内不透明路径（供 importBackup / presentFile 回传，勿在界面外使用） */
  uri: string;
  /** 字节数 */
  size: number;
  /** 导出时间（毫秒时间戳） */
  exportedAt: number;
}

async function listJsonFiles(dir: string): Promise<BackupFile[]> {
  const entries = await guard('读取备份目录', () => listDir(dir));
  const files: BackupFile[] = [];
  for (const name of entries.filter((n) => n.endsWith('.json'))) {
    const info = await guard(`读取「${name}」信息`, () => statPath(`${dir}${name}`));
    files.push({
      name,
      uri: `${dir}${name}`,
      size: fileSize(info),
      exportedAt: fileMtimeMs(info),
    });
  }
  return files.sort((a, b) => b.exportedAt - a.exportedAt);
}

/** 备份文件清单（backups/ 下的 .json，按导出时间倒序） */
export function listBackups(): Promise<BackupFile[]> {
  return (async () => {
    await ensureRoot();
    return listJsonFiles(BACKUPS_DIR);
  })();
}

/**
 * 删除一个备份文件（仅允许 backups/ 下的 .json 文件名）。
 * 备份是导出到本机的一份副本，删掉不影响笔记本身。
 */
export async function deleteBackup(name: string): Promise<void> {
  if (!/^[\w.-]+\.json$/.test(name)) {
    throw new Error('备份文件名不合法，已拒绝删除');
  }
  await ensureRoot();
  await guard(`删除备份「${name}」`, () => removePath(backupRel(name), true));
}

/**
 * 整体导出：全部笔记序列化为一个 JSON 文件（{app, version, exportedAt, notes:[{file, raw}]}），
 * 写入 backups/ 并返回仓库路径（供 presentFile 分享 / 另存）。
 */
export async function exportBackup(): Promise<string> {
  await ensureRoot();
  const entries = await guard('读取笔记目录', () => listDir(NOTES_DIR));
  const notes: { file: string; raw: string }[] = [];
  for (const name of entries.filter(isMarkdown)) {
    const raw = await guard(`读取笔记「${name}」`, () => readText(noteRel(name)));
    notes.push({ file: name, raw });
  }
  const payload = {
    app: BACKUP_APP_TAG,
    version: BACKUP_VERSION,
    exportedAt: nowStamp(),
    notes,
  };
  const stamp = `${todayDate().replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  const name = `slywrite-lite-backup-${stamp}.json`;
  await guard('写入备份文件', () => writeText(backupRel(name), JSON.stringify(payload, null, 2)));
  return backupRel(name);
}

export interface ImportResult {
  added: number;
  skipped: number;
}

/**
 * 整体导入：读取备份 JSON（exportBackup 生成的仓库路径）。同名 file 已存在则跳过（绝不覆盖现有笔记）；
 * 导入的正文一律重新过 serializeNote 规范化。
 */
export async function importBackup(uri: string): Promise<ImportResult> {
  await ensureRoot();
  const raw = await guard('读取备份文件', () => readText(uri));
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('导入失败：备份文件不是合法的 JSON，可能已损坏');
  }
  const obj = data as { app?: unknown; notes?: unknown };
  if (obj?.app !== BACKUP_APP_TAG || !Array.isArray(obj.notes)) {
    throw new Error('导入失败：这不是 SlyWrite Lite 的备份文件');
  }
  const existing = new Set(
    (await guard('读取笔记目录', () => listDir(NOTES_DIR))).filter(isMarkdown),
  );
  let added = 0;
  let skipped = 0;
  for (const entry of obj.notes) {
    const item = entry as { file?: unknown; raw?: unknown };
    if (typeof item?.raw !== 'string') {
      skipped += 1;
      continue;
    }
    let file = typeof item.file === 'string' ? sanitizeFileName(item.file) : '';
    if (!file) {
      // 备份里没有合法文件名：给一个新名字导入，不丢弃内容
      file = newFileName();
    }
    if (existing.has(file)) {
      // 同名已存在：跳过，绝不覆盖
      skipped += 1;
      continue;
    }
    const note = parseNote(item.raw, file);
    await guard(`导入笔记「${file}」`, () => writeText(noteRel(file), serializeNote(note)));
    existing.add(file);
    added += 1;
  }
  return { added, skipped };
}

export interface StorageStats {
  count: number;
  words: number;
  bytes: number;
}

/** 存储统计：篇数 / 总字数 / 笔记目录占用字节 */
export async function storageStats(): Promise<StorageStats> {
  const metas = await listNotes();
  let bytes = 0;
  for (const meta of metas) {
    const info = await guard(`读取「${meta.file}」信息`, () => statPath(noteRel(meta.file)));
    bytes += fileSize(info);
  }
  return {
    count: metas.length,
    words: metas.reduce((sum, m) => sum + m.words, 0),
    bytes,
  };
}

/**
 * 把单篇笔记复制到分享临时区并返回仓库路径（供 presentFile「导出此篇」）。
 * 临时区不参与笔记管理，随时可被系统或用户清理。
 */
export async function prepareShareFile(file: string): Promise<string> {
  const note = await readNote(file);
  return guard('准备分享文件', () => copyText(noteRel(note.file), shareRel(note.file)).then(() => shareRel(note.file)));
}
