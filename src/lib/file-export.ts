// 把仓库中的文件交付用户 — 原生端实现：系统分享面板（expo-sharing）。
// 桌面 / 浏览器端见 file-export.web.ts（另存为对话框 / blob 下载），同名同签名。
// 参数 rel 为 notes-vault 返回的仓库路径（如 'share/x.md'、'backups/y.json'）。
import * as Sharing from 'expo-sharing';
import { toUri } from './vault-fs';

export type PresentResult = 'shared' | 'canceled' | 'unavailable';

export async function presentFile(rel: string, mimeType: string, dialogTitle: string): Promise<PresentResult> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return 'unavailable';
  await Sharing.shareAsync(toUri(rel), { mimeType, dialogTitle });
  // 系统分享面板不回报取消与否，统一按已交付处理
  return 'shared';
}
