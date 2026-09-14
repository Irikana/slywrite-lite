// HTML 预览 — Web / 桌面端实现（与 HtmlPreview.tsx 同名同签名，Metro 按 .web 后缀选择）。
// react-native-webview 13.x 没有 Web 端实现（包内只有 android/ios/macos/windows 变体），
// 直接使用会渲染「does not support this platform」占位文本，因此这里换成原生 iframe：
//   - 文档经 srcdoc 注入，sandbox 不放开 same-origin，导入的笔记内容接触不到主应用数据；
//   - 预览 HTML 里的双链（slywrite-lite://note/标题）由注入脚本捕获 click 后
//     postMessage 回宿主，转给 onSchemeRequest，与原生端 WebView 拦截语义对齐；
//   - 普通 http(s) 链接强制 target=_blank，桌面壳的 window-open 拦截会交给系统浏览器。
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme, type Palette } from '../theme';

export interface HtmlPreviewProps {
  html: string;
  /** 可选：资源基址（srcdoc 场景没有相对资源，保留签名兼容） */
  baseUrl?: string;
  /** 自定义 scheme 拦截：返回 true 表示已由 App 处理 */
  onSchemeRequest?: (url: string) => boolean;
}

const SCHEME = 'slywrite-lite:';

/** 在文档尾部注入点击捕获脚本（与 preview.ts 的 MathJax 注入同样的字符串拼接手法） */
function instrumentHtml(html: string): string {
  const script = [
    '<script>',
    '(function(){',
    'document.addEventListener("click",function(e){',
    'var el=e.target;',
    'var a=el&&el.closest?el.closest("a"):null;',
    'if(!a)return;',
    'var href=a.getAttribute("href")||"";',
    `if(href.indexOf(${JSON.stringify(SCHEME)})===0){e.preventDefault();parent.postMessage({type:"slw-scheme",url:href},"*");return;}`,
    'if(/^https?:/i.test(href)){a.target="_blank";a.rel="noopener";}',
    '},true);',
    '})();',
    '</scr' + 'ipt>',
  ].join('\n');
  return html.includes('</body>') ? html.replace('</body>', `${script}\n</body>`) : `${html}${script}`;
}

export function HtmlPreview({ html, onSchemeRequest }: HtmlPreviewProps) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const handlerRef = useRef(onSchemeRequest);
  handlerRef.current = onSchemeRequest;

  const doc = useMemo(() => instrumentHtml(html), [html]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as { type?: unknown; url?: unknown };
      if (!data || data.type !== 'slw-scheme' || typeof data.url !== 'string') return;
      // 只接受来自本预览 iframe 的消息
      if (frameRef.current && ev.source !== frameRef.current.contentWindow) return;
      handlerRef.current?.(data.url);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <View style={s.container}>
      <iframe
        ref={frameRef}
        title="SlyWrite Lite 预览"
        srcDoc={doc}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        style={s.frame}
      />
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    frame: {
      flex: 1,
      width: '100%',
      height: '100%',
      borderWidth: 0,
      backgroundColor: COLORS.bg,
    } as object,
  });
