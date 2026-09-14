// 笔记编辑/预览页。
// 参数：file（缺省时进入即新建一篇并落盘，保证后续自动保存始终有目标文件）。
// 职责：元数据编辑（标题/标签/状态/置顶）+ Markdown 编辑 + WebView 预览 + 双链跳转 + 反向链接 + 删除与分享。
// 自动保存：内容变更后防抖 600ms 落盘；离开页面（组件卸载）立即补写。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { presentFile } from '../src/lib/file-export';
import { SPACING, useTheme, type Palette } from '../src/theme';
import PressFX from '../src/components/PressFX';
import {
  STATUS_LABELS,
  type Note,
  type NoteMeta,
  type NoteStatus,
} from '../src/lib/frontmatter';
import {
  createNote,
  deleteNote,
  discardBlankNote,
  prepareShareFile,
  readNote,
  saveNote,
} from '../src/lib/notes-vault';
import { extractWikiLinks, findBacklinks, findNoteByTitle } from '../src/lib/links';
import { renderMarkdownToHtml } from '../src/lib/preview';
import { useNotesStore } from '../src/store/notes-store';
import { HtmlPreview } from '../src/components/HtmlPreview';
import { MarkdownEditor } from '../src/components/MarkdownEditor';

type Mode = 'edit' | 'preview';
type SaveState = 'saved' | 'saving' | 'dirty' | 'idle';

const STATUSES: NoteStatus[] = ['draft', 'active', 'archived'];

function hhmm(stamp: string): string {
  const m = stamp.match(/(\d{2}:\d{2})$/);
  return m ? m[1] : stamp;
}

