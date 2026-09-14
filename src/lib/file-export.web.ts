// 把仓库中的文件交付用户 — Web / 桌面端实现（与 file-export.ts 同名同签名，Metro 按 .web 后缀选择）。
//   桌面壳：弹出系统「另存为」对话框，把 vault 内文件另存一份到用户选择的位置；
//   纯浏览器：blob + a[download] 下载。
// 与原生版一致：只读本地仓库文件交付给用户，不向任何远端写入。
import { readText, saveAsFile } from './vault-fs';

export type PresentResult = 'shared' | 'canceled' | 'unavailable';

function downloadBlob(fileName: string, mimeType: string, text: string): void {
  const blob = new Blob([text], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function presentFile(rel: string, mimeType: string, dialogTitle: string): Promise<PresentResult> {
  const text = await readText(rel);
  const name = rel.split('/').pop() || 'slywrite-lite-file';

  // 桌面壳：走系统另存为对话框
  const saved = await saveAsFile(name, text);
  if (saved) return 'shared';
  if (typeof window !== 'undefined' && window.desktopBridge?.saveAs) {
    // 对话框被用户取消
    return 'canceled';
  }

  // 纯浏览器：触发下载。dialogTitle 在对下载语义下没有落点，忽略。
  downloadBlob(name, mimeType, text);
  return 'shared';
}
