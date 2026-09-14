// SlyWrite Lite 桌面壳 — 预加载脚本。
// 只暴露两类能力，全部经主进程落地：
//   fs.invoke  : vault 文件操作（userData/vault 下真实文件），方法与渲染层 vault-fs.web.ts 一一对应
//   saveAs     : 系统「另存为」对话框
// 不暴露 Node、不暴露任意路径、没有任何网络/凭据能力。
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  fs: {
    invoke: (method, args) => ipcRenderer.invoke('slw:vault', String(method), args ?? {}),
  },
  saveAs: (payload) => ipcRenderer.invoke('slw:saveAs', payload ?? {}),
  version: 'desktop',
});
