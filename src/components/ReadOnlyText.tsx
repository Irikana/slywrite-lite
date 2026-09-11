// 只读浏览视图：锁定（不可编辑）状态下替代输入框使用。
// 需求背景：正文与源码标签页锁定后，Android 上 editable=false 的 TextInput 自身不再响应滚动，
// 用户既滑不动也看不了全文。此处用 ScrollView + 分段 Text 实现「可滑动浏览、绝对不可编辑」。
// 分段原因：整篇超长文本（站点文章源码可达数千行）放进单个 Text 会生成超高原生视图，
// 在 Android 上受纹理尺寸限制可能被裁切；按行分块后每块高度可控，滚动稳定。
// （自 SlyWrite 同名组件复制，Lite 自持一份，不引用其他子项目源码。）
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FONT, SPACING, useTheme, type Palette } from '../theme';

/** 每个 Text 块最多承载的行数（按行高约 21px 计，单块约 2900px，远离纹理上限） */
const LINES_PER_CHUNK = 140;

/** 超长单行（压缩过的 HTML）按字符数二次切分，避免单行本身就撑爆视图 */
const MAX_LINE_CHARS = 400;

export interface ReadOnlyTextProps {
  text: string;
  /** 等宽（源码）还是正文字体 */
  mono?: boolean;
  /** 顶部提示（如「已锁定：可滑动浏览，不可编辑」） */
  hint?: string;
}

function splitChunks(text: string): string[] {
  const lines = text.split('\n');
  const normalized: string[] = [];
  for (const line of lines) {
    if (line.length <= MAX_LINE_CHARS) {
      normalized.push(line);
      continue;
    }
    for (let i = 0; i < line.length; i += MAX_LINE_CHARS) {
      normalized.push(line.slice(i, i + MAX_LINE_CHARS));
    }
  }
  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += LINES_PER_CHUNK) {
    chunks.push(normalized.slice(i, i + LINES_PER_CHUNK).join('\n'));
  }
  return chunks.length ? chunks : [''];
}

export function ReadOnlyText({ text, mono = false, hint }: ReadOnlyTextProps) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const chunks = useMemo(() => splitChunks(text), [text]);

  return (
    <View style={s.container}>
      {hint ? (
        <View style={s.hintBar}>
          <Text style={s.hintText}>{hint}</Text>
        </View>
      ) : null}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {chunks.map((chunk, i) => (
          <Text key={i} style={[s.text, mono ? s.mono : s.prose]} selectable>
            {chunk}
          </Text>
        ))}
      </ScrollView>
      <Text style={s.counter}>{text.length} 字</Text>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    hintBar: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      backgroundColor: COLORS.bgMuted,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
    },
    hintText: { fontSize: 11, color: COLORS.textLight },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xl },
    text: { color: COLORS.text },
    mono: { fontSize: 14, lineHeight: 21, fontFamily: 'monospace' },
    prose: { fontSize: FONT.size, lineHeight: FONT.lineHeight },
    counter: {
      textAlign: 'right',
      fontSize: 12,
      color: COLORS.textLight,
      padding: SPACING.xs,
      backgroundColor: COLORS.bgSubtle,
    },
  });
