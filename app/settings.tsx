// 设置页：主题模式 / 数据管理（整体导出备份、从 backups 目录选择导入）/ 存储统计 / 危险区 / 关于。
// 导入不使用系统文件选择器（Lite 依赖里没有 expo-document-picker）：
// 备份一律先经「导出全部备份」落在应用私有目录 backups/，再从这里选择导入。
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { SPACING, useTheme, type Palette } from '../src/theme';
import {
  exportBackup,
  deleteBackup,
  deleteNote,
  importBackup,
  listBackups,
  storageStats,
  type BackupFile,
  type StorageStats,
} from '../src/lib/notes-vault';
import { useNotesStore } from '../src/store/notes-store';
import {
  THEME_MODES,
  THEME_MODE_LABELS,
  THEME_MODE_HINTS,
  useSettingsStore,
} from '../src/store/settings-store';

const CONFIRM_PHRASE = '清空全部笔记';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(ms: number): string {
  if (!ms) return '时间未知';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsPage() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const themeMode = useSettingsStore((st) => st.themeMode);
  const setThemeMode = useSettingsStore((st) => st.setThemeMode);
  const refreshNotes = useNotesStore((st) => st.refresh);

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wipeVisible, setWipeVisible] = useState(false);
  const [wipePhrase, setWipePhrase] = useState('');

  const reloadSide = useCallback(async () => {
    try {
      setBackups(await listBackups());
    } catch {
      setBackups([]);
    }
    try {
      setStats(await storageStats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    reloadSide();
  }, [reloadSide]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const uri = await exportBackup();
      await reloadSide();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '发送备份文件' });
        setMessage('备份已生成，可通过分享保存到其他设备。');
      } else {
        setMessage('备份已生成到应用目录 backups/（本机没有可用分享渠道）。');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }, [reloadSide]);

  const handleImport = useCallback(
    (backup: BackupFile) => {
      Alert.alert('导入这份备份？', `${backup.name}\n\n同名笔记会跳过，不会覆盖现有内容。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '导入',
          onPress: async () => {
            setBusy(true);
            setMessage(null);
            try {
              const result = await importBackup(backup.uri);
              await refreshNotes();
              await reloadSide();
              setMessage(`导入完成：新增 ${result.added} 篇，跳过 ${result.skipped} 篇。`);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : '导入失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [refreshNotes, reloadSide],
  );

  /**
   * 删除一份备份文件。备份只是导到本机 backups/ 的一份副本，删掉不碰笔记本身，
   * 因此只需一次确认，不必像「清空全部笔记」那样输入文字。
   */
  const handleDeleteBackup = useCallback(
    (backup: BackupFile) => {
      Alert.alert('删除这份备份？', `${backup.name}\n\n只删除这一份备份文件，笔记本身不受影响。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setMessage(null);
            try {
              await deleteBackup(backup.name);
              await reloadSide();
              setMessage(`已删除备份：${backup.name}`);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : '删除备份失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [reloadSide],
  );

  const handleWipe = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    setWipeVisible(false);
    setWipePhrase('');
    try {
      const targets = useNotesStore.getState().notes.map((m) => m.file);
      for (const file of targets) {
        await deleteNote(file);
      }
      await refreshNotes();
      await reloadSide();
      setMessage(`已清空：${targets.length} 篇笔记移入回收站，确认无误后可在回收站彻底删除。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '清空失败');
    } finally {
      setBusy(false);
    }
  }, [refreshNotes, reloadSide]);

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      {/* 主题 */}
      <Text style={s.sectionTitle}>主题模式</Text>
      {THEME_MODES.map((m) => (
        <Pressable key={m} style={[s.modeRow, themeMode === m ? s.modeRowOn : null]} onPress={() => setThemeMode(m)}>
          <View style={s.modeLeft}>
            <Text style={[s.modeName, themeMode === m ? s.modeNameOn : null]}>{THEME_MODE_LABELS[m]}</Text>
            <Text style={s.modeHint}>{THEME_MODE_HINTS[m]}</Text>
          </View>
          {themeMode === m ? <Text style={s.modeCheck}>使用中</Text> : null}
        </Pressable>
      ))}

      {/* 数据管理 */}
      <Text style={s.sectionTitle}>数据管理</Text>
      <Text style={s.paragraph}>
        笔记只保存在本机应用目录。跨设备迁移的唯一通道是整体备份：先「导出全部备份」生成一个 JSON 文件
        （保存在应用目录 backups/，可通过系统分享发走），换机后把该文件放回 backups/ 再选择导入。
        导入时同名笔记跳过，不覆盖。
      </Text>
      <Pressable style={s.actionBtn} onPress={handleExport} disabled={busy}>
        <Text style={s.actionBtnText}>{busy ? '处理中…' : '导出全部备份'}</Text>
      </Pressable>
      <Text style={s.subTitle}>可导入的备份（应用目录 backups/）</Text>
      {backups.length === 0 ? (
        <Text style={s.paragraphMuted}>还没有备份文件。点上方「导出全部备份」生成第一份。</Text>
      ) : (
        backups.map((b) => (
          <View key={b.name} style={s.backupRow}>
            <View style={s.backupLeft}>
              <Text style={s.backupName}>{b.name}</Text>
              <Text style={s.backupMeta}>
                {formatTime(b.exportedAt)} · {formatBytes(b.size)}
              </Text>
            </View>
            <Pressable style={s.backupActionBtn} onPress={() => handleImport(b)} disabled={busy}>
              <Text style={s.backupAction}>导入</Text>
            </Pressable>
            <Pressable style={s.backupActionBtn} onPress={() => handleDeleteBackup(b)} disabled={busy}>
              <Text style={s.backupActionDanger}>删除</Text>
            </Pressable>
          </View>
        ))
      )}
      {message ? (
        <View style={s.messageBar}>
          <Text style={s.messageText}>{message}</Text>
        </View>
      ) : null}

      {/* 存储统计 */}
      <Text style={s.sectionTitle}>存储统计</Text>
      <View style={s.statsRow}>
        <Text style={s.statsItem}>{stats ? `${stats.count} 篇` : '统计中…'}</Text>
        <Text style={s.statsItem}>{stats ? `${stats.words} 字` : ''}</Text>
        <Text style={s.statsItem}>{stats ? formatBytes(stats.bytes) : ''}</Text>
      </View>

      {/* 危险区 */}
      <Text style={[s.sectionTitle, s.sectionDanger]}>危险区</Text>
      <Text style={s.paragraph}>清空全部笔记：把当前所有笔记移入回收站（仍可恢复），不是直接销毁。</Text>
      <Pressable
        style={[s.actionBtn, s.actionDanger]}
        disabled={busy}
        onPress={() => {
          setWipePhrase('');
          setWipeVisible(true);
        }}
      >
        <Text style={[s.actionBtnText, s.actionDangerText]}>清空全部笔记</Text>
      </Pressable>

      {/* 关于 */}
      <Text style={s.sectionTitle}>关于</Text>
      <Text style={s.paragraph}>SlyWrite Lite v{Constants.expoConfig?.version || '未知'}</Text>
      <Text style={s.paragraph}>
        Lite 负责本地记笔记：无账号、无 Token、不向任何远端写入；预览排版可选地从公开站点拉取 CSS，
        失败自动回退内置样式。出版与站点发布由 SlyWrite（牧羊人图书馆管理端）负责，
        两个应用不共享账号与 Token。
      </Text>

      <Modal visible={wipeVisible} transparent animationType="fade" onRequestClose={() => setWipeVisible(false)}>
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>确认清空全部笔记？</Text>
            <Text style={s.dialogText}>
              此操作会把全部笔记移入回收站。请输入「{CONFIRM_PHRASE}」以确认。
            </Text>
            <TextInput
              style={s.dialogInput}
              value={wipePhrase}
              onChangeText={setWipePhrase}
              placeholder={CONFIRM_PHRASE}
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
            />
            <Pressable
              style={[s.dialogBtn, s.dialogBtnDanger, wipePhrase !== CONFIRM_PHRASE ? s.dialogBtnDisabled : null]}
              disabled={wipePhrase !== CONFIRM_PHRASE}
              onPress={handleWipe}
            >
              <Text style={s.dialogBtnDangerText}>执行清空</Text>
            </Pressable>
            <Pressable style={s.dialogBtn} onPress={() => setWipeVisible(false)}>
              <Text style={s.dialogBtnText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bg },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textSecondary,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    sectionDanger: { color: COLORS.danger },
    paragraph: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
    paragraphMuted: { fontSize: 12, color: COLORS.textLight, marginBottom: SPACING.sm, lineHeight: 18 },
    subTitle: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm, marginBottom: SPACING.xs },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      padding: SPACING.md,
      marginBottom: SPACING.xs,
    },
    modeRowOn: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    modeLeft: { flex: 1 },
    modeName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
    modeNameOn: { color: COLORS.accent, fontWeight: '700' },
    modeHint: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
    modeCheck: { fontSize: 11, color: COLORS.accent },
    actionBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      backgroundColor: COLORS.infoBg,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    actionBtnText: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },
    actionDanger: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
    actionDangerText: { color: COLORS.danger },
    backupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      padding: SPACING.md,
      marginBottom: SPACING.xs,
    },
    backupLeft: { flex: 1 },
    backupName: { fontSize: 13, color: COLORS.text },
    backupMeta: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
    backupAction: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  backupActionBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    marginLeft: SPACING.xs,
    backgroundColor: COLORS.bgSubtle,
  },
  backupActionDanger: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
    messageBar: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgMuted,
      padding: SPACING.sm,
      marginTop: SPACING.sm,
    },
    messageText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
    statsRow: { flexDirection: 'row', gap: SPACING.md },
    statsItem: {
      fontSize: 14,
      color: COLORS.text,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 8,
      paddingHorizontal: SPACING.md,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    dialog: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
    dialogTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
    dialogText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
    dialogInput: {
      borderWidth: 1,
      borderColor: COLORS.danger,
      backgroundColor: COLORS.bgSubtle,
      color: COLORS.text,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 8,
      fontSize: 14,
      marginBottom: SPACING.sm,
    },
    dialogBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    dialogBtnText: { fontSize: 14, color: COLORS.textSecondary },
    dialogBtnDanger: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
    dialogBtnDangerText: { fontSize: 14, color: COLORS.danger, fontWeight: '600' },
    dialogBtnDisabled: { opacity: 0.4 },
  });
