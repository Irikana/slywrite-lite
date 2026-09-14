// 桌面端构建后处理：把 Expo Web 静态导出产物转成纯客户端渲染的 SPA。
// 背景：SDK 52 的 web.output=static 会为每个路由预渲染整棵应用树，并在 HTML 里注入
//   globalThis.__EXPO_ROUTER_HYDRATE__=true 让客户端 hydrateRoot 接管。
//   但本应用首屏依赖异步存储（AsyncStorage 主题 / 笔记列表），SSR 与客户端首帧必然不一致，
//   React 18 hydration 直接报错（#418/#425）。expo-router 没有提供关闭 static 渲染的开关，
//   且桌面壳不需要 SEO，因此在导出后把预渲染内容剥离：
//   1. 删除 __EXPO_ROUTER_HYDRATE__ 标记脚本（react-native-web 据此回退 createRoot 挂载）；
//   2. 清空 <div id="root"> 的预渲染子树。
// 用法：node scripts/strip-hydration.js [导出目录，默认 dist-web]
'use strict';
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(process.argv[2] || 'dist-web');
const ROOT_OPEN = '<div id="root">';
const MARKER = 'globalThis.__EXPO_ROUTER_HYDRATE__';

function stripFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html.length;

  // 1) 删除 hydrate 标记脚本（形如 <script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>）
  html = html.replace(/<script\b[^>]*>[^<]*__EXPO_ROUTER_HYDRATE__[^<]*<\/script>\s*/g, '');

  // 2) 清空 root 容器的预渲染子树：从 <div id="root"> 之后到与之配对的收尾 </div>
  //    收尾 </div> 以 body 内最后一个 </div>（紧跟入口 <script ... defer> 之前）为准，用位置计算避免正则回溯。
  const openIdx = html.indexOf(ROOT_OPEN);
  if (openIdx > -1) {
    const scriptIdx = html.indexOf('<script', openIdx);
    const searchEnd = scriptIdx > -1 ? scriptIdx : html.length;
    const closeIdx = html.lastIndexOf('</div>', searchEnd - 1);
    if (closeIdx > openIdx) {
      html = html.slice(0, openIdx + ROOT_OPEN.length) + html.slice(closeIdx);
    }
  }

  fs.writeFileSync(file, html);
  return before - html.length;
}

function walk(dir) {
  let count = 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      const sub = walk(p);
      count += sub.count;
      removed += sub.removed;
    } else if (name.endsWith('.html')) {
      removed += stripFile(p);
      count += 1;
    }
  }
  return { count, removed };
}

if (!fs.existsSync(distDir)) {
  console.error(`[strip-hydration] 目录不存在：${distDir}`);
  process.exit(1);
}
const { count, removed } = walk(distDir);
console.log(`[strip-hydration] 处理 ${count} 个 HTML，共剥离 ${(removed / 1024).toFixed(1)} kB 预渲染内容`);
