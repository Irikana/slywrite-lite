// 更新与版本页：检查本机版本与最新发布版本的差异。
//   Android：应用内下载安装包并唤起系统安装界面（8 起需「安装未知应用」授权，
//     app.json 已声明 REQUEST_INSTALL_PACKAGES，未授权时引导去系统设置或退回浏览器下载）；
//   桌面（PC 版）：无 APK 安装语义，按钮改为打开系统浏览器进入发布页手动下载。
// 具体安装动作全部下沉到 src/lib/installer(.web).ts，本页不直接引用任何平台模块。
// 全程只有匿名只读请求：读取最新发布信息、下载附件，不上传任何内容。
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { compareVersions, fetchLatestRelease, type ReleaseInfo } from '../src/lib/releases';
import { CAN_IN_APP_INSTALL, downloadAndInstall, openExternal } from '../src/lib/installer';
import BrandName from '../src/components/BrandName';
import PressFX from '../src/components/PressFX';
import { SPACING, useTheme, type Palette } from '../src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** 安装包附件名（与发布产物一致，仅 Android 分支使用） */
const APK_ASSET = 'app-release.apk';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return iso;
  }
}

export default function UpdatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [checking, setChecking] = useState(true);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // 0-100 为进度；101 表示已下载但拿不到总大小（不确定态）
  const [progress, setProgress] = useState(0);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setRelease(await fetchLatestRelease());
    } catch (e) {
      setError(e instanceof Error ? e.message : '检查更新失败');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  /** Android：应用内下载安装包，完成后唤起安装；桌面：打开系统浏览器进入发布页 */
  const handleUpdate = useCallback(async () => {
    if (!release) return;
    if (!CAN_IN_APP_INSTALL) {
      openExternal(release.htmlUrl).catch(() => {
        Alert.alert('无法打开发布页', '请手动访问发布页面下载桌面版更新包。');
      });
      return;
    }
    try {
      setDownloading(true);
      setProgress(0);
      await downloadAndInstall({
        htmlUrl: release.htmlUrl,
        assetUrl: release.assets.find((a) => a.name === APK_ASSET)?.browser_download_url,
        tag: release.tagName.replace(/^v/, '') || 'latest',
        onProgress: setProgress,
      });
    } catch {
      Alert.alert('自动安装未成功', '将打开浏览器下载，下载完成后请点开通知手动安装。');
      openExternal(release.htmlUrl).catch(() => {
        Alert.alert('无法下载', '请稍后再试，或换用网络环境更好的设备下载。');
      });
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }, [release]);

  const hasNewer = release ? compareVersions(release.tagName, APP_VERSION) > 0 : false;
  const progressText = progress === 101 ? '下载中…' : `下载中… ${progress}%`;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <View style={s.headRow}>
        <BrandName size="md" />
        <Text style={s.headVersion}>v{APP_VERSION}</Text>
      </View>

      <Text style={s.sectionTitle}>当前版本</Text>
      <View style={s.box}>
        <View style={s.row}>
          <Text style={s.rowLabel}>本机版本</Text>
          <Text style={s.rowValue}>v{APP_VERSION}</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>最新版本</Text>
      {checking ? (
        <View style={[s.box, s.centerBox]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.hint}>正在检查更新…</Text>
        </View>
      ) : error ? (
        <View style={[s.box, s.centerBox]}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={[s.outlineBtn, s.retryBtn]} onPress={check} disabled={checking}>
            <Text style={s.outlineBtnText}>重试</Text>
          </Pressable>
        </View>
      ) : release ? (
        <View style={s.box}>
          <View style={s.row}>
            <Text style={s.rowLabel}>可安装版本</Text>
            <Text style={[s.rowValue, hasNewer ? s.newerText : s.latestText]}>
              {release.tagName}
              {hasNewer ? '（有新版本）' : '（已是最新）'}
            </Text>
          </View>
          <Text style={s.rowLabelSmall}>发布时间</Text>
          <Text style={s.rowText}>{formatDate(release.publishedAt)}</Text>
          {!!release.body && (
            <>
              <Text style={s.rowLabelSmall}>更新内容</Text>
              <Text style={s.rowText} numberOfLines={12}>
                {release.body.slice(0, 500)}
              </Text>
            </>
          )}
          {CAN_IN_APP_INSTALL ? (
            <>
              <PressFX style={[s.primaryBtn, downloading && s.btnDisabled]} onPress={handleUpdate} disabled={downloading}>
                <Text style={s.primaryBtnText}>
                  {downloading ? progressText : `下载并安装（${release.tagName}）`}
                </Text>
              </PressFX>
              {downloading ? (
                <View style={s.progressWrap}>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, progress === 101 && s.progressIndeterminate]} />
                  </View>
                  <Text style={s.progressText}>{progress === 101 ? '…' : `${progress}%`}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <PressFX style={s.primaryBtn} onPress={handleUpdate}>
              <Text style={s.primaryBtnText}>前往发布页下载桌面版</Text>
            </PressFX>
          )}
        </View>
      ) : (
        <View style={[s.box, s.centerBox]}>
          <Text style={s.hint}>还没有可检查的发布版本。发布后此处会自动显示新版本号。</Text>
        </View>
      )}

      <Pressable style={s.outlineBtn} onPress={check} disabled={checking}>
        <Text style={s.outlineBtnText}>{checking ? '检查中…' : '重新检查'}</Text>
      </Pressable>

      <Text style={s.hint}>更新只读取公开的版本信息与应用安装包，不上传任何内容；笔记始终留在本机。</Text>

      <Pressable style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>返回</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    headVersion: { fontSize: 12, color: COLORS.textLight },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: SPACING.sm,
      marginTop: SPACING.sm,
    },
    box: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    centerBox: { alignItems: 'center', paddingVertical: SPACING.lg },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
    rowLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
    rowValue: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
    rowLabelSmall: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm },
    rowText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: 2 },
    newerText: { color: COLORS.accent },
    latestText: { color: COLORS.success },
    hint: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm, lineHeight: 17 },
    errorText: { fontSize: 13, color: COLORS.danger, lineHeight: 19, textAlign: 'center' },
    primaryBtn: {
      backgroundColor: COLORS.accent,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      marginTop: SPACING.md,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },
    outlineBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    retryBtn: { marginTop: SPACING.md, alignSelf: 'center', paddingHorizontal: SPACING.lg, marginBottom: 0 },
    outlineBtnText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
    backBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      backgroundColor: COLORS.bg,
    },
    backText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
    progressWrap: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.sm },
    progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.accent },
    progressIndeterminate: { width: '40%', opacity: 0.6 },
    progressText: { fontSize: 12, color: COLORS.textSecondary, minWidth: 36, textAlign: 'right' },
  });
