// 应用名标识：主名与「Lite」徽标同排显示，形成「SlyWrite[Lite]」的观感。
// 徽标为加边框 + 底色的方块标签（扁平直角），与主名共用一条基线，字号按主名等比缩放。
// 用法：<BrandName size="lg" />；需要整行容器时自己套一层 View。
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type Palette } from '../theme';

export type BrandSize = 'sm' | 'md' | 'lg';

interface BrandNameProps {
  /** sm=14 / md=16 / lg=20，主名与徽标按同一比例缩放 */
  size?: BrandSize;
  /** 附加到最外层的样式（用于对齐与外边距） */
  style?: object;
}

const MAIN_LABEL = 'SlyWrite';
const BADGE_LABEL = 'Lite';

function metrics(scale: number) {
  return {
    main: Math.round(14 * scale),
    badge: Math.round(10 * scale),
    badgePadH: Math.round(5 * scale),
    badgePadV: Math.round(1.5 * scale),
    gap: Math.round(5 * scale),
    border: scale >= 1.4 ? 1.5 : 1,
  };
}

const SIZES: Record<BrandSize, number> = { sm: 1, md: 1.15, lg: 1.43 };

// 徽标专用银灰色板：刻意不跟随主题强调色，让「Lite」在任何主题下都呈中性灰/银观感，
// 与主名（SlyWrite，跟随主题色）形成「本体 / 衍生版」的视觉层级。
const BADGE_LIGHT = {
  text: '#78818a',
  bg: '#eef0f2',
  border: '#a8b0b8',
};
const BADGE_DARK = {
  text: '#b8c0c8',
  bg: '#2a2f36',
  border: '#6a727c',
};

export default function BrandName({ size = 'md', style }: BrandNameProps) {
  const { colors, isDark } = useTheme();
  const s = createStyles(colors, isDark ? BADGE_DARK : BADGE_LIGHT);
  const m = metrics(SIZES[size]);

  return (
    <View style={[s.row, style]}>
      <Text style={[s.main, { fontSize: m.main }]}>{MAIN_LABEL}</Text>
      <Text
        style={[
          s.badge,
          {
            fontSize: m.badge,
            paddingVertical: m.badgePadV,
            paddingHorizontal: m.badgePadH,
            marginLeft: m.gap,
            borderWidth: m.border,
          },
        ]}
      >
        {BADGE_LABEL}
      </Text>
    </View>
  );
}

type BadgeColors = { text: string; bg: string; border: string };

const createStyles = (COLORS: Palette, BADGE: BadgeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    main: {
      color: COLORS.text,
      fontWeight: '700',
      letterSpacing: 0.2,
      includeFontPadding: false,
    },
    badge: {
      color: BADGE.text,
      fontWeight: '700',
      letterSpacing: 0.6,
      backgroundColor: BADGE.bg,
      borderColor: BADGE.border,
      includeFontPadding: false,
    },
  });
