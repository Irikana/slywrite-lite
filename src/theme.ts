// SlyWrite Lite 主题系统：浅色 / 深色 / 跟随系统 / 温和主题（暖米、雾蓝、森绿、日暮、海洋、薰衣草、咖啡、薄荷）
// 色板承袭 SlyWrite 的扁平化配色（无圆角、无站点依赖），Lite 自持一份，不引用任何其他子项目源码。
// 所有组件通过 useTheme() 获取当前色板，样式用 createStyles(colors) 函数化
import { useColorScheme } from 'react-native';
import { useSettingsStore } from './store/settings-store';

export type ThemeMode = 'light' | 'dark' | 'system' | 'warm' | 'mist' | 'sage' | 'sunset' | 'ocean' | 'lavender' | 'coffee' | 'mint';

/** 色板结构 */
export interface Palette {
  accent: string;
  accentLight: string;
  bg: string;
  bgSubtle: string;
  bgMuted: string;
  border: string;
  borderDark: string;
  text: string;
  textSecondary: string;
  textLight: string;
  danger: string;
  success: string;
  warning: string;
  infoBg: string;
  dangerBg: string;
  successBg: string;
  tagAiBg: string;
  tagAiText: string;
  tagEditedBg: string;
  tagEditedText: string;
  tagNewsBg: string;
  tagNewsBorder: string;
  tagNewsText: string;
  tagNovelBg: string;
  tagNovelBorder: string;
  tagNovelText: string;
}

/** 浅色色板（对齐扁平化设计：无圆角） */
export const LIGHT_PALETTE: Palette = {
  accent: '#2c3e50',
  accentLight: '#5d9ccc',
  bg: '#ffffff',
  bgSubtle: '#fafafa',
  bgMuted: '#f5f5f5',
  border: '#e0e0e0',
  borderDark: '#cccccc',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textLight: '#888888',
  danger: '#c0392b',
  success: '#27ae60',
  warning: '#b8860b',
  infoBg: '#f0f7fd',
  dangerBg: '#fdf2f2',
  successBg: '#f0faf3',
  tagAiBg: '#fff8e6',
  tagAiText: '#b8860b',
  tagEditedBg: '#fce4ec',
  tagEditedText: '#c62828',
  tagNewsBg: 'rgba(41,128,185,0.14)',
  tagNewsBorder: '#a8cfeb',
  tagNewsText: '#2980b9',
  tagNovelBg: '#f3e8fd',
  tagNovelBorder: '#d7b8ec',
  tagNovelText: '#7d3c98',
} as const;

/** 深色色板 */
export const DARK_PALETTE: Palette = {
  accent: '#5d9ccc',
  accentLight: '#7fb3e0',
  bg: '#1c1f24',
  bgSubtle: '#16181c',
  bgMuted: '#21252b',
  border: '#2e333a',
  borderDark: '#3a4048',
  text: '#e8eaed',
  textSecondary: '#b0b6bf',
  textLight: '#7d8590',
  danger: '#e57373',
  success: '#58c98c',
  warning: '#d4a94f',
  infoBg: '#1d2a38',
  dangerBg: '#33211f',
  successBg: '#1c2f22',
  tagAiBg: '#3a3320',
  tagAiText: '#e3c56d',
  tagEditedBg: '#3a2328',
  tagEditedText: '#e59aa8',
  tagNewsBg: 'rgba(93,156,204,0.22)',
  tagNewsBorder: '#5d9ccc',
  tagNewsText: '#8ab4d8',
  tagNovelBg: 'rgba(178,140,220,0.22)',
  tagNovelBorder: '#8e6bb3',
  tagNovelText: '#c9a7e0',
};

/** 温和主题 · 暖米（柔和纸感）：低饱和暖白 + 暖棕，温和不刺眼 */
export const WARM_PALETTE: Palette = {
  accent: '#8a6d4b',
  accentLight: '#b08d63',
  bg: '#faf6ee',
  bgSubtle: '#f4eee2',
  bgMuted: '#ece4d4',
  border: '#e0d6c2',
  borderDark: '#cfc1a6',
  text: '#3b3226',
  textSecondary: '#6b5f4d',
  textLight: '#988b73',
  danger: '#b04e3f',
  success: '#4e8d5f',
  warning: '#a5822f',
  infoBg: '#f6f0e3',
  dangerBg: '#f9ece8',
  successBg: '#eef4ec',
  tagAiBg: '#faf0d8',
  tagAiText: '#96742b',
  tagEditedBg: '#f9e4e0',
  tagEditedText: '#a8443a',
  tagNewsBg: 'rgba(138,109,75,0.14)',
  tagNewsBorder: '#c9b294',
  tagNewsText: '#8a6d4b',
  tagNovelBg: '#f1e8f5',
  tagNovelBorder: '#cbb4d6',
  tagNovelText: '#7a5a8a',
};