export default function NotePage() {
  const params = useLocalSearchParams<{ file?: string; prefillTitle?: string; prefillBody?: string }>();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const upsertMeta = useNotesStore((st) => st.upsertMeta);
  const removeMeta = useNotesStore((st) => st.removeMeta);
  const allNotes = useNotesStore((st) => st.notes);

  const [note, setNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<Mode>('edit');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const [rendering, setRendering] = useState(false);
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [linkPicker, setLinkPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  // 自动保存：noteRef 持有最新内容，revRef 记录改动序号（保存期间有新改动则丢弃旧快照回写）
  const noteRef = useRef<Note | null>(null);
  const dirtyRef = useRef(false);
  const revRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});
  /** 本次会话新建、且用户一个字都没写：离开时直接丢弃，不给笔记本留空壳 */
  const blankNewRef = useRef(false);
  noteRef.current = note;

  /** 标记已修改并重置 600ms 防抖 */
  const markDirty = useCallback(() => {
    blankNewRef.current = false;
    dirtyRef.current = true;
    setSaveState('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, 600);
  }, []);

  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = noteRef.current;
    if (!current || !dirtyRef.current) return;
    dirtyRef.current = false;
    const rev = revRef.current;
    setSaveState('saving');
    setSaveError(null);
    try {
      const saved = await saveNote(current);
      // 保存期间用户又改了内容：不回写旧快照（避免吞掉新输入），重新排程下一次保存
      if (revRef.current !== rev) {
        markDirty();
        return;
      }
      noteRef.current = saved;
      setNote(saved);
      upsertMeta(saved);
      setSavedAt(saved.updated);
      setSaveState('saved');
    } catch (e) {
      dirtyRef.current = true;
      setSaveState('dirty');
      setSaveError(e instanceof Error ? e.message : '保存失败');
    }
  }, [upsertMeta, markDirty]);
  flushRef.current = () => {
    flushSave();
  };

  const patch = useCallback(
    (changes: Partial<Note>) => {
      revRef.current += 1;
      setNote((prev) => (prev ? { ...prev, ...changes } : prev));
      markDirty();
    },
    [markDirty],
  );

  // 进入页面：有 file 读盘，没有 file 新建（预填内容来自 prefillBody 参数）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (params.file) {
          const loaded = await readNote(params.file);
          if (cancelled) return;
          setNote(loaded);
          initialTitleRef.current = loaded.title;
          setSavedAt(loaded.updated);
          setSaveState('saved');
        } else {
          const created = await createNote({
            title: params.prefillTitle ? String(params.prefillTitle) : undefined,
            body: params.prefillBody ? String(params.prefillBody) : undefined,
          });
          if (cancelled) return;
          // 空白新建（无预填内容）才登记为「可丢弃」；带预填的双链创建不算空壳
          blankNewRef.current = !params.prefillTitle && !params.prefillBody;
          setNote(created);
          setSavedAt(created.updated);
          setSaveState('saved');
          upsertMeta(created);
          router.setParams({ file: created.file });
        }
      } catch (e) {
        if (!cancelled) setSaveError(e instanceof Error ? e.message : '打开笔记失败');
      }
    })();
    return () => {
      cancelled = true;
    };
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 离开页面：空白新建成即丢弃，其余立即落盘未保存的修改
  useEffect(
    () => () => {
      const current = noteRef.current;
      if (blankNewRef.current) {
        // 一个字都没写就返回：把这篇空壳直接删掉，不占笔记本也不进回收站
        if (current) {
          blankNewRef.current = false;
          useNotesStore.getState().removeMeta(current.file);
          discardBlankNote(current.file).catch(() => {
            // 卸载时的清理失败无关紧要：文件仍在磁盘上，下次进入列表会看到它
          });
        }
      } else if (dirtyRef.current && current) {
        saveNote(current).catch(() => {
          // 卸载时的补写失败无处展示，忽略（下次进入读到的是上次落盘内容）
        });
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // 预览：进入预览或正文变化时重新渲染 HTML
  useEffect(() => {
    if (mode !== 'preview' || !note) return;
    let cancelled = false;
    setRendering(true);
    (async () => {
      try {
        const doc = await renderMarkdownToHtml(note.body, allNotes, { isDark });
        if (!cancelled) setHtml(doc);
      } catch (e) {
        if (!cancelled) {
          setSaveError(e instanceof Error ? e.message : '预览渲染失败');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, note?.body, allNotes, isDark]);

  /** 双链跳转：已有同名笔记进那篇；没有则询问后新建并互相关联 */
  const openWikiLink = useCallback(
    (title: string) => {
      const hit = findNoteByTitle(title, allNotes);
      if (hit) {
        router.push({ pathname: '/note', params: { file: hit.file } });
        return;
      }
      const fromTitle = noteRef.current?.title || '未命名笔记';
      Alert.alert('创建这篇笔记？', `还没有标题为「${title}」的笔记。现在创建一篇，并在其中引用「${fromTitle}」。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '创建',
          onPress: async () => {
            try {
              const created = await createNote({
                title,
                body: `> 由 [[${fromTitle}]] 的双链创建\n\n`,
              });
              upsertMeta(created);
              router.push({ pathname: '/note', params: { file: created.file } });
            } catch (e) {
              Alert.alert('无法创建', e instanceof Error ? e.message : '新建笔记失败');
            }
          },
        },
      ]);
    },
    [allNotes, upsertMeta],
  );

  /**
   * WebView 导航拦截：
   * - slywrite-lite://note/<标题> → App 内双链跳转
   * - http(s) → 交系统浏览器打开并拦停站内导航（预览里点外链不该把笔记页换掉）
   * - 其余（含初始 about:blank 加载）放行
   */
  const handleSchemeRequest = useCallback(
    (url: string): boolean => {
      const prefix = 'slywrite-lite://note/';
      if (url.startsWith(prefix)) {
        const encoded = url.slice(prefix.length);
        let title = encoded;
        try {
          title = decodeURIComponent(encoded);
        } catch {
          // 非法百分号编码时按原文处理
        }
        if (title.trim()) openWikiLink(title.trim());
        return true;
      }
      if (/^https?:\/\//i.test(url)) {
        Linking.openURL(url).catch(() => {
          Alert.alert('无法打开链接', '系统没有找到可以打开该地址的应用。');
        });
        return true;
      }
      return false;
    },
    [openWikiLink],
  );

  /**
   * 改名保护用：记下进入页面时的标题（双链按标题寻址，改名会让别人的 [[旧标题]] 指空）
   */
  const initialTitleRef = useRef<string | null>(null);

  const addTag = useCallback(() => {
    const t = tagDraft.trim().replace(/[,\[\]]/g, '');
    setTagDraft('');
    setTagInputVisible(false);
    if (!t || !note) return;
    if (note.tags.includes(t)) return;
    patch({ tags: [...note.tags, t] });
  }, [note, patch, tagDraft]);

  const removeTag = useCallback(
    (tag: string) => {
      if (!note) return;
      patch({ tags: note.tags.filter((t) => t !== tag) });
    },
    [note, patch],
  );

  const handleDelete = useCallback(() => {
    if (!note) return;
    Alert.alert('删除这篇笔记？', `「${note.title}」将移入回收站，可在回收站恢复。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移入回收站',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(note.file);
            removeMeta(note.file);
            router.back();
          } catch (e) {
            Alert.alert('删除失败', e instanceof Error ? e.message : '未知原因');
          }
        },
      },
    ]);
  }, [note, removeMeta]);

  const handleShare = useCallback(async () => {
    if (!note) return;
    setBusy(true);
    try {
      const uri = await prepareShareFile(note.file);
      const status = await presentFile(uri, 'text/markdown', '导出此篇笔记');
      if (status === 'unavailable') {
        Alert.alert('无法分享', '本机没有可用的分享渠道。备份文件仍在应用目录 backups/ 与 notes/ 中。');
      }
      // status === 'canceled'：用户在另存对话框中取消，不打扰
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : '未知原因');
    } finally {
      setBusy(false);
    }
  }, [note]);

  const insertWikiLink = useCallback(
    (title: string) => {
      setLinkPicker(false);
      if (!note) return;
      patch({ body: `${note.body}${note.body.endsWith('\n') || note.body === '' ? '' : '\n\n'}[[${title}]]\n` });
      setMode('edit');
    },
    [note, patch],
  );

  // 反向链接：逐篇读取其它笔记正文，找以 [[本篇标题]] 引用本页的。
  // 仅在本篇标题变化或笔记篇数变化时重扫（保存本篇不触发全盘读取）。
  const notesCount = allNotes.length;
  const [backlinks, setBacklinks] = useState<NoteMeta[]>([]);
  useEffect(() => {
    if (!note) return;
    let cancelled = false;
    const title = note.title;
    (async () => {
      const sources: NoteMeta[] = [];
      for (const m of useNotesStore.getState().notes) {
        if (m.file === note.file) continue;
        try {
          sources.push(await readNote(m.file));
        } catch {
          sources.push(m); // 读不到正文的退回摘要粗判
        }
      }
      if (!cancelled) setBacklinks(findBacklinks(title, sources));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.file, note?.title, notesCount]);

  /**
   * 标题提交（输入框失焦）时的双链体检：
   * 此刻的 backlinks 仍按旧标题统计，正好用来判断「改名会不会断开别人的引用」。
   */
  const commitTitle = useCallback(() => {
    const current = noteRef.current;
    if (!current) return;
    const old = initialTitleRef.current;
    if (old && old !== current.title && backlinks.length > 0) {
      Alert.alert(
        '改名会断开已有双链',
        `有 ${backlinks.length} 篇笔记通过 [[${old}]] 引用本篇。双链按标题寻址，改名后这些引用会失效，` +
          `需要到那些笔记里把 [[${old}]] 手动改成 [[${current.title}]]。`,
      );
    }
    initialTitleRef.current = current.title;
  }, [backlinks]);

  const outgoingLinks = useMemo(() => (note ? extractWikiLinks(note.body) : []), [note?.body]);

  const saveText =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'dirty'
        ? '未保存'
        : savedAt
          ? `已保存 ${hhmm(savedAt)}`
          : '';

  if (!note) {
    return (
      <View style={s.center}>
        {saveError ? <Text style={s.errorText}>{saveError}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  return (
    <View style={s.page}>
      {/* 分段控件 */}
      <View style={s.segment}>
        <Pressable style={[s.segmentBtn, mode === 'edit' ? s.segmentOn : null]} onPress={() => setMode('edit')}>
          <Text style={[s.segmentText, mode === 'edit' ? s.segmentTextOn : null]}>编辑</Text>
        </Pressable>
        <Pressable
          style={[s.segmentBtn, mode === 'preview' ? s.segmentOn : null]}
          onPress={() => setMode('preview')}
        >
          <Text style={[s.segmentText, mode === 'preview' ? s.segmentTextOn : null]}>预览</Text>
        </Pressable>
        <Text style={s.saveText}>{saveText}</Text>
      </View>

      {/* 元数据区 */}
      <View style={s.metaArea}>
        <TextInput
          style={s.titleInput}
          value={note.title}
          onChangeText={(t) => patch({ title: t })}
          onBlur={commitTitle}
          placeholder="笔记标题"
          placeholderTextColor={colors.textLight}
        />

        <View style={s.tagLine}>
          {note.tags.map((t) => (
            <Pressable key={t} style={s.tagChip} onPress={() => removeTag(t)}>
              <Text style={s.tagChipText}>{t} ×</Text>
            </Pressable>
          ))}
          <Pressable style={s.tagAdd} onPress={() => setTagInputVisible(true)}>
            <Text style={s.tagAddText}>添加标签</Text>
          </Pressable>
        </View>
        {tagInputVisible ? (
          <View style={s.tagInputRow}>
            <TextInput
              style={s.tagInput}
              value={tagDraft}
              onChangeText={setTagDraft}
              placeholder="标签名，回车确认"
              placeholderTextColor={colors.textLight}
              onSubmitEditing={addTag}
              returnKeyType="done"
              autoCapitalize="none"
              autoFocus
            />
            <Pressable style={s.tagInputOk} onPress={addTag}>
              <Text style={s.tagInputOkText}>确定</Text>
            </Pressable>
            <Pressable style={s.tagInputOk} onPress={() => setTagInputVisible(false)}>
              <Text style={s.tagInputOkText}>取消</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.metaRow}>
          <View style={s.statusRow}>
            {STATUSES.map((st) => (
              <Pressable
                key={st}
                style={[s.chip, note.status === st ? s.chipOn : null]}
                onPress={() => patch({ status: st })}
              >
                <Text style={[s.chipText, note.status === st ? s.chipTextOn : null]}>{STATUS_LABELS[st]}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[s.chip, note.pinned ? s.chipOn : null]} onPress={() => patch({ pinned: !note.pinned })}>
            <Text style={[s.chipText, note.pinned ? s.chipTextOn : null]}>{note.pinned ? '已置顶' : '置顶'}</Text>
          </Pressable>
        </View>
        <Text style={s.metaInfo}>
          创建 {note.created} · 更新 {note.updated} · {note.words} 字 · {note.file}
        </Text>
        {saveError ? <Text style={s.errorText}>{saveError}</Text> : null}
      </View>

      {/* 编辑 / 预览 */}
      <View style={s.bodyArea}>
        {mode === 'edit' ? (
          <MarkdownEditor value={note.body} onChangeText={(t) => patch({ body: t })} />
        ) : (
          <View style={s.previewWrap}>
            {rendering ? (
              <View style={s.previewLoading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null}
            {html ? <HtmlPreview html={html} onSchemeRequest={handleSchemeRequest} /> : null}
          </View>
        )}
      </View>

      {/* 反向链接 */}
      <View style={s.backlinkBox}>
        <Text style={s.backlinkTitle}>反向链接</Text>
        {backlinks.length === 0 ? (
          <Text style={s.backlinkEmpty}>其它笔记中还没有以 [[{note.title}]] 引用本篇</Text>
        ) : (
          backlinks.map((b) => (
            <Pressable
              key={b.file}
              style={s.backlinkItem}
              onPress={() => router.push({ pathname: '/note', params: { file: b.file } })}
            >
              <Text style={s.backlinkText}>{b.title}</Text>
              <Text style={s.backlinkDate}>{b.updated}</Text>
            </Pressable>
          ))
        )}
        {outgoingLinks.length > 0 ? (
          <Text style={s.backlinkOut}>本篇引用：{outgoingLinks.join('、')}</Text>
        ) : null}
      </View>

      {/* 底部操作 */}
      <View style={s.bottomBar}>
        <PressFX style={s.bottomBtn} onPress={() => router.back()}>
          <Text style={s.bottomBtnText}>返回</Text>
        </PressFX>
        <PressFX style={[s.bottomBtn, s.bottomBtnDanger]} onPress={handleDelete}>
          <Text style={[s.bottomBtnText, s.bottomBtnTextDanger]}>删除</Text>
        </PressFX>
        <PressFX style={s.bottomBtn} onPress={() => setMenuVisible(true)}>
          <Text style={s.bottomBtnText}>菜单</Text>
        </PressFX>
      </View>

      {/* 菜单 */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>笔记操作</Text>
            <Pressable
              style={s.dialogItem}
              onPress={() => {
                setMenuVisible(false);
                handleShare();
              }}
            >
              <Text style={s.dialogItemText}>导出此篇笔记（.md 文件）</Text>
            </Pressable>
            <Pressable
              style={s.dialogItem}
              disabled={busy}
              onPress={() => {
                setMenuVisible(false);
                setLinkPicker(true);
              }}
            >
              <Text style={s.dialogItemText}>插入双链（选择其它笔记）</Text>
            </Pressable>
            <Pressable
              style={s.dialogItem}
              onPress={() => {
                setMenuVisible(false);
                flushSave();
              }}
            >
              <Text style={s.dialogItemText}>立即保存</Text>
            </Pressable>
            <Pressable style={[s.dialogItem, s.dialogItemClose]} onPress={() => setMenuVisible(false)}>
              <Text style={s.dialogItemText}>关闭</Text>
            </Pressable>
            {busy ? <ActivityIndicator color={colors.accent} style={s.dialogBusy} /> : null}
          </View>
        </View>
      </Modal>

      {/* 双链选择 */}
      <Modal visible={linkPicker} transparent animationType="slide" onRequestClose={() => setLinkPicker(false)}>
        <View style={s.overlay}>
          <View style={s.picker}>
            <Text style={s.dialogTitle}>选择要引用的笔记</Text>
            <ScrollView style={s.pickerScroll} keyboardShouldPersistTaps="handled">
              {allNotes.filter((m) => m.file !== note.file).length === 0 ? (
                <Text style={s.backlinkEmpty}>还没有其它笔记可引用</Text>
              ) : (
                allNotes
                  .filter((m) => m.file !== note.file)
                  .map((m) => (
                    <Pressable key={m.file} style={s.pickerItem} onPress={() => insertWikiLink(m.title)}>
                      <Text style={s.pickerItemText}>{m.title}</Text>
                    </Pressable>
                  ))
              )}
            </ScrollView>
            <Pressable style={[s.dialogItem, s.dialogItemClose]} onPress={() => setLinkPicker(false)}>
              <Text style={s.dialogItemText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    segmentBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      paddingVertical: 5,
      paddingHorizontal: SPACING.md,
      marginRight: SPACING.xs,
    },
    segmentOn: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    segmentText: { fontSize: 13, color: COLORS.textSecondary },
    segmentTextOn: { color: COLORS.accent, fontWeight: '600' },
    saveText: { marginLeft: 'auto', fontSize: 12, color: COLORS.textLight },
    metaArea: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    titleInput: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 8,
    },
    tagLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
    tagChip: {
      borderWidth: 1,
      borderColor: COLORS.tagNewsBorder,
      backgroundColor: COLORS.tagNewsBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    tagChipText: { fontSize: 12, color: COLORS.tagNewsText },
    tagAdd: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderStyle: 'dashed',
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    tagAddText: { fontSize: 12, color: COLORS.textLight },
    tagInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: SPACING.xs },
    tagInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.accent,
      backgroundColor: COLORS.bg,
      color: COLORS.text,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      fontSize: 13,
    },
    tagInputOk: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
    },
    tagInputOkText: { fontSize: 13, color: COLORS.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
    statusRow: { flexDirection: 'row', gap: SPACING.xs },
    chip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      paddingVertical: 3,
      paddingHorizontal: 10,
    },
    chipOn: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    chipText: { fontSize: 12, color: COLORS.textSecondary },
    chipTextOn: { color: COLORS.accent, fontWeight: '600' },
    metaInfo: { fontSize: 11, color: COLORS.textLight, marginTop: SPACING.sm },
    errorText: { fontSize: 12, color: COLORS.danger, marginTop: SPACING.xs },
    bodyArea: { flex: 1, minHeight: 240 },
    previewWrap: { flex: 1, backgroundColor: COLORS.bg },
    previewLoading: { position: 'absolute', top: SPACING.md, right: SPACING.md, zIndex: 5 },
    backlinkBox: {
      borderTopWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      maxHeight: 150,
    },
    backlinkTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    backlinkEmpty: { fontSize: 12, color: COLORS.textLight },
    backlinkItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    backlinkText: { fontSize: 13, color: COLORS.accent, flex: 1 },
    backlinkDate: { fontSize: 11, color: COLORS.textLight },
    backlinkOut: { fontSize: 11, color: COLORS.textLight, marginTop: SPACING.xs },
    bottomBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      padding: SPACING.sm,
      gap: SPACING.sm,
    },
    bottomBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 10,
      alignItems: 'center',
    },
    bottomBtnDanger: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
    bottomBtnText: { fontSize: 14, color: COLORS.textSecondary },
    bottomBtnTextDanger: { color: COLORS.danger },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: SPACING.lg },
    dialog: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
    dialogTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
    dialogItem: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: 10,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.xs,
    },
    dialogItemClose: { marginTop: SPACING.xs },
    dialogItemText: { fontSize: 14, color: COLORS.text },
    dialogBusy: { marginTop: SPACING.xs },
    picker: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      maxHeight: '70%',
    },
    pickerScroll: { flexGrow: 0 },
    pickerItem: {
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 10,
    },
    pickerItemText: { fontSize: 14, color: COLORS.accent },
  });
