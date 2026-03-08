'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 外部リンクはデフォルトブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC: HTTP fetch（メインプロセスで直接実行するため CORS 制限なし）
ipcMain.handle('fetch', async (_event, url) => {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('無効な URL です'); }
  if (parsed.protocol !== 'https:') throw new Error('HTTPS のみ許可されています');

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.text();
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
