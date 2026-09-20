// 更新日志页：静态内置展示全部版本的更新内容（最新 → 最初），随 App 打包，不联网。
// 自 SlyWrite 同名页面（shepherd-library-app/app/changelog.tsx）复制，Lite 自持一份，不跨项目引用。
// 数据源：src/lib/changelog-data.ts（由 scripts/gen-changelog.js 从仓库 changelog/ 目录生成）；
// 生成器只收录面向读者的节，构建与发布、硬约束记录等开发者节不进界面。
// 时间条：节点为菱形时间标记，游标与进度线随当前版本移动；点节点跳到对应版本卡片，
//         滚动卡片反向带动时间条。游标与节点共用同一坐标空间（轨道不加左内边距），
//         跳转期间加锁，避免动画滚动的中间位置把选中版本改走。
import React, { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { CHANGELOG_DATA, type ChangelogEntry } from '../src/lib/changelog-data';
import { SPACING, useTheme, type Palette } from '../src/theme';

/** 时间条单个节点宽度（含间距），用于计算进度线与定位 */
const ITEM_W = 84;
/** 时间条末端留白：避免最后一个节点的标签贴着可滚动区域的右边缘 */
const PAD_R = 14;

/** 行内文本：支持 `代码` 与 **加粗** 片段 */
function InlineText({
  text,
  baseStyle,
  monoStyle,
}: {
  text: string;
  baseStyle: StyleProp<TextStyle>;
  monoStyle: StyleProp<TextStyle>;
}) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length <= 1) return <Text style={baseStyle}>{text}</Text>;
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => {
        if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) {
          return (
            <Text key={i} style={monoStyle}>
              {p.slice(1, -1)}
            </Text>
          );
        }
        if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) {
          return (
            <Text key={i} style={[baseStyle, { fontWeight: '700' }]}>
              {p.slice(2, -2)}
            </Text>
          );
        }
        return p;
      })}
    </Text>
  );
}

/** 第 i 个节点中心相对时间条内容起点的横向距离
 *  节点是轨道的行内子元素、游标与进度线是轨道的绝对子元素，两者必须落在同一坐标空间：
 *  轨道一侧不加任何内边距，游标才能压在节点正中 */
function nodeCenter(i: number): number {
  return i * ITEM_W + ITEM_W / 2;
}

/** 渲染异常兜底：内置日志数据异常时降级为可读提示，不把整页变成白屏 */
class ChangelogErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('changelog render failed:', error?.message);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <FallbackView />;
  }
}

/** 兜底视图（独立组件，避免依赖主组件的样式实例） */
function FallbackView() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>更新日志</Text>
      <View style={s.box}>
        <Text style={s.hint}>更新日志暂时无法显示。可返回上一页重新进入；若一直如此，请重新安装最新版本。</Text>
      </View>
    </ScrollView>
  );
}

export default function ChangelogScreen() {
  return (
    <ChangelogErrorBoundary>
      <ChangelogView />
    </ChangelogErrorBoundary>
  );
}

