'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetch: (url) => ipcRenderer.invoke('fetch', url),
});
