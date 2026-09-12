// 预览渲染管线：Markdown → HTML 文档（供 HtmlPreview 的 WebView 展示）。
// 流程：双链先换成站内 <a>，marked 渲染，再后处理高亮 / 任务方框 / MathJax。
// 排版样式：优先用在线排版样式（AsyncStorage 缓存 24 小时），失败回退内置 FALLBACK_CSS。
// 本模块只读、静默降级，不报错阻塞；应用内另一处外部请求是更新检查（src/lib/releases.ts），同样只读。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { marked } from 'marked';
import type { NoteMeta } from './frontmatter';
import { resolveWikiLinks } from './links';
import { FALLBACK_CSS } from './fallback-style';

/** 站点样式表（公开只读，用于预览排版与网站观感一致） */
const SITE_CSS_URLS = [
  'https://irikana.github.io/css/style.css',
  'https://irikana.github.io/css/library-refit.css',
];

const CSS_CACHE_KEY = 'slywrite…-css';
const CSS_CACHE_TTL = 24 * 60 * 60 * 1000;
const CSS_FETCH_TIMEOUT = 8000;

/** MathJax 注入配置（与牧羊人图书馆站点规范一致） */
function mathjaxHead(): string {
  return [
    '<script>',
    "window.MathJax={tex:{inlineMath:[['$','$'],['\\\\(','\\\\)']],displayMath:[['$$','$$'],['\\\\[','\\\\]']]},svg:{fontCache:'global'}};",
    '</scr' + 'ipt>',
    '<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></scr' + 'ipt>',
  ].join('\n');
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('拉取站点样式超时')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * 拉取网站 CSS：命中 24 小时缓存直接用；网络失败或超时返回 null（调用方回退内置样式）。
 * 任何异常都不向外抛——预览绝不被网络问题打断。
 */
async function loadSiteCss(): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(CSS_CACHE_KEY);
    if (cached) {
      const obj = JSON.parse(cached) as { t?: number; css?: string };
      if (typeof obj.t === 'number' && typeof obj.css === 'string' && obj.css.length > 0) {
        if (Date.now() - obj.t < CSS_CACHE_TTL) return obj.css;
      }
    }
  } catch {
    // 缓存坏了不重要，继续走网络
  }
  try {
    const parts = await withTimeout(
      Promise.all(
        SITE_CSS_URLS.map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        }),
      ),
      CSS_FETCH_TIMEOUT,
    );
    const css = parts.join('\n');
    try {
      await AsyncStorage.setItem(CSS_CACHE_KEY, JSON.stringify({ t: Date.now(), css }));
    } catch {
      // 写缓存失败不影响本次使用
    }
    return css;
  } catch {
    return null;
  }
}

/** 把 pre/code 片段先藏起来，避免其中的 == 与 [ ] 被当成排版记号 */
function protectCode(html: string): { masked: string; restore: (s: string) => string } {
  const store: string[] = [];
  const masked = html.replace(/<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>/g, (block) => {
    store.push(block);
    return `\u0000CODE${store.length - 1}\u0000`;
  });
  return {
    masked,
    restore: (s: string) => s.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => store[Number(i)]),
  };
}

/** 后处理：==高亮== 与任务列表方框（纯 ASCII 方框，不用字体图标） */
function postProcessContent(html: string): string {
  const { masked, restore } = protectCode(html);
  let s = masked;
  // ==文本== → <mark>
  s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  // marked 的 GFM 复选框 → 文字方框 span（checked 与否分别成态）
  s = s.replace(/<input\b[^>]*type="checkbox"[^>]*>/gi, (tag) => {
    const done = /\bchecked\b/i.test(tag);
    return done
      ? '<span class="sl-task sl-task-done">[x]</span>'
      : '<span class="sl-task">[ ]</span>';
  });
  // 含任务方框的无序列表去掉默认圆点，改挂 task 类
  s = s.replace(/<ul([^>]*)>([\s\S]*?)<\/ul>/g, (full, attrs: string, inner: string) => {
    if (!inner.includes('sl-task')) return full;
    const cleaned = attrs.replace(/class="[^"]*"/g, '').trim();
    return `<ul${cleaned ? ` ${cleaned}` : ''} class="task">${inner}</ul>`;
  });
  s = s.replace(/<li([^>]*)>(\s*<span class="sl-task)/g, '<li$1 class="task-item">$2');
  return restore(s);
}

export interface RenderOptions {
  /** 当前是否深色（决定 body 上的 force-dark-mode / force-light-mode 类） */
  isDark: boolean;
  /** 是否尝试拉取网站 CSS（默认 true；关闭则只用内置样式） */
  useSiteCss?: boolean;
}

/**
 * 把笔记正文渲染成完整 HTML 文档。
 * @param body 笔记正文（不含 front-matter）
 * @param all 全部笔记元数据（解析双链指向用）
 */
export async function renderMarkdownToHtml(
  body: string,
  all: NoteMeta[],
  opts: RenderOptions,
): Promise<string> {
  const withLinks = resolveWikiLinks(body, all);
  const raw = marked.parse(withLinks, { gfm: true, breaks: true, async: false }) as string;
  const content = postProcessContent(raw);
  const siteCss = (opts.useSiteCss ?? true) ? await loadSiteCss() : null;
  const styleBlock = siteCss
    ? `<style>\n${FALLBACK_CSS}\n</style>\n<style>\n${siteCss}\n</style>`
    : `<style>\n${FALLBACK_CSS}\n</style>`;
  const bodyClass = opts.isDark ? 'force-dark-mode' : 'force-light-mode';
  const math = body.includes('$') ? `\n${mathjaxHead()}` : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    styleBlock,
    '</head>',
    `<body class="${bodyClass}">`,
    `<article class="content-main sl-measure">\n${content}\n</article>`,
    math,
    '</body>',
    '</html>',
  ].join('\n');
}
