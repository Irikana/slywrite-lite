// 回收站：删除的笔记移入应用私有目录 .trash/，这里提供恢复 / 彻底删除 / 清空，全部二次确认。
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SPACING, useTheme, type Palette } from '../src/theme';
import { deleteForever, emptyTrash, listTrash, restoreTrash, type TrashItem } from '../src/lib/notes-vault';
import { useNotesStore } from '../src/store/notes-store';

function formatTime(ms: number): string {
  if (!ms) return '时间未知';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RecyclePage() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useNotesStore((st) => st.refresh);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listTrash());
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取回收站失败');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withConfirm = (title: string, message: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await action();
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : '操作失败');
          }
        },
      },
    ]);
  };

  const handleRestore = (item: TrashItem) =>
    withConfirm('恢复这篇笔记？', `「${item.name}」将放回笔记目录。`, async () => {
      await restoreTrash(item.name);
      await refresh();
    });

  const handleForever = (item: TrashItem) =>
    withConfirm('彻底删除？', `「${item.name}」将被永久移除，无法再恢复。`, async () => {
      await deleteForever(item.name);
    });

  const handleEmpty = () =>
    withConfirm('清空回收站？', `回收站内 ${items.length} 篇笔记将被永久移除，无法再恢复。`, async () => {
      await emptyTrash();
    });

  return (
    <View style={s.page}>
      <View style={s.headBar}>
        <Text style={s.headInfo}>{items.length ? `${items.length} 篇待清理` : '回收站是空的'}</Text>
        {items.length > 0 ? (
          <Pressable style={s.emptyBtn} onPress={handleEmpty}>
            <Text style={s.emptyBtnText}>清空回收站</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.name}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>删除的笔记会先移到这里，恢复后可回到笔记本。</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.rowInfo}>
              <Text style={s.rowName}>{item.name}</Text>
              <Text style={s.rowTime}>删除于 {formatTime(item.deletedAt)}</Text>
            </View>
            <Pressable style={s.rowBtn} onPress={() => handleRestore(item)}>
              <Text style={s.rowBtnText}>恢复</Text>
            </Pressable>
            <Pressable style={[s.rowBtn, s.rowBtnDanger]} onPress={() => handleForever(item)}>
              <Text style={[s.rowBtnText, s.rowBtnTextDanger]}>彻底删除</Text>
            </Pressable>
          </View>
        )}
      />
      <View style={s.bottomBar}>
        <Pressable style={s.bottomBtn} onPress={() => router.back()}>
          <Text style={s.bottomBtnText}>返回</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bg },
    headBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
    },
    headInfo: { fontSize: 13, color: COLORS.textSecondary },
    emptyBtn: {
      borderWidth: 1,
      borderColor: COLORS.danger,
      backgroundColor: COLORS.dangerBg,
      paddingVertical: 4,
      paddingHorizontal: SPACING.md,
    },
    emptyBtnText: { fontSize: 12, color: COLORS.danger },
    errorBar: {
      backgroundColor: COLORS.dangerBg,
      borderBottomWidth: 1,
      borderColor: COLORS.danger,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    errorText: { fontSize: 12, color: COLORS.danger },
    listContent: { padding: SPACING.md, flexGrow: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
    rowTime: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
    rowBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 6,
      paddingHorizontal: SPACING.sm,
    },
    rowBtnDanger: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
    rowBtnText: { fontSize: 12, color: COLORS.textSecondary },
    rowBtnTextDanger: { color: COLORS.danger },
    empty: { paddingTop: SPACING.xl * 2, alignItems: 'center', paddingHorizontal: SPACING.lg },
    emptyText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },
    bottomBar: {
      borderTopWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      padding: SPACING.sm,
    },
    bottomBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 10,
      alignItems: 'center',
    },
    bottomBtnText: { fontSize: 14, color: COLORS.textSecondary },
  });
