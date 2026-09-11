// Markdown 笔记编辑器（受控模式 + 插入工具栏 + 数学符号面板）。
// 与 SlyWrite 版本的差异：只支持受控（value + onChangeText 必填），不依赖任何全局 store；
// 工具栏换成笔记向预设（待办、双链、高亮、日期等），去掉脚注按钮。
// 插入交互：工具栏按钮插入后通过 setNativeProps 恢复光标位置并保持焦点；
// 锁定态（editable=false）：整块换成 ReadOnlyText，可滑动浏览、绝对不可编辑。
// （骨架取自 SlyWrite 同名组件，Lite 自持一份并按笔记场景改写。）
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FONT, SPACING, useTheme, type Palette } from '../theme';
import { ReadOnlyText } from './ReadOnlyText';

interface InsertAction {
  label: string;
  insert: (before: string, selStart: number, selEnd: number) => { text: string; cursor: number };
}

/** 片段插入：§ 为光标落点，无 § 时光标在片段末尾 */
function snippetAction(label: string, snippet: string): InsertAction {
  return {
    label,
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
  { label: 'H1', insert: (b, s) => ({ text: b.slice(0, s) + '# ' + b.slice(s), cursor: s + 2 }) },
  { label: 'H2', insert: (b, s) => ({ text: b.slice(0, s) + '## ' + b.slice(s), cursor: s + 3 }) },
  { label: 'H3', insert: (b, s) => ({ text: b.slice(0, s) + '### ' + b.slice(s), cursor: s + 4 }) },
  {
    label: '加粗',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '加粗';
      return { text: b.slice(0, s) + `**${sel}**` + b.slice(e), cursor: s + 2 + sel.length };
    },
  },
  {
    label: '斜体',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '斜体';
      return { text: b.slice(0, s) + `*${sel}*` + b.slice(e), cursor: s + 1 + sel.length };
    },
  },
  {
    label: '高亮',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '标记';
      return { text: b.slice(0, s) + `==${sel}==` + b.slice(e), cursor: s + 2 + sel.length };
    },
  },
  {
    label: '删除线',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '删除';
      return { text: b.slice(0, s) + `~~${sel}~~` + b.slice(e), cursor: s + 2 + sel.length };
    },
  },
  {
    label: '行内代码',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || 'code';
      return { text: b.slice(0, s) + '`' + sel + '`' + b.slice(e), cursor: s + 1 + sel.length };
    },
  },
  { label: '代码块', insert: (b, s) => snippetAction('代码块', '```js\n§\n```').insert(b, s, s) },
  { label: '引用', insert: (b, s) => ({ text: b.slice(0, s) + '> ' + b.slice(s), cursor: s + 2 }) },
  { label: '列表', insert: (b, s) => ({ text: b.slice(0, s) + '- ' + b.slice(s), cursor: s + 2 }) },
  { label: '有序', insert: (b, s) => ({ text: b.slice(0, s) + '1. ' + b.slice(s), cursor: s + 3 }) },
  { label: '待办', insert: (b, s) => ({ text: b.slice(0, s) + '- [ ] ' + b.slice(s), cursor: s + 6 }) },
  { label: '已完成', insert: (b, s) => ({ text: b.slice(0, s) + '- [x] ' + b.slice(s), cursor: s + 6 }) },
  {
    label: '表格',
    insert: (b, s) =>
      snippetAction('表格', '| 表头1 | 表头2 |\n| --- | --- |\n| §内容 | 内容 |').insert(b, s, s),
  },
  { label: '链接', insert: (b, s) => ({ text: b.slice(0, s) + '[文字](https://)' + b.slice(s), cursor: s + 9 }) },
  { label: '双链', insert: (b, s) => ({ text: b.slice(0, s) + '[[另一篇笔记标题]]' + b.slice(s), cursor: s + 2 }) },
  { label: '图片', insert: (b, s) => ({ text: b.slice(0, s) + '![图片描述](https://)' + b.slice(s), cursor: s + 20 }) },
  { label: '分割线', insert: (b, s) => ({ text: b.slice(0, s) + '\n---\n' + b.slice(s), cursor: s + 5 }) },
  { label: '备注块', insert: (b, s) => snippetAction('备注块', '> **备注**\n> §').insert(b, s, s) },
  {
    label: '日期',
    insert: (b, s) => {
      const d = new Date();
      const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { text: b.slice(0, s) + t + b.slice(s), cursor: s + t.length };
    },
  },
  {
    label: '行内公式',
    insert: (b, s, e) => {
      const sel = b.slice(s, e) || '公式';
      return { text: b.slice(0, s) + `$${sel}$` + b.slice(e), cursor: s + 1 + sel.length };
    },
  },
  {
    label: '独立公式',
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
  /** 受控值（必填：Lite 编辑器只有受控模式） */
  value: string;
  /** 受控变更回调（必填） */
  onChangeText: (text: string) => void;
  /** 是否可编辑（默认 true；false 时渲染 ReadOnlyText，可滑动不可编辑） */
  editable?: boolean;
  /** 空态提示文案 */
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChangeText,
  editable = true,
  placeholder = '在此撰写笔记（Markdown）…\n空行分段，上方工具栏可插入待办、双链、公式等片段',
}: MarkdownEditorProps) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const inputRef = React.useRef<TextInput>(null);
  const selectionRef = React.useRef({ start: 0, end: 0 });
  const [symbolsVisible, setSymbolsVisible] = useState(false);

  const text = value;

  /** 应用插入结果：更新文本 + 恢复光标（即使输入框短暂失焦也不丢位置） */
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

  /** 插入符号片段（含 § 光标占位） */
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
        /* 锁定态：整块换成只读浏览视图（可滑动、不可编辑、工具栏不可用） */
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
              // 键盘弹出时点击按钮一次即响应（不消费首次触摸），滑动不会误触
              keyboardShouldPersistTaps="handled"
            >
              {NOTE_ACTIONS.map((a) => (
                <Pressable key={a.label} style={s.toolBtn} onPress={() => handleInsert(a)}>
                  <Text style={s.toolText}>{a.label}</Text>
                </Pressable>
              ))}
              <Pressable style={[s.toolBtn, s.toolBtnSymbols]} onPress={() => setSymbolsVisible(true)}>
                <Text style={s.toolText}>数学符号</Text>
              </Pressable>
            </ScrollView>
          </View>
          {/* 正文区域：TextInput multiline 自行管理滚动（不嵌套 ScrollView） */}
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
      {/* 数学符号面板 */}
      <Modal
        visible={symbolsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSymbolsVisible(false)}
      >
        <View style={s.symbolOverlay}>
          <View style={s.symbolPanel}>
            <Text style={s.symbolTitle}>数学符号</Text>
            <ScrollView style={s.symbolScroll} keyboardShouldPersistTaps="handled">
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
            <Pressable style={s.symbolClose} onPress={() => setSymbolsVisible(false)}>
              <Text style={s.symbolCloseText}>关闭</Text>
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
      paddingHorizontal: 12,
      marginRight: SPACING.xs,
      backgroundColor: COLORS.bg,
    },
    toolBtnSymbols: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    toolText: { fontSize: 13, color: COLORS.accent, fontWeight: '500' },
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
    symbolOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    symbolPanel: {
      backgroundColor: COLORS.bg,
      borderTopWidth: 1,
      borderColor: COLORS.border,
      maxHeight: '75%',
      padding: SPACING.md,
    },
    symbolTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },
    symbolScroll: { flexGrow: 0 },
    symbolGroupTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    symbolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    symbolBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: COLORS.bgSubtle,
    },
    symbolLabel: { fontSize: 12, color: COLORS.accent, fontFamily: FONT.mono },
    symbolClose: {
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      backgroundColor: COLORS.bgSubtle,
    },
    symbolCloseText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  });
