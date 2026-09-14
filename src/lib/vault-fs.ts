// 笔记仓库底层文件接口 — 原生端实现（Android / iOS，expo-file-system 旧版 API，SDK 52）。
// 桌面 / 浏览器端由同名 vault-fs.web.ts 提供实现（Metro 按 .web 后缀自动选择），
// 业务层 notes-vault.ts 只依赖本文件导出的函数签名，不直接触碰任何平台 API。
//
// 路径约定：一律使用相对仓库根的虚拟路径，正斜杠分隔，目录以 / 结尾。
//   'notes/a.md'、'.trash/b.md'、'backups/c.json'、'share/d.md'
// share/ 在原生端映射到系统缓存目录（随时可被清理），其余映射到文档目录下的应用私有区。
import * as FileSystem from 'expo-file-system';

export interface VaultStat {
  exists: boolean;
  /** 字节数；不存在为 0 */
  size: number;
  /** 最后修改时间（毫秒时间戳）；不存在为 0 */
  mtimeMs: number;
}

const DOCS_ROOT = `${FileSystem.documentDirectory}slywrite-lite/`;
const SHARE_ROOT = `${FileSystem.cacheDirectory}slywrite-lite-share/`;

/** 虚拟路径 → 原生 file uri（供系统分享面板等外部消费者使用） */
export function toUri(rel: string): string {
  if (rel.startsWith('share/')) {
    return `${SHARE_ROOT}${rel.slice('share/'.length)}`;
  }
  return `${DOCS_ROOT}${rel}`;
}

function parentOf(rel: string): string {
  const idx = rel.lastIndexOf('/');
  return idx < 0 ? '' : rel.slice(0, idx + 1);
}

async function ensureMappedDir(dir: string): Promise<void> {
  if (!dir) return;
  const uri = toUri(dir);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

export async function ensureDir(relDir: string): Promise<void> {
  await ensureMappedDir(relDir);
}

export async function listDir(relDir: string): Promise<string[]> {
  return FileSystem.readDirectoryAsync(toUri(relDir));
}

export async function readText(rel: string): Promise<string> {
  return FileSystem.readAsStringAsync(toUri(rel), { encoding: FileSystem.EncodingType.UTF8 });
}

export async function writeText(rel: string, text: string): Promise<void> {
  await ensureMappedDir(parentOf(rel));
  await FileSystem.writeAsStringAsync(toUri(rel), text, { encoding: FileSystem.EncodingType.UTF8 });
}

export async function movePath(fromRel: string, toRel: string): Promise<void> {
  await ensureMappedDir(parentOf(toRel));
  await FileSystem.moveAsync({ from: toUri(fromRel), to: toUri(toRel) });
}

export async function removePath(rel: string, idempotent = false): Promise<void> {
  await FileSystem.deleteAsync(toUri(rel), { idempotent });
}

export async function statPath(rel: string): Promise<VaultStat> {
  const info = await FileSystem.getInfoAsync(toUri(rel));
  if (!info.exists) {
    return { exists: false, size: 0, mtimeMs: 0 };
  }
  return { exists: true, size: info.size ?? 0, mtimeMs: (info.modificationTime ?? 0) * 1000 };
}

export async function copyText(fromRel: string, toRel: string): Promise<void> {
  await writeText(toRel, await readText(fromRel));
}

/**
 * 桌面壳「另存为」对话框（Web 实现专有；原生端由系统分享面板完成同等职责）。
 * 为保持 vault-fs 与 vault-fs.web 导出签名一致而声明；原生端调用即报错，实际不会发生
 * （file-export.ts 原生版不会走这里，Metro 也不会把本文件打进 Web 产物）。
 */
export async function saveAsFile(_fileName: string, _contents: string): Promise<boolean> {
  throw new Error('saveAsFile 仅在桌面/Web 实现中可用');
}
