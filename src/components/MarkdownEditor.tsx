// Markdown 笔记编辑器（受控模式 + 插入工具栏 + 模板选择 + 数学符号面板）
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FONT, SPACING, useTheme, type Palette } from '../theme';
import { ReadOnlyText } from './ReadOnlyText';
import { useTemplatesStore } from '../store/templates-store';

interface InsertAction {
  label: string;
  display?: string;
  insert: (before: string, selStart: number, selEnd: number) => { text: string; cursor: number };
}

/** 片段插入：§ 为光标落点，无 § 时光标在片段末尾 */
function snippetAction(label: string, snippet: string, display?: string): InsertAction {
  return {
    label,
    display: display || label,
    insert: (b, s, e) => {
      const caret = snippet.indexOf('§');
      const clean = snippet.replace('§', '');
      const text = b.slice(0, s) + clean + b.slice(e);
      return { text, cursor: caret >= 0 ? s + caret : s + clean.length };
    },
  };
}

/** 笔记向工具栏预设 */
const NOTE_ACTIONS: InsertAction[] = [
  { label: 'H1', display: 'H1', insert: (b, s) => ({ text: b.slice(0, s) + '# ' + b.slice(s), cursor: s + 2 }) },
  { label: 'H2', display: 'H2', insert: (b, s) => ({ text: b.slice(0, s) + '## ' + b.slice(s), cursor: s + 3 }) },
  { label: 'H3', display: 'H3', insert: (b, s) => ({ text: b.slice(0, s) + '### ' + b.slice(s), cursor: s + 4 }) },
  {
    label: '加粗',
    display: 'B',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '加粗';
      return { text: b.slice(0, s) + `**${sel}**` + b.slice(e), cursor: s + 2 + sel.length };
    },
  },
  {
    label: '斜体',
    display: 'I',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '斜体';
      return { text: b.slice(0, s) + `*${sel}*` + b.slice(e), cursor: s + 1 + sel.length };
    },
  },
  {
    label: '高亮',
    display: '===',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '标记';
      return { text: b.slice(0, s) + `==${sel}==` + b.slice(e), cursor: s + 2 + sel.length };
    },
  },
  {
    label: '删除线',
    display: 'S',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '删除';
      return { text: b.slice(0, s) + `~~${sel}~~` + b.slice(e), cursor: s + 2 + sel.length };
    },
  },
  {
    label: '行内代码',
    display: '</>',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || 'code';
      return { text: b.slice(0, s) + '`' + sel + '`' + b.slice(e), cursor: s + 1 + sel.length };
    },
  },
  { label: '代码块', display: '{ }', insert: (b, s) => snippetAction('代码块', '```js\n§\n```', '{ }').insert(b, s, s) },
  { label: '引用', display: '”', insert: (b, s) => ({ text: b.slice(0, s) + '> ' + b.slice(s), cursor: s + 2 }) },
  { label: '列表', display: '• -', insert: (b, s) => ({ text: b.slice(0, s) + '- ' + b.slice(s), cursor: s + 2 }) },
  { label: '有序', display: '1.', insert: (b, s) => ({ text: b.slice(0, s) + '1. ' + b.slice(s), cursor: s + 3 }) },
  { label: '待办', display: '☐ 待办', insert: (b, s) => ({ text: b.slice(0, s) + '- [ ] ' + b.slice(s), cursor: s + 6 }) },
  { label: '已完成', display: '☑ 完成', insert: (b, s) => ({ text: b.slice(0, s) + '- [x] ' + b.slice(s), cursor: s + 6 }) },
  {
    label: '表格',
    display: '⊞',
    insert: (b, s) =>
      snippetAction('表格', '| 表头1 | 表头2 |\n| --- | --- |\n| §内容 | 内容 |', '⊞').insert(b, s, s),
  },
  { label: '链接', display: '☍', insert: (b, s) => ({ text: b.slice(0, s) + '[文字](https://)' + b.slice(s), cursor: s + 9 }) },
  { label: '双链', display: '[[ 链 ]]', insert: (b, s) => ({ text: b.slice(0, s) + '[[另一篇笔记标题]]' + b.slice(s), cursor: s + 2 }) },
  { label: '图片', display: '◩', insert: (b, s) => ({ text: b.slice(0, s) + '![图片描述](https://)' + b.slice(s), cursor: s + 20 }) },
  { label: '分割线', display: '—', insert: (b, s) => ({ text: b.slice(0, s) + '\n---\n' + b.slice(s), cursor: s + 5 }) },
  { label: '备注块', display: '> 备注', insert: (b, s) => snippetAction('备注块', '> **备注**\n> §', '> 备注').insert(b, s, s) },
  {
    label: '日期',
    display: '◷ 日期',
    insert: (b, s) => {
      const d = new Date();
      const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { text: b.slice(0, s) + t + b.slice(s), cursor: s + t.length };
    },
  },
  {
    label: '行内公式',
    display: '$x$',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '公式';
      return { text: b.slice(0, s) + `$${sel}$` + b.slice(e), cursor: s + 1 + sel.length };
    },
  },
  {
    label: '独立公式',
    display: '$$',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '公式';
      return { text: b.slice(0, s) + `$$\n${sel}\n$$` + b.slice(e), cursor: s + 3 + sel.length };
    },
  },
];

