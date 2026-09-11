// 根布局：Stack + 状态栏 + 主题初始化 + 笔记目录首次加载。
// 与 SlyWrite 的差别：没有登录门禁与站点配置，Lite 开箱即用。
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '../src/store/settings-store';
import { useNotesStore } from '../src/store/notes-store';
import { useTheme, type Palette } from '../src/theme';

export default function RootLayout() {
  const settingsInit = useSettingsStore((s) => s.init);
  const notesInit = useNotesStore((s) => s.init);
  const { isDark, colors } = useTheme();
  const s = createStyles(colors);

  useEffect(() => {
    settingsInit();
    notesInit();
  }, [settingsInit, notesInit]);

  return (
    <View style={s.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontWeight: '600' },
          headerTitleAlign: 'center',
          contentStyle: { backgroundColor: colors.bgSubtle },
        }}
      >
        <Stack.Screen name="index" options={{ title: '笔记本' }} />
        <Stack.Screen name="note" options={{ title: '笔记' }} />
        <Stack.Screen name="recycle" options={{ title: '回收站' }} />
        <Stack.Screen name="settings" options={{ title: '设置' }} />
      </Stack>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
  });
