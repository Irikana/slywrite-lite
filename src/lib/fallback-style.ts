// 预览内置回退排版样式（网站 CSS 拉取失败时使用）。
// 写成 TS 模板字符串常量而不是 .css 资源：免打包配置、免异步加载，行为最稳。
// 要求：朴素的中文阅读排版；明暗两套（body.force-dark-mode / body.force-light-mode）；全部直角（border-radius 0）。

export const FALLBACK_CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; border-radius: 0 !important; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif, "SimSun", "Songti SC", serif;
  font-size: 17px;
  line-height: 1.8;
  letter-spacing: 0.01em;
  background: #ffffff;
  color: #1a1a1a;
}
body.force-dark-mode {
  background: #1c1f24;
  color: #e8eaed;
}
.content-main {
  padding: 20px 16px 80px;
}
.sl-measure {
  max-width: 42em;
  margin: 0 auto;
}
h1, h2, h3, h4, h5, h6 {
  line-height: 1.4;
  margin: 1.6em 0 0.6em;
  font-weight: 700;
}
h1 { font-size: 1.7em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }
h2 { font-size: 1.45em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
h5, h6 { font-size: 1em; color: #555555; }
body.force-dark-mode h1 { border-bottom-color: #2e333a; }
body.force-dark-mode h5, body.force-dark-mode h6 { color: #b0b6bf; }
p { margin: 0 0 1em; }
a { color: #2980b9; text-decoration: none; border-bottom: 1px solid rgba(41,128,185,0.35); }
body.force-dark-mode a { color: #7fb3e0; border-bottom-color: rgba(127,179,224,0.35); }
.sl-wiki-missing { color: #999999; border-bottom-style: dashed; }
strong { font-weight: 700; }
em { font-style: italic; }
del { color: #888888; }
mark {
  background: #fff3b0;
  color: #1a1a1a;
  padding: 0 0.15em;
}
body.force-dark-mode mark { background: #5a5320; color: #f0e6b8; }
blockquote {
  margin: 1em 0;
  padding: 0.4em 1em;
  border-left: 3px solid #5d9ccc;
  background: #f5f8fb;
  color: #40505e;
}
body.force-dark-mode blockquote {
  border-left-color: #5d9ccc;
  background: #21262d;
  color: #b8c2cc;
}
ul, ol { padding-left: 1.6em; margin: 0 0 1em; }
li { margin: 0.25em 0; }
ul.task { list-style: none; padding-left: 0.4em; }
li.task-item { display: flex; align-items: baseline; gap: 0.4em; }
.sl-task {
  display: inline-block;
  min-width: 1.5em;
  text-align: center;
  font-family: monospace;
  font-size: 0.9em;
  color: #5d9ccc;
  border: 1px solid #cfd8e0;
  background: #ffffff;
  padding: 0 0.2em;
}
.sl-task-done { color: #27ae60; border-color: #a8d4b8; }
body.force-dark-mode .sl-task { background: #16181c; border-color: #3a4048; color: #7fb3e0; }
body.force-dark-mode .sl-task-done { color: #58c98c; border-color: #2f5d43; }
code {
  font-family: "Cascadia Mono", Consolas, Menlo, monospace;
  font-size: 0.88em;
  background: #f2f3f5;
  color: #b03a5b;
  padding: 0.1em 0.35em;
}
body.force-dark-mode code { background: #262b33; color: #e8a2b8; }
pre {
  margin: 1em 0;
  padding: 12px 14px;
  background: #f6f7f8;
  border: 1px solid #e0e0e0;
  overflow-x: auto;
  line-height: 1.6;
}
pre code { background: transparent; color: inherit; padding: 0; font-size: 0.86em; }
body.force-dark-mode pre { background: #16181c; border-color: #2e333a; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  font-size: 0.95em;
  display: block;
  overflow-x: auto;
}
th, td {
  border: 1px solid #d5d9de;
  padding: 0.45em 0.7em;
  text-align: left;
  vertical-align: top;
}
th { background: #f0f2f4; font-weight: 700; }
body.force-dark-mode th, body.force-dark-mode td { border-color: #3a4048; }
body.force-dark-mode th { background: #21252b; }
hr {
  border: none;
  border-top: 1px solid #dcdcdc;
  margin: 2em 0;
}
body.force-dark-mode hr { border-top-color: #3a4048; }
img { max-width: 100%; height: auto; }
mjx-container { overflow-x: auto; overflow-y: hidden; }
mjx-container[display="true"] { margin: 1em 0; }
`;
