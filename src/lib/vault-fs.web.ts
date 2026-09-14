// 笔记仓库底层文件接口 — Web / 桌面端实现（与 vault-fs.ts 同名同签名，Metro 按 .web 后缀选择）。
// 两条后端路径：
//   1. 桌面壳（Electron）：window.desktopBridge.fs 经 IPC 读写 userData/vault/ 下的真实
//      .md / .json 文件，保持「笔记是磁盘上的真实文件」语义；
//   2. 纯浏览器（开发调试 / 无壳降级）：localStorage 键值虚拟仓库，功能等价。
// 业务层 notes-vault.ts 对此零感知。本文件不引入任何原生模块与任何凭据。

export interface VaultStat {
  exists: boolean;
  size: number;
  mtimeMs: number;
}

/** 与 preload.js 暴露的桥面对齐（见 desktop/preload.js） */
interface VaultFsBridge {
  invoke(method: string, args: Record<string, unknown>): Promise<{ ok: boolean; value?: unknown; error?: string }>;
}

interface DesktopBridge {
  fs?: VaultFsBridge;
  saveAs?: (payload: { fileName: string; contents: string }) => Promise<boolean>;
  version?: string;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

function bridge(): DesktopBridge | null {
  return typeof window !== 'undefined' && window.desktopBridge ? window.desktopBridge : null;
}

/** 经桌面桥发起一次调用；主进程返回 {ok,value|error} 信封，error 已是中文说明 */
async function call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const b = bridge();
  if (!b?.fs) throw new Error('桌面存储桥不可用');
  const env = await b.fs.invoke(method, args);
  if (!env.ok) throw new Error(env.error || `${method} 调用失败`);
  return env.value as T;
}

/** 桌面壳：有桥走桥，无桥（纯浏览器）走 localStorage 虚拟仓库 */
const onDesktop = (): boolean => bridge()?.fs != null;

// ---------- localStorage 虚拟仓库（纯浏览器回退） ----------

interface LocalEntry {
  /** 文件内容；目录条目没有该字段 */
  text?: string;
  dir?: boolean;
  mtimeMs: number;
}

type LocalStore = Record<string, LocalEntry>;

const LS_KEY = 'slywri…t.v1';

function loadStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LocalStore) : {};
  } catch {
    return {};
  }
}

function saveStore(store: LocalStore): void {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function byteLength(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

/** 补齐某个目录及其各级父目录条目 */
function touchDir(store: LocalStore, relDir: string): void {
  const parts = relDir.split('/').filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    const dir = `${parts.slice(0, i).join('/')}/`;
    if (!store[dir]) store[dir] = { dir: true, mtimeMs: Date.now() };
  }
}

function localEnsureDir(relDir: string): Promise<void> {
  const store = loadStore();
  touchDir(store, relDir);
  saveStore(store);
  return Promise.resolve();
}

function localList(relDir: string): Promise<string[]> {
  const store = loadStore();
  if (!store[relDir]?.dir) throw new Error(`目录不存在：${relDir}`);
  const names = new Set<string>();
  for (const key of Object.keys(store)) {
    if (key === relDir || !key.startsWith(relDir)) continue;
    const rest = key.slice(relDir.length);
    const head = rest.split('/')[0];
    if (head) names.add(head);
  }
  return Promise.resolve([...names]);
}

function localRead(rel: string): Promise<string> {
  const entry = loadStore()[rel];
  if (!entry || entry.text === undefined) throw new Error(`文件不存在：${rel}`);
  return Promise.resolve(entry.text);
}

function localWrite(rel: string, text: string): Promise<void> {
  const store = loadStore();
  touchDir(store, rel.split('/').slice(0, -1).join('/') + '/');
  store[rel] = { text, mtimeMs: Date.now() };
  saveStore(store);
  return Promise.resolve();
}

function localRemove(rel: string, idempotent: boolean): Promise<void> {
  const store = loadStore();
  if (!store[rel]) {
    if (idempotent) return Promise.resolve();
    throw new Error(`文件不存在：${rel}`);
  }
  delete store[rel];
  saveStore(store);
  return Promise.resolve();
}

// ---------- 统一导出（与 vault-fs.ts 签名一致） ----------

export function toUri(rel: string): string {
  // Web 端没有可分享的原生 uri，此值仅作为不透明标识在应用内回传
  return rel;
}

export async function ensureDir(relDir: string): Promise<void> {
  if (onDesktop()) return call<void>('ensureDir', { path: relDir });
  return localEnsureDir(relDir);
}

export async function listDir(relDir: string): Promise<string[]> {
  if (onDesktop()) return call<string[]>('list', { path: relDir });
  return localList(relDir);
}

export async function readText(rel: string): Promise<string> {
  if (onDesktop()) return call<string>('readText', { path: rel });
  return localRead(rel);
}

export async function writeText(rel: string, text: string): Promise<void> {
  if (onDesktop()) return call<void>('writeText', { path: rel, text });
  return localWrite(rel, text);
}

export async function movePath(fromRel: string, toRel: string): Promise<void> {
  if (onDesktop()) return call<void>('move', { from: fromRel, to: toRel });
  const store = loadStore();
  const entry = store[fromRel];
  if (!entry || entry.dir) throw new Error(`文件不存在：${fromRel}`);
  store[toRel] = { ...entry, mtimeMs: Date.now() };
  delete store[fromRel];
  saveStore(store);
}

export async function removePath(rel: string, idempotent = false): Promise<void> {
  if (onDesktop()) return call<void>('remove', { path: rel, idempotent });
  return localRemove(rel, idempotent);
}

export async function statPath(rel: string): Promise<VaultStat> {
  if (onDesktop()) return call<VaultStat>('stat', { path: rel });
  const entry = loadStore()[rel];
  if (!entry) return { exists: false, size: 0, mtimeMs: 0 };
  return {
    exists: true,
    size: entry.dir ? 0 : byteLength(entry.text ?? ''),
    mtimeMs: entry.mtimeMs,
  };
}

export async function copyText(fromRel: string, toRel: string): Promise<void> {
  await writeText(toRel, await readText(fromRel));
}

/** 桌面壳「另存为」对话框；纯浏览器没有该能力（调用方走 blob 下载） */
export async function saveAsFile(fileName: string, contents: string): Promise<boolean> {
  const b = bridge();
  if (!b?.saveAs) return false;
  return b.saveAs({ fileName, contents });
}
