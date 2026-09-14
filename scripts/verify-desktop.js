// 桌面端冒烟验证脚本（回归工具）：无头启动壳，断言关键路由渲染、预览 iframe 与 sandbox 隔离。
// 用法：npm run verify:desktop（需先有 dist-web，即 npm run build:web）
// 断言失败时以非零退出码结束，可直接用于 CI。
// 注意：这是开发与验证专用工具，不参与打包运行链路。
'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');

app.setName('SlyWrite Lite');
protocol.registerSchemesAsPrivileged([
  { scheme: 'slite', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const DIST_DIR = path.join(__dirname, '..', 'dist-web');

function resolveDist(urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  const direct = path.resolve(DIST_DIR, rel);
  if (!direct.startsWith(path.resolve(DIST_DIR))) return null;
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const withHtml = `${direct}.html`;
  if (fs.existsSync(withHtml)) return withHtml;
  return path.join(DIST_DIR, 'index.html');
}

async function probe(win, url) {
  await win.loadURL(url);
  await new Promise((r) => setTimeout(r, 3500));
  const info = await win.webContents.executeJavaScript(`({
    pathname: location.pathname,
    text: (document.getElementById('root')||{}).innerText || '(empty)',
    iframes: document.querySelectorAll('iframe').length,
    rootChildren: (document.getElementById('root')||{children:{length:0}}).children.length
  })`);
  console.log(`URL ${url} -> pathname=${info.pathname} rootChildren=${info.rootChildren} iframes=${info.iframes}`);
  console.log('  text head:', JSON.stringify(info.text.slice(0, 140)));
  return info;
}

/** 笔记页：切到预览 tab，断言 iframe 渲染。
 * 生产 sandbox 不放开 same-origin（安全边界），宿主读不到 contentDocument，
 * 因此断言 srcdoc 属性内容 + 注入脚本存在；消息转发由注入脚本本身保证。 */
async function probePreview(win, url) {
  await win.loadURL(url);
  await new Promise((r) => setTimeout(r, 3500));
  const clicked = await win.webContents.executeJavaScript(`(async () => {
    const nodes = [...document.querySelectorAll('div')].filter(d => d.textContent.trim() === '预览' && d.childElementCount === 0);
    if (!nodes.length) return { ok: false, why: 'no preview tab' };
    nodes[0].click();
    await new Promise(r => setTimeout(r, 2500));
    const f = document.querySelector('iframe');
    if (!f) return { ok: false, why: 'no iframe after tab click' };
    const srcdoc = f.getAttribute('srcdoc') || '';
    return {
      ok: true,
      sandbox: f.getAttribute('sandbox'),
      hasContent: srcdoc.includes('双链目标') && srcdoc.includes('用于校验预览'),
      hasWikiLink: srcdoc.includes('slywrite-lite%3A%2F%2F') || srcdoc.includes('slywrite-lite://'),
      hasInterceptor: srcdoc.includes('slw-scheme'),
      srcdocLen: srcdoc.length
    };
  })()`);
  console.log('PROBE preview:', JSON.stringify(clicked).slice(0, 300));
  return clicked;
}


app.whenReady().then(async () => {
  protocol.handle('slite', async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/index.html') return new Response(null, { status: 302, headers: { Location: '/' } });
    const file = resolveDist(url.pathname);
    return net.fetch(pathToFileURL(file).toString());
  });

  // 最小 vault IPC（与 desktop/main.js 同一语义，仅够验证路径读写）
  const VAULT = () => path.join(app.getPath('userData'), 'vault');
  const safe = (rel) => {
    const parts = String(rel).split('/').filter(Boolean);
    if (parts.includes('..')) throw new Error('越界');
    return path.resolve(VAULT(), ...parts);
  };
  ipcMain.handle('slw:vault', async (_e, method, args) => {
    try {
      let value = null;
      if (method === 'ensureDir') await fsp.mkdir(safe(args.path), { recursive: true });
      else if (method === 'list') { try { value = await fsp.readdir(safe(args.path)); } catch { value = []; } }
      else if (method === 'readText') value = await fsp.readFile(safe(args.path), 'utf8');
      else if (method === 'writeText') { await fsp.mkdir(path.dirname(safe(args.path)), { recursive: true }); await fsp.writeFile(safe(args.path), args.text, 'utf8'); }
      else if (method === 'move') { await fsp.mkdir(path.dirname(safe(args.to)), { recursive: true }); await fsp.rename(safe(args.from), safe(args.to)); }
      else if (method === 'remove') await fsp.rm(safe(args.path), { force: !!args.idempotent });
      else if (method === 'stat') { try { const st = await fsp.stat(safe(args.path)); value = { exists: true, size: st.size, mtimeMs: Math.round(st.mtimeMs) }; } catch { value = { exists: false, size: 0, mtimeMs: 0 }; } }
      else throw new Error('未知方法 ' + method);
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
  ipcMain.handle('slw:saveAs', async () => false);

  // 种子笔记：一篇正文含 [[双链目标]] 指向（预览渲染与 scheme 拦截断言用），验证后清理
  const vault = path.join(app.getPath('userData'), 'vault', 'notes');
  fs.mkdirSync(vault, { recursive: true });
  const seedName = 'zz-desktop-verify.md';
  const seedPath = path.join(vault, seedName);
  const hadSeed = fs.existsSync(seedPath);
  if (!hadSeed) {
    fs.writeFileSync(
      seedPath,
      `---\ntitle: 验证页\nstatus: draft\n---\n\n这里引用 [[双链目标]]，用于校验预览 iframe 与 scheme 拦截。\n`,
      'utf8',
    );
  }

  // 带正式壳同款 preload，让渲染层走桌面 IPC 后端（而非 localStorage 回退）
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, preload: path.join(__dirname, '..', 'desktop', 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  const results = [];
  results.push(await probe(win, 'slite://bundle/'));
  results.push(await probe(win, 'slite://bundle/settings'));
  results.push(await probe(win, 'slite://bundle/updates'));
  const preview = await probePreview(win, `slite://bundle/note?file=${encodeURIComponent(seedName)}`);

  if (!hadSeed) fs.rmSync(seedPath, { force: true });

  const notFound = results.filter((r) => r.text.includes('不存在') || r.pathname.includes('not-found'));
  const okRoutes = notFound.length === 0;
  const okPreview = preview.ok && preview.hasContent && preview.hasWikiLink && preview.hasInterceptor
    && String(preview.sandbox || '').includes('allow-scripts') && !String(preview.sandbox || '').includes('allow-same-origin');
  console.log(okRoutes ? 'PASS: 路由渲染正常' : 'FAIL: 命中 not-found');
  console.log(okPreview ? 'PASS: 预览 iframe 渲染 + 双链/拦截脚本注入 + sandbox 隔离' : `FAIL: 预览异常 ${JSON.stringify(preview)}`);
  win.destroy();
  app.exit(okRoutes && okPreview ? 0 : 1);
});
