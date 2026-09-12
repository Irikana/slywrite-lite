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

export default function BrandName({ size = 'md', style }: BrandNameProps) {
  const { colors } = useTheme();
  const s = createStyles(colors);
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

const createStyles = (COLORS: Palette) =>
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
      color: COLORS.accent,
      fontWeight: '700',
      letterSpacing: 0.6,
      backgroundColor: COLORS.infoBg,
      borderColor: COLORS.accent,
      includeFontPadding: false,
    },
  });
