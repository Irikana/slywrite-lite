// 设置状态：主题模式的持久化与初始化。
// theme.ts 直接 import 本文件（useSettingsStore），改动需保持导出名与 themeMode 字段不变。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** 主题模式：system 跟随系统；light/dark 基础两档；其余为温和主题固定色板（键名与 src/theme.ts 对齐） */
export type ThemeMode =
  | 'system'
  | 'light'
  | 'dark'
  | 'warm'
  | 'mist'
  | 'sage'
  | 'sunset'
  | 'ocean'
  | 'lavender'
  | 'coffee'
  | 'mint';

const THEME_STORAGE_KEY = 'slywrite-lit…mode';

/** 全部合法模式（设置页按此顺序列出） */
export const THEME_MODES: ThemeMode[] = [
  'system',
  'light',
  'dark',
  'warm',
  'mist',
  'sage',
  'sunset',
  'ocean',
  'lavender',
  'coffee',
  'mint',
];

/** 模式的中文名称（界面展示用） */
export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
  warm: '暖米',
  mist: '雾蓝',
  sage: '森绿',
  sunset: '日暮',
  ocean: '海洋',
  lavender: '薰衣草',
  coffee: '咖啡',
  mint: '薄荷',
};

/** 模式的中文说明（设置页副文案） */
export const THEME_MODE_HINTS: Record<ThemeMode, string> = {
  system: '随系统深色设置自动切换浅色或深色',
  light: '白色背景，适合明亮环境',
  dark: '深灰背景，夜间护眼',
  warm: '柔和纸感的暖米色调',
  mist: '静谧的灰蓝色调',
  sage: '淡雅护眼的灰绿色调',
  sunset: '暖色夕阳的橙粉色调',
  ocean: '深邃沉静的蓝白色调',
  lavender: '柔和浪漫的淡紫色调',
  coffee: '温润醇厚的棕色调',
  mint: '清新爽利的绿薄荷色调',
};

function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === 'string' && (THEME_MODES as string[]).includes(v);
}

interface SettingsState {
  themeMode: ThemeMode;
  /** 是否已从 AsyncStorage 恢复完成（恢复前界面用默认值渲染，不闪动） */
  hydrated: boolean;
  /** 应用启动时调用一次：读取持久化的主题模式 */
  init: () => Promise<void>;
  /** 切换主题模式并落盘 */
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  hydrated: false,

  init: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeMode(stored)) {
        set({ themeMode: stored, hydrated: true });
        return;
      }
    } catch {
      // 本地读取失败不打断启动，回退默认「跟随系统」
    }
    set({ hydrated: true });
  },

  setThemeMode: async (mode: ThemeMode) => {
    set({ themeMode: mode });
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // 写入失败仅影响持久化，本次会话内主题已生效
    }
  },
}));
