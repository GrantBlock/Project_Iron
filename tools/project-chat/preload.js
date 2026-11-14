// Exposes only the connection-setup calls to public/connect.html.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pc', {
  get: () => ipcRenderer.invoke('pc:get'),
  test: url => ipcRenderer.invoke('pc:test', url),
  save: (mode, url) => ipcRenderer.invoke('pc:save', mode, url)
});
