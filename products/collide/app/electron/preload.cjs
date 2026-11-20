// Collide — preload for every Collide window (sandboxed, context-isolated).
// Exposes `window.collide` (typed in src/native/bridge.ts) and nothing else:
// no Node, no ipcRenderer, no channel names in the page.
//
// A sandboxed preload can only require "electron", so the channel names are
// repeated here; src/native/preload.test.ts checks them against bridge.ts.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const OVERLAY_EVENT_CHANNEL = "collide:overlay-event";
const SNIP_REQUEST_CHANNEL = "collide:snip-request";
const UPDATE_STATUS_CHANNEL = "collide:update-status";
const OVERLAY_EVENTS = [
  "collide:overlay-frame",
  "collide:overlay-ready",
  "collide:overlay-ping",
  "collide:overlay-frame-ack",
  "collide:overlay-result",
];

/** Call the main process; a failure rejects with the main process's cause-and-fix message. */
async function call(channel, ...args) {
  const reply = await ipcRenderer.invoke(channel, ...args);
  if (!reply || reply.ok !== true) throw new Error(reply && typeof reply.error === "string" ? reply.error : "Collide's desktop shell did not answer — restart Collide.");
  return reply.value;
}

function overlayEvent(event) {
  if (!OVERLAY_EVENTS.includes(event)) throw new Error(`Unknown overlay event: ${String(event)}`);
  return event;
}

function subscribe(channel, listener) {
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("collide", {
  captureMonitor: () => call("collide:capture-monitor"),
  cropCapture: (box, scale) => call("collide:crop-capture", box, scale),
  hideEditor: () => call("collide:hide-editor"),
  prepareOverlay: () => call("collide:prepare-overlay"),
  showEditor: () => call("collide:show-editor"),
  showOverlay: (bounds) => call("collide:show-overlay", bounds),
  hideOverlay: () => call("collide:hide-overlay"),
  copyImage: (png) => call("collide:copy-image", png),
  settingsStatus: () => call("collide:settings-status"),
  collapse: (state) => call("collide:collapse", state),
  onSnipRequest: (cb) => subscribe(SNIP_REQUEST_CHANNEL, () => cb()),
  markups: {
    save: (folderName, files) => call("collide:markups-save", folderName, files),
    open: (folder) => call("collide:markups-open", folder),
    pick: () => call("collide:markups-pick"),
    list: () => call("collide:markups-list"),
    remove: (folder) => call("collide:markups-remove", folder),
  },
  collideFiles: {
    save: (name, bytes, replace) => call("collide:collide-files-save", name, bytes, replace),
    open: (file) => call("collide:collide-files-open", file),
    pick: () => call("collide:collide-files-pick"),
    openPdf: (file) => call("collide:collide-files-open-pdf", file),
    exportPdf: (name, bytes) => call("collide:collide-files-export-pdf", name, bytes),
  },
  updates: {
    status: () => call("collide:updates-status"),
    check: () => call("collide:updates-check"),
    install: () => call("collide:updates-install"),
    setAuto: (on) => call("collide:updates-set-auto", on),
    onStatus: (cb) => subscribe(UPDATE_STATUS_CHANNEL, (_e, status) => cb(status)),
  },
  storage: {
    info: () => call("collide:storage-info"),
    setKeep: (keep) => call("collide:storage-set-keep", keep),
    prune: (open) => call("collide:storage-prune", open),
  },
  overlay: {
    emit: (event, payload) => {
      ipcRenderer.send(OVERLAY_EVENT_CHANNEL, overlayEvent(event), payload);
    },
    on: (event, cb) => {
      overlayEvent(event);
      return subscribe(OVERLAY_EVENT_CHANNEL, (_e, name, payload) => {
        if (name === event) cb(payload);
      });
    },
  },
});
