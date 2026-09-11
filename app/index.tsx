// 笔记本首页：品牌行 + 搜索 + 标签过滤 + 排序 + 笔记卡片列表 + 新建入口 + 底部次级入口。
// 列表数据来自 notes-store（只存元数据），展示派生结果 filterNotes。
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SPACING, useTheme, type Palette } from '../src/theme';
import { STATUS_LABELS, type NoteMeta } from '../src/lib/frontmatter';
import { createNote } from '../src/lib/notes-vault';
import { filterNotes, useNotesStore } from '../src/store/notes-store';

const SORT_LABELS: Record<'updated' | 'created' | 'title', string> = {
  updated: '更新',
  created: '创建',
  title: '标题',
};

function statusColors(colors: Palette, status: keyof typeof STATUS_LABELS) {
  if (status === 'active') return { bg: colors.successBg, fg: colors.success, border: colors.success };
  if (status === 'archived') return { bg: colors.bgMuted, fg: colors.textLight, border: colors.border };
  return { bg: colors.infoBg, fg: colors.accent, border: colors.border };
}

export default function NotebookPage() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const notes = useNotesStore((st) => st.notes);
  const loading = useNotesStore((st) => st.loading);
  const ready = useNotesStore((st) => st.ready);
  const error = useNotesStore((st) => st.error);
  const query = useNotesStore((st) => st.query);
  const activeTag = useNotesStore((st) => st.activeTag);
  const sort = useNotesStore((st) => st.sort);
  const setQuery = useNotesStore((st) => st.setQuery);
  const setTag = useNotesStore((st) => st.setTag);
  const setSort = useNotesStore((st) => st.setSort);
  const refresh = useNotesStore((st) => st.refresh);
  const allTags = useNotesStore((st) => st.allTags);
  const upsertMeta = useNotesStore((st) => st.upsertMeta);

  const [creating, setCreating] = useState(false);

  const tags = useMemo(() => allTags(), [notes]);
  const visible = useMemo(() => filterNotes(notes, query, activeTag, sort), [notes, query, activeTag, sort]);
  const totalWords = useMemo(() => notes.reduce((sum, n) => sum + n.words, 0), [notes]);

  const handleNew = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await createNote();
      upsertMeta(note);
      router.push({ pathname: '/note', params: { file: note.file } });
    } catch (e) {
      useNotesStore.setState({ error: e instanceof Error ? e.message : '新建笔记失败' });
    } finally {
      setCreating(false);
    }
  }, [creating, upsertMeta]);

  const renderCard = ({ item }: { item: NoteMeta }) => {
    const sc = statusColors(colors, item.status);
    return (
      <Pressable
        style={s.card}
        onPress={() => router.push({ pathname: '/note', params: { file: item.file } })}
      >
        <View style={s.cardHead}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.pinned ? <Text style={s.pinMark}>置顶</Text> : null}
        </View>
        <Text style={s.cardMeta}>
          {item.updated}
          {'  ·  '}
          {item.words} 字
        </Text>
        {item.excerpt ? (
          <Text style={s.cardExcerpt} numberOfLines={2}>
            {item.excerpt}
          </Text>
        ) : (
          <Text style={s.cardExcerptEmpty}>（暂无内容）</Text>
        )}
        <View style={s.cardFoot}>
          <View style={s.cardTags}>
            {item.tags.slice(0, 4).map((t) => (
              <Text key={t} style={s.cardTag}>
                {t}
              </Text>
            ))}
          </View>
          <Text style={[s.statusBadge, { backgroundColor: sc.bg, color: sc.fg, borderColor: sc.border }]}>
            {STATUS_LABELS[item.status]}
          </Text>
        </View>
      </Pressable>
    );
  };

  const listEmpty = !ready ? null : loading ? null : (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{query || activeTag ? '没有符合条件的笔记' : '还没有笔记'}</Text>
      <Text style={s.emptyText}>
        {query || activeTag
          ? '换个关键词，或点「全部」清空标签过滤'
          : '笔记以 Markdown 文件保存在本机应用目录里，不依赖账号和网络；点右下角「新建笔记」开始写第一篇。'}
      </Text>
    </View>
  );

  return (
    <View style={s.page}>
      {/* 品牌行 */}
      <View style={s.brandRow}>
        <View style={s.brandLeft}>
          <Text style={s.brandName}>SlyWrite Lite</Text>
          <Text style={s.brandSub}>本地 Markdown 笔记本</Text>
        </View>
        <Text style={s.brandStats}>
          {notes.length} 篇 / {totalWords} 字
        </Text>
      </View>

      {/* 搜索 */}
      <TextInput
        style={s.search}
        value={query}
        onChangeText={setQuery}
        placeholder="搜索标题、摘要或标签"
        placeholderTextColor={colors.textLight}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {/* 标签行 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tagRow} contentContainerStyle={s.tagRowContent}>
        <Pressable style={[s.chip, !activeTag ? s.chipOn : null]} onPress={() => setTag(null)}>
          <Text style={[s.chipText, !activeTag ? s.chipTextOn : null]}>全部</Text>
        </Pressable>
        {tags.map(({ tag, count }) => (
          <Pressable
            key={tag}
            style={[s.chip, activeTag === tag ? s.chipOn : null]}
            onPress={() => setTag(activeTag === tag ? null : tag)}
          >
            <Text style={[s.chipText, activeTag === tag ? s.chipTextOn : null]}>
              {tag} {count}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 排序 */}
      <View style={s.sortRow}>
        <Text style={s.sortLabel}>排序</Text>
        {(Object.keys(SORT_LABELS) as (keyof typeof SORT_LABELS)[]).map((k) => (
          <Pressable key={k} style={[s.sortBtn, sort === k ? s.sortBtnOn : null]} onPress={() => setSort(k)}>
            <Text style={[s.sortBtnText, sort === k ? s.sortBtnTextOn : null]}>{SORT_LABELS[k]}</Text>
          </Pressable>
        ))}
        <Pressable style={s.sortBtn} onPress={() => refresh()}>
          <Text style={s.sortBtnText}>{loading ? '读取中' : '刷新'}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.file}
        renderItem={renderCard}
        ListEmptyComponent={listEmpty}
        refreshing={loading}
        onRefresh={() => refresh()}
        contentContainerStyle={s.listContent}
        ListFooterComponent={
          <View style={s.footer}>
            <Pressable style={s.footerBtn} onPress={() => router.push('/recycle')}>
              <Text style={s.footerBtnText}>回收站</Text>
            </Pressable>
            <Pressable style={s.footerBtn} onPress={() => router.push('/settings')}>
              <Text style={s.footerBtnText}>设置</Text>
            </Pressable>
          </View>
        }
      />

      {/* 新建按钮 */}
      <Pressable style={s.fab} onPress={handleNew} disabled={creating}>
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.fabText}>新建笔记</Text>
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bg },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    brandLeft: { flex: 1 },
    brandName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    brandSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    brandStats: { fontSize: 12, color: COLORS.textLight },
    search: {
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      color: COLORS.text,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 8,
      fontSize: 14,
    },
    tagRow: { flexGrow: 0 },
    tagRowContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
    chip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      paddingVertical: 4,
      paddingHorizontal: 10,
      marginRight: SPACING.xs,
    },
    chipOn: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    chipText: { fontSize: 12, color: COLORS.textSecondary },
    chipTextOn: { color: COLORS.accent, fontWeight: '600' },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    sortLabel: { fontSize: 12, color: COLORS.textLight, marginRight: SPACING.sm },
    sortBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 3,
      paddingHorizontal: 10,
      marginRight: SPACING.xs,
      backgroundColor: COLORS.bgSubtle,
    },
    sortBtnOn: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    sortBtnText: { fontSize: 12, color: COLORS.textSecondary },
    sortBtnTextOn: { color: COLORS.accent, fontWeight: '600' },
    errorBar: {
      backgroundColor: COLORS.dangerBg,
      borderBottomWidth: 1,
      borderColor: COLORS.danger,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    errorText: { fontSize: 12, color: COLORS.danger },
    listContent: { padding: SPACING.md, paddingBottom: 96, flexGrow: 1 },
    card: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },
    pinMark: {
      fontSize: 11,
      color: COLORS.warning,
      borderWidth: 1,
      borderColor: COLORS.warning,
      paddingHorizontal: 4,
      paddingVertical: 1,
      overflow: 'hidden',
    },
    cardMeta: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
    cardExcerpt: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6, lineHeight: 19 },
    cardExcerptEmpty: { fontSize: 13, color: COLORS.textLight, marginTop: 6, fontStyle: 'italic' },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.sm,
    },
    cardTags: { flexDirection: 'row', flexWrap: 'wrap', flex: 1, gap: SPACING.xs },
    cardTag: {
      fontSize: 11,
      color: COLORS.tagNewsText,
      backgroundColor: COLORS.tagNewsBg,
      borderWidth: 1,
      borderColor: COLORS.tagNewsBorder,
      paddingHorizontal: 6,
      paddingVertical: 1,
      overflow: 'hidden',
    },
    statusBadge: {
      fontSize: 11,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 1,
      overflow: 'hidden',
      marginLeft: SPACING.sm,
    },
    empty: { paddingTop: SPACING.xl * 2, paddingHorizontal: SPACING.lg, alignItems: 'center' },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm },
    emptyText: { fontSize: 13, color: COLORS.textLight, lineHeight: 20, textAlign: 'center' },
    footer: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
    footerBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 8,
      paddingHorizontal: SPACING.lg,
    },
    footerBtnText: { fontSize: 13, color: COLORS.textSecondary },
    fab: {
      position: 'absolute',
      right: SPACING.md,
      bottom: SPACING.lg,
      backgroundColor: COLORS.accent,
      paddingVertical: 12,
      paddingHorizontal: SPACING.lg,
    },
    fabText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  });
