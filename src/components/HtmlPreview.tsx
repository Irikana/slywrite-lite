// HTML 预览（WebView 渲染生成 HTML，最保真）
// 自 SlyWrite 同名组件复制，新增 onSchemeRequest：
//   预览 HTML 里的双链使用自定义 scheme（slywrite-lite://note/<标题>），
//   回调返回 true 表示已由 App 处理，组件返回 false 阻止 WebView 自行导航。
// （自 SlyWrite 同名组件复制，Lite 自持一份，不引用其他子项目源码。）
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme, type Palette } from '../theme';

export interface HtmlPreviewProps {
  html: string;
  /** 可选：HTML 中相对路径资源（图片/CSS/JS）的解析基地址 */
  baseUrl?: string;
  /**
   * 自定义 scheme 拦截：WebView 发起任何加载前调用。
   * 返回 true 表示此 URL 已被上层消费（阻止 WebView 导航）；返回 false 放行正常加载。
   */
  onSchemeRequest?: (url: string) => boolean;
}

export function HtmlPreview({ html, baseUrl, onSchemeRequest }: HtmlPreviewProps) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  return (
    <View style={s.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html, ...(baseUrl ? { baseUrl } : {}) }}
        style={s.webview}
        onShouldStartLoadWithRequest={(request) => {
          if (onSchemeRequest && onSchemeRequest(request.url)) return false;
          return true;
        }}
        renderLoading={() => (
          <View style={s.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        startInLoadingState
      />
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    webview: { flex: 1 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
