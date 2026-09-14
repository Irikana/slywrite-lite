// 应用更新包的安装 — 原生端实现（Android）：应用内下载 APK 并唤起系统安装界面。
// Web / 桌面端见 installer.web.ts（同名同签名，Metro 按 .web 后缀选择）：
//   桌面端没有 APK 安装语义，本层只暴露 CAN_IN_APP_INSTALL=false，由更新页改为「打开发布页下载」。
// 本模块是 expo-file-system / expo-intent-launcher 在界层的唯一入口，
// 目的是让 Web 产物完全不打包这两个 Android 专属模块。
import { Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { LATEST_APK_URL } from './releases';

/** 本应用包名，用于跳转「安装未知应用」授权设置页 */
const ANDROID_PACKAGE = 'com.irikana.slywritelite';

/** 安装包附件名（与发布产物一致） */
const APK_ASSET = 'app-release.apk';

export const CAN_IN_APP_INSTALL = true;

export interface InstallRequest {
  /** 发布页地址（失败兜底：交给浏览器） */
  htmlUrl: string;
  /** 指定版本的附件下载地址（可能为空，为空走 LATEST_APK_URL） */
  assetUrl?: string;
  /** 版本号（去掉 v 前缀），用于缓存文件名 */
  tag: string;
  /** 进度回调：0-100；101 表示已下载但拿不到总大小（不确定态） */
  onProgress: (percent: number) => void;
}

/** 唤起系统安装界面；未获授权时给出可操作的兜底入口 */
async function launchInstaller(contentUri: string): Promise<boolean> {
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
    return true;
  } catch {
    Alert.alert('需要安装权限', '系统尚未允许本应用安装应用。请开启「安装未知应用」权限后重试。', [
      { text: '取消', style: 'cancel' },
      {
        text: '去开启',
        onPress: () => {
          IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
            data: `package:${ANDROID_PACKAGE}`,
          }).catch(() => {
            Linking.openURL(LATEST_APK_URL).catch(() => {});
          });
        },
      },
      {
        text: '浏览器下载',
        onPress: () => {
          Linking.openURL(LATEST_APK_URL).catch(() => {});
        },
      },
    ]);
    return false;
  }
}

/**
 * 下载 APK 并唤起安装。失败时抛出中文 Error，由更新页决定兜底提示。
 * 同版本文件已在缓存中则跳过下载直接进安装。
 */
export async function downloadAndInstall(req: InstallRequest): Promise<void> {
  const officialUrl = req.assetUrl || LATEST_APK_URL;
  // 国内网络下走加速镜像，失败回退官方地址
  const mirrorUrl = officialUrl.startsWith('https://github.com/') ? `https://gh-proxy.com/${officialUrl}` : null;
  const fileUri = `${FileSystem.cacheDirectory}${APK_ASSET.replace('.apk', '')}-${req.tag}.apk`;

  const existing = await FileSystem.getInfoAsync(fileUri);
  if (existing.exists && existing.size > 1024 * 1024) {
    const launched = await launchInstaller(await FileSystem.getContentUriAsync(fileUri));
    if (!launched) throw new Error('安装界面未能唤起');
    return;
  }

  // 清掉其他版本留下的安装包
  const dirUri = FileSystem.cacheDirectory ?? '';
  try {
    const cached = await FileSystem.readDirectoryAsync(dirUri);
    for (const f of cached) {
      if (f.startsWith('app-release-') && f.endsWith('.apk') && f !== `app-release-${req.tag}.apk`) {
        await FileSystem.deleteAsync(`${dirUri}${f}`).catch(() => {});
      }
    }
  } catch {
    // 目录读取失败不影响下载
  }

  const downloadFrom = async (url: string) => {
    const task = FileSystem.createDownloadResumable(url, fileUri, {}, (p) => {
      const expected = p.totalBytesExpectedToWrite;
      const written = p.totalBytesWritten;
      if (expected > 0) req.onProgress(Math.round((written / expected) * 100));
      else if (written > 0) req.onProgress(101);
    });
    return task.downloadAsync();
  };

  let result: Awaited<ReturnType<typeof downloadFrom>>;
  if (mirrorUrl) {
    try {
      result = await downloadFrom(mirrorUrl);
    } catch {
      result = undefined;
    }
  }
  if (!result?.uri) result = await downloadFrom(officialUrl);
  if (!result?.uri) throw new Error('下载失败');

  const launched = await launchInstaller(await FileSystem.getContentUriAsync(result.uri));
  if (!launched) throw new Error('安装界面未能唤起');
}

/** 用系统默认方式打开外部链接（浏览器） */
export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(url);
}
