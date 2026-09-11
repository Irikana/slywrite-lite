// 未匹配的路由兜底。
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SPACING, useTheme, type Palette } from '../src/theme';

export default function NotFound() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.wrap}>
      <Text style={s.text}>页面不存在或已被移除</Text>
      <Pressable style={s.btn} onPress={() => router.replace('/')}>
        <Text style={s.btnText}>回主页</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.bg,
      padding: SPACING.lg,
    },
    text: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.md },
    btn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      backgroundColor: COLORS.infoBg,
      paddingVertical: 10,
      paddingHorizontal: SPACING.xl,
    },
    btnText: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },
  });
