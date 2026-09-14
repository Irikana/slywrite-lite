// 应用更新包的安装 — Web / 桌面端实现（与 installer.ts 同名同签名，Metro 按 .web 后缀选择）。
// 桌面端没有「下载 APK 并唤起安装」的语义：更新页据 CAN_IN_APP_INSTALL=false
// 改为展示「打开发布页下载桌面版」，由用户自行替换程序文件。
// 本文件不 import 任何 Android 专属模块，确保 Web 产物不打包 expo-file-system / expo-intent-launcher。
import { Linking } from 'react-native';
import type { InstallRequest } from './installer';

export type { InstallRequest };

export const CAN_IN_APP_INSTALL = false;

/** 桌面端不可用；更新页只在 CAN_IN_APP_INSTALL 为真时调用它，此处兜底抛错 */
export async function downloadAndInstall(_req: InstallRequest): Promise<void> {
  throw new Error('桌面版请前往发布页下载更新包');
}

/** 打开外部链接：RN Web 的 Linking 使用 window.open，桌面壳会将其路由给系统浏览器 */
export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(url);
}
