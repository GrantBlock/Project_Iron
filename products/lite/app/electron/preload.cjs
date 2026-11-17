// Lite — preload (sandboxed, context-isolated). Exposes `window.lite` (typed in
// src/renderer/bridge.ts) and nothing else: no Node, no ipcRenderer in the page.
// A sandboxed preload can only require "electron"; src/native/preload.test.ts checks
// the keys against bridge.ts.
"use strict";

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld(
  "lite",
  Object.freeze({
    desktop: true,
    platform: process.platform,
    versions: Object.freeze({ electron: process.versions.electron, chrome: process.versions.chrome }),
  }),
);
