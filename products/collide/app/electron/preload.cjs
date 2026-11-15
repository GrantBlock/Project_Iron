// Collide — preload for the editor window (sandboxed, context-isolated).
// T13: `window.collide` exists but is empty. T14 fills it with the bridge
// listed in RUN2.md; nothing else is ever exposed to the page.
"use strict";

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("collide", {});
