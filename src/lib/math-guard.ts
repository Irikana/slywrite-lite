// 数学公式保护：把 LaTeX 片段从 Markdown 源文本里摘成占位符，渲染完再放回。
// 为什么赶在 marked 之前：markdown 会把 `x_i` 的下划线读成斜体、把 `\` 读成转义，
// 且预览用 breaks:true 会把换行变成 <br>——编辑器「独立公式」按钮插入的正是
// $$\n公式\n$$，公式被拆进不同文本节点后 MathJax 再也配不上对，只会留下原始 LaTeX。
// 摘出来之后 ==高亮==、任务方框等后处理同样碰不到公式内部。
// 代码区不参与抽取（但必须原样留给 marked，否则渲染不出 <code>）：其中的 $ 不是公式；
// MathJax 默认也跳过 pre/code，双保险。

/** 占位记号用 Unicode 私用区字符：markdown 与后处理都不会碰，且几乎不可能出现在笔记正文里 */
const MATH_MARK = '\uE002';

/** 代码区：围栏（``` / ~~~）、行内反引号，以及四空格／制表符缩进的代码行。
 *  整条用一个捕获组包住：maskMath 靠 split 切分，只有捕获组命中的内容才会留在结果里
 *  （偶数下标＝正文，奇数下标＝代码段）；内部一律用 (?:) 免得打乱下标 */
const CODE_RE =
  /(^ {0,3}`{3,}[^\n]*\n[\s\S]*?^ {0,3}`{3,}[ \t]*$|^ {0,3}~{3,}[^\n]*\n[\s\S]*?^ {0,3}~{3,}[ \t]*$|`{3}[^`\n]+?`{3}|`{2}[^`\n]+?`{2}|`[^`\n]+?`|^(?:[ ]{4}|\t)[^\n]*$)/gm;

/**
 * 公式定界符与注入的 MathJax 配置一致：
 * $$…$$ 与 \[…\] 为独立公式，$…$ 与 \(…\) 为行内公式。
 * 顺序上先匹配成对的双 dollar / 方括号，避免独立公式被行内规则抢先切成两半。
 */
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

/** HTML 转义：公式里的 < > & 必须先变成实体，否则会被当成标签截断 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface MathMask {
  masked: string;
  /** 正文里是否真的有公式：决定要不要注入 MathJax（只出现 $ 符号的笔记不必去联网加载渲染器） */
  found: boolean;
  restore: (s: string) => string;
}

export function maskMath(src: string): MathMask {
  const store: string[] = [];
  let found = false;

  /** 只在非代码文本段内抽公式 */
  const within = (seg: string): string =>
    seg.replace(MATH_RE, (full, display, bracket, paren, inline, offset: number) => {
      // 前面紧跟反斜杠的是转义出来的美元符号（\$100），不是公式
      if (offset > 0 && seg[offset - 1] === '\\') return full;
      const block = display !== undefined || bracket !== undefined;
      const latex = display !== undefined ? display : bracket !== undefined ? bracket : paren !== undefined ? paren : inline;
      if (typeof latex !== 'string') return full;
      const inner = latex.trim();
      // 行内公式两侧留白（$ 价格 $）多半不是公式；空内容更不是
      if (!inner || (!block && /^\s|\s$/.test(latex))) return full;
      const text = escapeHtml(block ? `$$${inner}$$` : `$${inner}$`);
      const cls = block ? 'sl-math-block' : 'sl-math-inline';
      found = true;
      store.push(`<span class="${cls}">${text}</span>`);
      return `${MATH_MARK}${store.length - 1}${MATH_MARK}`;
    });

  // 代码段原样拼回交给 marked 渲染，只在其之外的文本里抽公式
  const masked = src
    .split(CODE_RE)
    .map((seg, i) => (i % 2 === 0 ? within(seg) : seg))
    .join('');

  return {
    masked,
    found,
    restore: (s: string) =>
      s.replace(new RegExp(`${MATH_MARK}(\\d+)${MATH_MARK}`, 'g'), (_m, i: string) => {
        const v = store[Number(i)];
        return typeof v === 'string' ? v : '';
      }),
  };
}