/** 温和主题 · 雾蓝（静谧灰蓝）：低饱和冷灰蓝，柔和宁静 */
export const MIST_PALETTE: Palette = {
  accent: '#5a7d99',
  accentLight: '#7fa3bf',
  bg: '#f4f7fa',
  bgSubtle: '#edf2f7',
  bgMuted: '#e4ebf2',
  border: '#d3dde8',
  borderDark: '#bfccda',
  text: '#2d3a46',
  textSecondary: '#5a6b7a',
  textLight: '#8b9bab',
  danger: '#b0524d',
  success: '#4f8a72',
  warning: '#a1843c',
  infoBg: '#e8f0f7',
  dangerBg: '#f8ebeb',
  successBg: '#ebf4ef',
  tagAiBg: '#f8f0d9',
  tagAiText: '#96742b',
  tagEditedBg: '#f8e6e6',
  tagEditedText: '#a84848',
  tagNewsBg: 'rgba(90,125,153,0.16)',
  tagNewsBorder: '#aec6da',
  tagNewsText: '#4e718c',
  tagNovelBg: '#efe8f6',
  tagNovelBorder: '#cdbae0',
  tagNovelText: '#76528f',
};

/** 温和主题 · 森绿（淡雅护眼）：低饱和灰绿 + 浅绿背景，清新温和 */
export const SAGE_PALETTE: Palette = {
  accent: '#5c7a5e',
  accentLight: '#7f9d80',
  bg: '#f5f7f2',
  bgSubtle: '#eef2e9',
  bgMuted: '#e5ebdf',
  border: '#d5ddd0',
  borderDark: '#c2cdb8',
  text: '#2e3a2e',
  textSecondary: '#5c6b59',
  textLight: '#8b9884',
  danger: '#ad554c',
  success: '#4f8a63',
  warning: '#a18238',
  infoBg: '#e9f1e7',
  dangerBg: '#f8ece9',
  successBg: '#ecf4ec',
  tagAiBg: '#f8f0d9',
  tagAiText: '#96742b',
  tagEditedBg: '#f8e6e4',
  tagEditedText: '#b0493f',
  tagNewsBg: 'rgba(92,122,94,0.16)',
  tagNewsBorder: '#b5c9b6',
  tagNewsText: '#557456',
  tagNovelBg: '#efe8f6',
  tagNovelBorder: '#cdbae0',
  tagNovelText: '#76528f',
};

/** 温和主题 · 日暮（暖色夕阳）：温暖的橙调粉红，如晚霞般柔和 */
export const SUNSET_PALETTE: Palette = {
  accent: '#b8694d',
  accentLight: '#d48970',
  bg: '#fdf8f4',
  bgSubtle: '#faf1ea',
  bgMuted: '#f5e8dc',
  border: '#e8d5c6',
  borderDark: '#d9c1ac',
  text: '#3d2819',
  textSecondary: '#6d523d',
  textLight: '#9a8166',
  danger: '#b34a42',
  success: '#5a8b66',
  warning: '#a87e32',
  infoBg: '#fdf5ed',
  dangerBg: '#fcece9',
  successBg: '#eff5ed',
  tagAiBg: '#fff3d9',
  tagAiText: '#9a7328',
  tagEditedBg: '#fce9e5',
  tagEditedText: '#ad4a41',
  tagNewsBg: 'rgba(184,105,77,0.14)',
  tagNewsBorder: '#d9b5a0',
  tagNewsText: '#a5624b',
  tagNovelBg: '#f5ebf8',
  tagNovelBorder: '#d6b8e2',
  tagNovelText: '#815993',
};

/** 温和主题 · 海洋（深邃蓝调）：沉稳的深蓝，如深海般静谧 */
export const OCEAN_PALETTE: Palette = {
  accent: '#3d6b8a',
  accentLight: '#5a8fb3',
  bg: '#f3f7fa',
  bgSubtle: '#eaf1f7',
  bgMuted: '#dfe9f2',
  border: '#cfdce8',
  borderDark: '#b8cbd9',
  text: '#1e3140',
  textSecondary: '#4a5f70',
  textLight: '#738a9b',
  danger: '#b04f4c',
  success: '#4f8d73',
  warning: '#a1843c',
  infoBg: '#e6f2f8',
  dangerBg: '#f7ebeb',
  successBg: '#ebf5ef',
  tagAiBg: '#f8f1da',
  tagAiText: '#96742c',
  tagEditedBg: '#f8e7e6',
  tagEditedText: '#a84c49',
  tagNewsBg: 'rgba(61,107,138,0.16)',
  tagNewsBorder: '#a3c3d9',
  tagNewsText: '#3a6484',
  tagNovelBg: '#ede8f6',
  tagNovelBorder: '#cbb8e0',
  tagNovelText: '#745390',
};

