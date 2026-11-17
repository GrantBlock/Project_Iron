// Lite — preload (sandboxed, context-isolated). Exposes `window.lite` (typed in
// src/renderer/bridge.ts) and nothing else: no Node, no ipcRenderer in the page.
// A sandboxed preload can only require "electron"; src/native/preload.test.ts checks
// the keys against bridge.ts. L08 adds two narrow calls: open a folder (the system dialog)
// and read one of its files; the main process checks every path (src/native/folder.ts).
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "lite",
  Object.freeze({
    desktop: true,
    platform: process.platform,
    versions: Object.freeze({ electron: process.versions.electron, chrome: process.versions.chrome }),
    openFolder: () => ipcRenderer.invoke("lite:open-folder"),
    readFile: (path) => ipcRenderer.invoke("lite:read-file", String(path)),
  }),
);