function ChangelogView() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  /** 展示顺序：最新在前（数据源按版本升序生成，此处反转） */
  const logs: ChangelogEntry[] = useMemo(() => [...CHANGELOG_DATA].reverse(), []);
  const count = logs.length;

  const listRef = useRef<ScrollView>(null);
  const barRef = useRef<ScrollView>(null);
  /** 每张日志卡片相对内容容器顶部的 y 偏移（onLayout 采集） */
  const cardOffsets = useRef<number[]>([]);
  /** 时间条可视宽度（用于把当前节点保持可见） */
  const barWidth = useRef(0);
  const activeRef = useRef(0);
  /** 时间条跳转期间为真：滚动动画落定前不允许反向改写选中项 */
  const jumpLocked = useRef(false);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [active, setActive] = useState(0);
  /** 进度线与菱形游标共用的横向位置（px，JS 驱动以便同时动画 width） */
  const ringX = useRef(new Animated.Value(nodeCenter(0))).current;
  /** 点击节点时的弹性缩放 */
  const ringPop = useRef(new Animated.Value(1)).current;
  /** 入场淡入上移 */
  const enter = useRef(new Animated.Value(0)).current;

  const contentWidth = useMemo(() => Math.max(1, count) * ITEM_W + PAD_R, [count]);

  useEffect(() => {
    // 入场动画走 JS 驱动：时间条内部另有 JS 驱动的游标与进度线，
    // 父层用原生驱动会在 Android 上丢掉子层的 JS 更新
    Animated.timing(enter, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [enter]);

  /** 进度线宽度：从起点生长到当前节点中心（单版本时无需生长动画） */
  const progressWidth =
    count > 1
      ? ringX.interpolate({
          inputRange: [nodeCenter(0), nodeCenter(count - 1)],
          outputRange: [nodeCenter(0), nodeCenter(count - 1)],
          extrapolate: 'clamp',
        })
      : nodeCenter(0);

  /** 解除跳转锁：用户自己拖动列表，或动画早已落定 */
  const releaseJumpLock = useCallback(() => {
    jumpLocked.current = false;
    if (jumpTimer.current) {
      clearTimeout(jumpTimer.current);
      jumpTimer.current = null;
    }
  }, []);

  /** 选中某个版本：更新游标 + 弹性反馈；fromBar 为真时同时滚动到对应卡片 */
  const focusIndex = useCallback(
    (i: number, fromBar: boolean) => {
      if (i < 0 || i >= count) return;
      activeRef.current = i;
      setActive(i);
      Animated.timing(ringX, { toValue: nodeCenter(i), duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      if (fromBar) {
        ringPop.setValue(0.72);
        // 与 ringX 同属一个 Animated.View，驱动方式必须一致（JS 驱动）：
        // 混用原生驱动会在点击时抛驱动冲突异常并白屏
        Animated.spring(ringPop, { toValue: 1, friction: 3.6, tension: 160, useNativeDriver: false }).start();
        // 带动画的跳转会连续触发 onScroll，中间位置反推出的版本不是刚点的那个，
        // 且靠后的版本滚到底也顶不到视口顶部；跳转期间以点击的版本为准。
        jumpLocked.current = true;
        if (jumpTimer.current) clearTimeout(jumpTimer.current);
        jumpTimer.current = setTimeout(releaseJumpLock, 700);
        const y = cardOffsets.current[i];
        if (typeof y === 'number') listRef.current?.scrollTo({ y: Math.max(0, y - 6), animated: true });
      } else {
        // 由列表滚动带动：让时间条跟着走，保证当前节点可见
        const viewW = barWidth.current || 320;
        barRef.current?.scrollTo({ x: Math.max(0, nodeCenter(i) - viewW / 2), animated: true });
      }
    },
    [count, releaseJumpLock, ringPop, ringX],
  );

  /** 纵向滚动时按卡片偏移定位当前版本（列表滚动 → 时间条联动） */
  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!count || jumpLocked.current) return;
      const y = e.nativeEvent.contentOffset.y;
      const offs = cardOffsets.current;
      let idx = 0;
      for (let i = 0; i < offs.length; i++) {
        if (typeof offs[i] === 'number' && offs[i] - 24 <= y) idx = i;
      }
      if (idx !== activeRef.current) focusIndex(idx, false);
    },
    [count, focusIndex],
  );

  if (count === 0) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>更新日志</Text>
        <View style={s.box}>
          <Text style={s.hint}>暂无更新日志内容。</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={s.container}>
      {/* 可滑动时间条 */}
      <Animated.View
        style={[
          s.barWrap,
          {
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <View style={s.barHeader}>
          <Text style={s.barTitle}>版本时间线</Text>
          <Text style={s.barCount}>共 {count} 个版本</Text>
        </View>
        <Animated.ScrollView
          ref={barRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={s.barContent}
          onLayout={(e) => {
            barWidth.current = e.nativeEvent.layout.width;
          }}
        >
          <View style={[s.barTrack, { width: contentWidth }]}>
            <View style={s.trackLine} />
            <Animated.View style={[s.trackProgress, { width: progressWidth }]} />
            <Animated.View
              style={[
                s.trackCursor,
                { transform: [{ translateX: ringX }, { scale: ringPop }, { rotate: '45deg' }] },
              ]}
              pointerEvents="none"
            />
            {logs.map((log, i) => (
              <PressableItem
                key={log.key}
                width={ITEM_W}
                label={`v${log.key}`}
                active={i === active}
                first={i === 0}
                last={i === count - 1}
                onPress={() => focusIndex(i, true)}
              />
            ))}
          </View>
        </Animated.ScrollView>
        <Text style={s.barHint}>左端为最新版本，向右滑动回溯更早版本；点击节点直接跳到该版本说明</Text>
      </Animated.View>

      <ScrollView
        ref={listRef}
        style={s.list}
        contentContainerStyle={s.content}
        onScroll={onListScroll}
        onScrollBeginDrag={releaseJumpLock}
        scrollEventThrottle={64}
      >
        <Text style={s.pageTitle}>更新日志</Text>
        <Text style={s.hint}>
          最新版本在前，向下依次回溯；内容随应用内置，无需联网。{`当前共收录 ${count} 个版本。`}
        </Text>

        {logs.map((log, idx) => (
          <View
            key={log.key}
            style={[s.versionCard, idx === 0 && s.firstCard, idx === active && s.versionCardActive]}
            onLayout={(e) => {
              cardOffsets.current[idx] = e.nativeEvent.layout.y;
            }}
          >
            <View style={s.versionHeader}>
              <Text style={s.versionTag}>v{log.key}</Text>
              {idx === active && <Text style={s.currentMark}>当前定位</Text>}
            </View>
            {log.summary ? <Text style={s.summary}>{log.summary}</Text> : null}
            {log.blocks.map((b, i) =>
              b.kind === 'section' ? (
                <Text key={i} style={s.sectionText}>
                  {b.text}
                </Text>
              ) : (
                <View key={i} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <View style={{ flex: 1 }}>
                    <InlineText text={b.text} baseStyle={s.bulletText} monoStyle={s.monoText} />
                  </View>
                </View>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** 时间条节点：菱形时间标记 + 版本号（扁平风格，无圆角） */
function PressableItem({
  width,
  label,
  active,
  first,
  last,
  onPress,
}: {
  width: number;
  label: string;
  active: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  return (
    <PressableCell width={width} onPress={onPress}>
      <View style={s.nodeDotWrap}>
        <View style={[s.nodeDot, active && s.nodeDotActive]} />
      </View>
      <Text style={[s.nodeLabel, active && s.nodeLabelActive, last && s.nodeLabelLast]} numberOfLines={1}>
        {label}
      </Text>
      {first && <Text style={[s.nodeEdge, s.nodeEdgeRight]}>最新</Text>}
      {last && <Text style={s.nodeEdge}>最初</Text>}
    </PressableCell>
  );
}

/** 节点外框（单独抽出，保持横向排列宽度稳定） */
function PressableCell({ width, onPress, children }: { width: number; onPress: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.nodeCell, { width }, pressed && s.nodeCellPressed]}>
      {children}
    </Pressable>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    // 时间条
    barWrap: {
      backgroundColor: COLORS.bg,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      paddingTop: SPACING.sm,
    },
    barHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.xs,
    },
    barTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5 },
    barCount: { fontSize: 11, color: COLORS.textLight },
    barContent: { paddingRight: SPACING.md },
    barTrack: { height: 66, flexDirection: 'row', alignItems: 'flex-start' },
    trackLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 17,
      height: 1,
      backgroundColor: COLORS.borderDark,
    },
    trackProgress: {
      position: 'absolute',
      left: 0,
      top: 16,
      height: 3,
      backgroundColor: COLORS.accentLight,
    },
    trackCursor: {
      position: 'absolute',
      left: -7,
      top: 12,
      width: 14,
      height: 14,
      backgroundColor: COLORS.accent,
    },
    nodeCell: { alignItems: 'center', paddingTop: 8 },
    nodeCellPressed: { opacity: 0.6 },
    nodeDotWrap: { height: 20, alignItems: 'center', justifyContent: 'center' },
    nodeDot: {
      width: 8,
      height: 8,
      backgroundColor: COLORS.borderDark,
      transform: [{ rotate: '45deg' }],
    },
    nodeDotActive: { backgroundColor: COLORS.accent },
    nodeLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 4, textAlign: 'center', maxWidth: ITEM_W - 6 },
    nodeLabelActive: { color: COLORS.accent, fontWeight: '700' },
    nodeLabelLast: { maxWidth: ITEM_W },
    nodeEdge: { fontSize: 10, color: COLORS.textLight, marginTop: 1 },
    nodeEdgeRight: { color: COLORS.accentLight },
    barHint: { fontSize: 11, color: COLORS.textLight, paddingHorizontal: SPACING.md, paddingBottom: 6 },
    // 日志卡片
    list: { flex: 1 },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    pageTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm },
    hint: { fontSize: 12, color: COLORS.textLight, lineHeight: 17, marginBottom: SPACING.sm },
    box: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    versionCard: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderTopWidth: 2,
      borderTopColor: COLORS.accentLight,
    },
    versionCardActive: { borderColor: COLORS.accentLight, borderTopColor: COLORS.accent },
    firstCard: { marginTop: SPACING.xs },
    versionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
      flexWrap: 'wrap',
    },
    versionTag: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
      backgroundColor: COLORS.accent,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginRight: SPACING.sm,
    },
    currentMark: {
      fontSize: 10,
      color: COLORS.accent,
      borderWidth: 1,
      borderColor: COLORS.accentLight,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    summary: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 19, marginBottom: SPACING.sm },
    sectionText: { fontSize: 13, fontWeight: '700', color: COLORS.accent, marginTop: SPACING.sm, marginBottom: 4 },
    bulletRow: { flexDirection: 'row', marginBottom: 6 },
    bulletDot: { fontSize: 12.5, color: COLORS.textLight, marginRight: 6, lineHeight: 19 },
    bulletText: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 19 },
    monoText: { fontSize: 11.5, color: COLORS.text, backgroundColor: COLORS.bgMuted, paddingHorizontal: 2 },
  });
