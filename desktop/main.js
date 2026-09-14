// SlyWrite Lite 桌面壳 — Electron 主进程。
// 职责刻意收窄：渲染内容 = Expo Web 静态导出产物（dist-web/），
// 本进程只提供窗口、静态资源协议与「vault 文件读写 / 另存为」两项 IPC，
// 不引入任何凭据、不做任何远端写入（与 slywrite-lite/AGENTS.md 的硬约束一致）。
// 笔记数据落在 userData/vault/ 下，是真实的 .md / .json 文件，
// 与 Android/iOS 端「应用私有目录里的真实文件」语义一致。
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } = require('electron');
const { pathToFileURL } = require('node:url');

// 渲染层 vault-fs.web.ts 使用的私有协议；standard 让 history/pushState 与相对资源解析正常
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'slite',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// 与打包后 productName 保持一致的数据目录名：开发模式（electron desktop）与安装版共用同一 userData，
// 避免「开发时导出的备份安装版找不到」这类分裂
app.setName('SlyWrite Lite');

const DIST_DIR = path.join(__dirname, '..', 'dist-web');

/** userData 需在 setName 之后取；开发（electron desktop）与打包（portable/nsis）路径一致 */
function vaultRoot() {
  return path.join(app.getPath('userData'), 'vault');
}

/** 把 URL 路径解析为 dist-web 内的真实文件；未知路径回退 index.html（History API 路由） */
function resolveDist(urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  const root = path.resolve(DIST_DIR);
  const direct = path.resolve(root, rel);
  if (!direct.startsWith(root)) return null; // 拒绝越界
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const withHtml = `${direct}.html`; // 静态导出把每个路由写成 <route>.html
  if (withHtml.startsWith(root) && fs.existsSync(withHtml)) return withHtml;
  const fallback = path.join(root, 'index.html');
  return fs.existsSync(fallback) ? fallback : null;
}

// ---------- vault IPC：虚拟相对路径 ↔ userData/vault 下的真实文件 ----------

/** 虚拟路径安全解析：拒绝越界与非法字符 */
function vaultPath(rel) {
  if (typeof rel !== 'string' || rel === '' || rel.includes('\0')) {
    throw new Error('非法的仓库路径');
  }
  const parts = rel.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.some((p) => p === '..')) throw new Error('仓库路径越界');
  const root = path.resolve(vaultRoot());
  const full = path.resolve(root, ...parts);
  if (!full.startsWith(root)) throw new Error('仓库路径越界');
  return full;
}

function statOrNull(err) {
  return err && err.code === 'ENOENT';
}

const vaultHandlers = {
  async ensureDir({ path: rel }) {
    await fsp.mkdir(vaultPath(rel), { recursive: true });
    return null;
  },
  async list({ path: rel }) {
    try {
      return await fsp.readdir(vaultPath(rel));
    } catch (e) {
      if (statOrNull(e)) return []; // 目录尚不存在：空列表，调用方会先 ensureRoot
      throw e;
    }
  },
  async readText({ path: rel }) {
    try {
      return await fsp.readFile(vaultPath(rel), 'utf8');
    } catch (e) {
      if (statOrNull(e)) throw new Error(`文件不存在：${rel}`);
      throw e;
    }
  },
  async writeText({ path: rel, text }) {
    const full = vaultPath(rel);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    // 原子写：先写临时文件再改名，避免半截文件
    const tmp = `${full}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, text, 'utf8');
    await fsp.rename(tmp, full);
    return null;
  },
  async move({ from, to }) {
    const src = vaultPath(from);
    const dst = vaultPath(to);
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
    return null;
  },
  async remove({ path: rel, idempotent }) {
    try {
      await fsp.rm(vaultPath(rel), { recursive: true, force: false });
    } catch (e) {
      if (statOrNull(e) && idempotent) return null;
      if (statOrNull(e)) throw new Error(`文件不存在：${rel}`);
      throw e;
    }
    return null;
  },
  async stat({ path: rel }) {
    try {
      const st = await fsp.stat(vaultPath(rel));
      return {
        exists: true,
        size: st.isFile() ? st.size : 0,
        mtimeMs: Math.round(st.mtimeMs),
      };
    } catch (e) {
      if (statOrNull(e)) return { exists: false, size: 0, mtimeMs: 0 };
      throw e;
    }
  },
};

// fs.rm 对不存在路径 force:false 抛 ENOENT，统一翻译
function translateVaultError(e) {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

// ---------- 窗口 ----------

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    title: 'SlyWrite Lite',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload 只使用 contextBridge + ipcRenderer，不需要 Node；此值维持默认桥接可用
    },
  });

  // 外部链接（发布页、下载页）一律交给系统浏览器，不在壳内开新窗
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.loadURL('slite://bundle/');
  return win;
}

// ---------- 应用生命周期 ----------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    fs.mkdirSync(vaultRoot(), { recursive: true });

    protocol.handle('slite', async (request) => {
      const url = new URL(request.url);
      // 根文档必须以 / 作为地址栏路径：expo-router 按 location.pathname 解析路由，
      // 若直接以 /index.html 加载会先命中 +not-found 再回跳（首屏闪一次「页面不存在」）。
      if (url.pathname === '/index.html') {
        return new Response(null, { status: 302, headers: { Location: '/' } });
      }
      const file = resolveDist(url.pathname === '/' ? '/index.html' : url.pathname);
      if (!file) return new Response('Not Found', { status: 404 });
      // net.fetch(file://) 以文件流应答并自动推断 MIME，支持 Range 请求
      return net.fetch(pathToFileURL(file).toString());
    });

    ipcMain.handle('slw:vault', async (_evt, method, args) => {
      const handler = vaultHandlers[method];
      if (!handler) return { ok: false, error: `未知的存储操作：${method}` };
      try {
        return { ok: true, value: await handler(args || {}) };
      } catch (e) {
        return { ok: false, error: translateVaultError(e) };
      }
    });

    ipcMain.handle('slw:saveAs', async (evt, payload) => {
      const { fileName, contents } = payload || {};
      if (typeof fileName !== 'string' || typeof contents !== 'string') {
        return false;
      }
      const win = BrowserWindow.fromWebContents(evt.sender);
      const safeName = path.basename(fileName).replace(/[^\w.\- ]+/g, '-');
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '另存为',
        defaultPath: safeName,
      });
      if (canceled || !filePath) return false;
      await fsp.writeFile(filePath, contents, 'utf8');
      return true;
    });

    const win = createWindow();
    win.on('closed', () => {
      if (BrowserWindow.getAllWindows().length === 0 && process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
