// Lite — preload (sandboxed, context-isolated). Exposes `window.lite` (typed in
// src/renderer/bridge.ts) and nothing else: no Node, no ipcRenderer in the page.
// A sandboxed preload can only require "electron"; src/native/preload.test.ts checks
// the keys against bridge.ts. L08 adds two narrow calls: open a folder (the system dialog)
// and read one of its files; the main process checks every path (src/native/folder.ts).
// L10 (frameless window): the drawn window buttons' three actions, and the maximized state
// (the main process sends it on load and on every change; the last value is kept here).
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

let maximized = false;
const maximizedListeners = new Set();
ipcRenderer.on("lite:maximized", (_event, value) => {
  maximized = value === true;
  for (const listener of maximizedListeners) listener(maximized);
});

contextBridge.exposeInMainWorld(
  "lite",
  Object.freeze({
    desktop: true,
    platform: process.platform,
    versions: Object.freeze({ electron: process.versions.electron, chrome: process.versions.chrome }),
    openFolder: () => ipcRenderer.invoke("lite:open-folder"),
    readFile: (path) => ipcRenderer.invoke("lite:read-file", String(path)),
    minimize: () => ipcRenderer.send("lite:window", "minimize"),
    toggleMaximize: () => ipcRenderer.send("lite:window", "toggle-maximize"),
    close: () => ipcRenderer.send("lite:window", "close"),
    onMaximizedChange: (listener) => {
      if (typeof listener !== "function") return () => undefined;
      const call = (value) => listener(value);
      maximizedListeners.add(call);
      call(maximized);
      return () => maximizedListeners.delete(call);
    },
  }),
);