/** 温和主题 · 薰衣草（淡紫柔和）：柔和的紫调，如薰衣草田般浪漫 */
export const LAVENDER_PALETTE: Palette = {
  accent: '#7d6b8a',
  accentLight: '#9e8db3',
  bg: '#f8f6fa',
  bgSubtle: '#f2eef7',
  bgMuted: '#e9e3f0',
  border: '#dcd3e6',
  borderDark: '#cbbfd6',
  text: '#302838',
  textSecondary: '#5f546b',
  textLight: '#8b7f97',
  danger: '#b04f59',
  success: '#4f8d6b',
  warning: '#a17f3c',
  infoBg: '#ede9f5',
  dangerBg: '#f7ebee',
  successBg: '#ebf5ed',
  tagAiBg: '#f8f0da',
  tagAiText: '#96742c',
  tagEditedBg: '#f8e7eb',
  tagEditedText: '#a84951',
  tagNewsBg: 'rgba(125,107,138,0.16)',
  tagNewsBorder: '#c5b8d6',
  tagNewsText: '#6d5f80',
  tagNovelBg: '#ede8f6',
  tagNovelBorder: '#cbb8e0',
  tagNovelText: '#745390',
};

/** 温和主题 · 咖啡（深棕温润）：温润的深棕调，如咖啡香气般醇厚 */
export const COFFEE_PALETTE: Palette = {
  accent: '#7a5d47',
  accentLight: '#9f7d63',
  bg: '#faf7f2',
  bgSubtle: '#f4efe7',
  bgMuted: '#ebe3d7',
  border: '#ddd2c4',
  borderDark: '#ccbbaa',
  text: '#342818',
  textSecondary: '#5f4e3c',
  textLight: '#8a7660',
  danger: '#b04942',
  success: '#4e8a5f',
  warning: '#a57d2f',
  infoBg: '#f6f1e8',
  dangerBg: '#f7ebe8',
  successBg: '#ebf4eb',
  tagAiBg: '#fff2d8',
  tagAiText: '#997428',
  tagEditedBg: '#fce8e4',
  tagEditedText: '#ad473d',
  tagNewsBg: 'rgba(122,93,71,0.14)',
  tagNewsBorder: '#cdb7a0',
  tagNewsText: '#705947',
  tagNovelBg: '#f4e9f7',
  tagNovelBorder: '#d4b8e0',
  tagNovelText: '#7f5591',
};

/** 温和主题 · 薄荷（清新绿调）：清新的绿薄荷色，如晨露般清爽 */
export const MINT_PALETTE: Palette = {
  accent: '#4d8a73',
  accentLight: '#6dab95',
  bg: '#f4faf7',
  bgSubtle: '#eaf5f0',
  bgMuted: '#deeee7',
  border: '#cfe3da',
  borderDark: '#bad4c7',
  text: '#1e3830',
  textSecondary: '#4a6359',
  textLight: '#738f84',
  danger: '#b04c52',
  success: '#4f8d66',
  warning: '#a1813c',
  infoBg: '#e6f5ef',
  dangerBg: '#f7ebec',
  successBg: '#ebf5ed',
  tagAiBg: '#f8f1da',
  tagAiText: '#96742c',
  tagEditedBg: '#f8e7e8',
  tagEditedText: '#a8494e',
  tagNewsBg: 'rgba(77,138,115,0.16)',
  tagNewsBorder: '#a8d4c1',
  tagNewsText: '#468268',
  tagNovelBg: '#ede8f6',
  tagNovelBorder: '#cbb8e0',
  tagNovelText: '#745390',
};

/**
 * 当前主题色板 hook。
 * themeMode 为 'system' 时跟随系统外观（useColorScheme）；
 * 温和主题（暖米/雾蓝/森绿/日暮/海洋/薰衣草/咖啡/薄荷）为固定浅色调，不随系统切换。
 */
export function useTheme(): { isDark: boolean; colors: Palette } {
  const mode = useSettingsStore((s) => s.themeMode);
  const system = useColorScheme();
  const colors =
    mode === 'dark' || (mode === 'system' && system === 'dark')
      ? DARK_PALETTE
      : mode === 'warm'
        ? WARM_PALETTE
        : mode === 'mist'
          ? MIST_PALETTE
          : mode === 'sage'
            ? SAGE_PALETTE
            : mode === 'sunset'
              ? SUNSET_PALETTE
              : mode === 'ocean'
                ? OCEAN_PALETTE
                : mode === 'lavender'
                  ? LAVENDER_PALETTE
                  : mode === 'coffee'
                    ? COFFEE_PALETTE
                    : mode === 'mint'
                      ? MINT_PALETTE
                      : LIGHT_PALETTE;
  const isDark =
    mode === 'dark' || (mode === 'system' && system === 'dark');
  return { isDark, colors };
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const FONT = {
  size: 15,
  lineHeight: 22,
  mono: 'monospace',
} as const;