/** 数学符号面板分组（LaTeX 片段，§ 为光标落点） */
const SYMBOL_GROUPS: { title: string; items: { label: string; insert: string }[] }[] = [
  {
    title: '希腊字母',
    items: [
      { label: 'α \\alpha', insert: '\\alpha ' },
      { label: 'β \\beta', insert: '\\beta ' },
      { label: 'γ \\gamma', insert: '\\gamma ' },
      { label: 'δ \\delta', insert: '\\delta ' },
      { label: 'ε \\epsilon', insert: '\\epsilon ' },
      { label: 'θ \\theta', insert: '\\theta ' },
      { label: 'λ \\lambda', insert: '\\lambda ' },
      { label: 'μ \\mu', insert: '\\mu ' },
      { label: 'π \\pi', insert: '\\pi ' },
      { label: 'ρ \\rho', insert: '\\rho ' },
      { label: 'σ \\sigma', insert: '\\sigma ' },
      { label: 'φ \\phi', insert: '\\phi ' },
      { label: 'ω \\omega', insert: '\\omega ' },
      { label: 'Δ \\Delta', insert: '\\Delta ' },
      { label: 'Σ \\Sigma', insert: '\\Sigma ' },
      { label: 'Ω \\Omega', insert: '\\Omega ' },
    ],
  },
  {
    title: '运算符',
    items: [
      { label: '± \\pm', insert: '\\pm ' },
      { label: '× \\times', insert: '\\times ' },
      { label: '÷ \\div', insert: '\\div ' },
      { label: '≤ \\leq', insert: '\\leq ' },
      { label: '≥ \\geq', insert: '\\geq ' },
      { label: '≠ \\neq', insert: '\\neq ' },
      { label: '≈ \\approx', insert: '\\approx ' },
      { label: '∞ \\infty', insert: '\\infty ' },
      { label: '∑ \\sum', insert: '\\sum_{§i=1}^{n} ' },
      { label: '∏ \\prod', insert: '\\prod_{§i=1}^{n} ' },
      { label: '∫ \\int', insert: '\\int_{§a}^{b} ' },
      { label: '∂ \\partial', insert: '\\partial ' },
      { label: '∇ \\nabla', insert: '\\nabla ' },
      { label: '→ \\rightarrow', insert: '\\rightarrow ' },
      { label: '∈ \\in', insert: '\\in ' },
      { label: '⊂ \\subset', insert: '\\subset ' },
      { label: '∪ \\cup', insert: '\\cup ' },
      { label: '∩ \\cap', insert: '\\cap ' },
      { label: '∀ \\forall', insert: '\\forall ' },
      { label: '∃ \\exists', insert: '\\exists ' },
    ],
  },
  {
    title: '结构',
    items: [
      { label: '分数 \\dfrac', insert: '\\dfrac{§a}{b}' },
      { label: '根号 \\sqrt', insert: '\\sqrt{§x}' },
      { label: '上标 x²', insert: 'x^{§2}' },
      { label: '下标 xₙ', insert: 'x_{§n}' },
      { label: '向量 \\vec', insert: '\\vec{§v}' },
      { label: '均值 \\overline', insert: '\\overline{§x}' },
      { label: '估计 \\hat', insert: '\\hat{§x}' },
      { label: '括号 ( )', insert: '\\left( § \\right)' },
      { label: '集合 { }', insert: '\\left\\{ § \\right\\}' },
      { label: '绝对值 | |', insert: '\\left| § \\right|' },
    ],
  },
];

export interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChangeText,
  editable = true,
  placeholder = '在此撰写笔记（Markdown）…\n空行分段，点击上方工具栏插入格式或点击「≡ 模板」插入常用版式',
}: MarkdownEditorProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const s = createStyles(colors);
  const inputRef = React.useRef<TextInput>(null);
  const selectionRef = React.useRef({ start: 0, end: 0 });
  const [symbolsVisible, setSymbolsVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);

  const templates = useTemplatesStore((st) => st.templates);

  const text = value;

  const applyInsert = (next: string, cursor: number) => {
    onChangeText(next);
    selectionRef.current = { start: cursor, end: cursor };
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input) {
        input.setNativeProps({ selection: { start: cursor, end: cursor } });
      }
    });
  };

  const handleInsert = (action: InsertAction) => {
    const { start, end } = selectionRef.current;
    const { text: result, cursor } = action.insert(text, start, end);
    applyInsert(result, cursor);
  };

  const insertSnippet = (snippet: string) => {
    const { start, end } = selectionRef.current;
    const caret = snippet.indexOf('§');
    const clean = snippet.replace('§', '');
    const next = text.slice(0, start) + clean + text.slice(end);
    applyInsert(next, start + (caret >= 0 ? caret : clean.length));
  };

  return (
    <View style={s.container}>
      {!editable ? (
        <ReadOnlyText
          text={text}
          mono
          hint="已锁定：可上下滑动浏览，不能编辑；如需修改请先解锁"
        />
      ) : (
        <>
          <View style={s.toolbar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                style={[s.toolBtn, s.toolBtnTemplates]}
                onPress={() => setTemplatesVisible(true)}
              >
                <Text style={[s.toolText, s.toolTextAccent]}>≡ 模板</Text>
              </Pressable>

              {NOTE_ACTIONS.map((a) => (
                <Pressable
                  key={a.label}
                  style={s.toolBtn}
                  onPress={() => handleInsert(a)}
                  accessibilityLabel={a.label}
                >
                  {a.display === 'B' ? (
                    <Text style={[s.toolText, { fontWeight: '800' }]}>B</Text>
                  ) : a.display === 'I' ? (
                    <Text style={[s.toolText, { fontStyle: 'italic', fontWeight: '700' }]}>I</Text>
                  ) : a.display === 'S' ? (
                    <Text style={[s.toolText, { textDecorationLine: 'line-through' }]}>S</Text>
                  ) : (
                    <Text style={s.toolText}>{a.display || a.label}</Text>
                  )}
                </Pressable>
              ))}

              <Pressable style={[s.toolBtn, s.toolBtnSymbols]} onPress={() => setSymbolsVisible(true)}>
                <Text style={s.toolText}>∑ 符号</Text>
              </Pressable>
            </ScrollView>
          </View>

          <TextInput
            ref={inputRef}
            style={s.editor}
            value={text}
            onChangeText={onChangeText}
            onSelectionChange={(e) => {
              selectionRef.current = {
                start: e.nativeEvent.selection.start,
                end: e.nativeEvent.selection.end,
              };
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textLight}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            showSoftInputOnFocus
          />
          <Text style={s.counter}>{text.length} 字</Text>
        </>
      )}

      {/* 模板选择菜单弹窗 */}
      <Modal
        visible={templatesVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTemplatesVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalPanel}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>插入模板</Text>
              <Pressable
                style={s.manageLink}
                onPress={() => {
                  setTemplatesVisible(false);
                  router.push('/templates');
                }}
              >
                <Text style={s.manageLinkText}>管理模板 ↗</Text>
              </Pressable>
            </View>
            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
              {templates.length === 0 ? (
                <View style={s.emptyTemplates}>
                  <Text style={s.emptyTemplatesText}>暂无模板，可点右上角「管理模板」添加</Text>
                </View>
              ) : (
                templates.map((tpl) => (
                  <Pressable
                    key={tpl.id}
                    style={s.templateCard}
                    onPress={() => {
                      insertSnippet(tpl.content);
                      setTemplatesVisible(false);
                    }}
                  >
                    <View style={s.templateCardHead}>
                      <Text style={s.templateCardTitle}>{tpl.title}</Text>
                      <Text style={s.templateCardDate}>{tpl.updatedAt}</Text>
                    </View>
                    {tpl.description ? (
                      <Text style={s.templateCardDesc}>{tpl.description}</Text>
                    ) : null}
                    <Text style={s.templateCardPreview} numberOfLines={2}>
                      {tpl.content}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={s.closeBtn} onPress={() => setTemplatesVisible(false)}>
              <Text style={s.closeBtnText}>关闭</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 数学符号面板 */}
      <Modal
        visible={symbolsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSymbolsVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalPanel}>
            <Text style={s.modalTitle}>数学符号</Text>
            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
              {SYMBOL_GROUPS.map((g) => (
                <View key={g.title}>
                  <Text style={s.symbolGroupTitle}>{g.title}</Text>
                  <View style={s.symbolGrid}>
                    {g.items.map((item) => (
                      <Pressable
                        key={item.label}
                        style={s.symbolBtn}
                        onPress={() => {
                          insertSnippet(item.insert);
                          setSymbolsVisible(false);
                        }}
                      >
                        <Text style={s.symbolLabel}>{item.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable style={s.closeBtn} onPress={() => setSymbolsVisible(false)}>
              <Text style={s.closeBtnText}>关闭</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1 },
    toolbar: {
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    toolBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 5,
      paddingHorizontal: 11,
      marginRight: SPACING.xs,
      backgroundColor: COLORS.bg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toolBtnTemplates: {
      borderColor: COLORS.accent,
      backgroundColor: COLORS.infoBg,
    },
    toolBtnSymbols: {
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    toolText: {
      fontSize: 13,
      color: COLORS.text,
      fontWeight: '500',
    },
    toolTextAccent: {
      color: COLORS.accent,
      fontWeight: '600',
    },
    editor: {
      flex: 1,
      padding: SPACING.md,
      fontSize: FONT.size,
      fontFamily: FONT.mono,
      lineHeight: FONT.lineHeight,
      color: COLORS.text,
      backgroundColor: COLORS.bg,
      textAlignVertical: 'top',
    },
    counter: {
      textAlign: 'right',
      fontSize: 12,
      color: COLORS.textLight,
      padding: SPACING.xs,
      backgroundColor: COLORS.bgSubtle,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalPanel: {
      backgroundColor: COLORS.bg,
      borderTopWidth: 1,
      borderColor: COLORS.border,
      maxHeight: '75%',
      padding: SPACING.md,
    },
    modalHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.text,
    },
    manageLink: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: COLORS.accent,
      backgroundColor: COLORS.infoBg,
    },
    manageLinkText: {
      fontSize: 12,
      color: COLORS.accent,
      fontWeight: '600',
    },
    modalScroll: {
      maxHeight: 380,
    },
    templateCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgSubtle,
      padding: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    templateCardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    templateCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.text,
      flex: 1,
    },
    templateCardDate: {
      fontSize: 11,
      color: COLORS.textLight,
      marginLeft: SPACING.xs,
    },
    templateCardDesc: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginBottom: 4,
    },
    templateCardPreview: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 11,
      color: COLORS.textLight,
      lineHeight: 16,
    },
    emptyTemplates: {
      padding: SPACING.lg,
      alignItems: 'center',
    },
    emptyTemplatesText: {
      fontSize: 13,
      color: COLORS.textLight,
    },
    symbolGroupTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    symbolGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
    },
    symbolBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: COLORS.bgSubtle,
    },
    symbolLabel: {
      fontSize: 12,
      color: COLORS.accent,
      fontFamily: FONT.mono,
    },
    closeBtn: {
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      backgroundColor: COLORS.bgSubtle,
    },
    closeBtnText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
  });
