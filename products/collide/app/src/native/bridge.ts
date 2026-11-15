// T14: the type of `window.collide`, the only thing the Electron preload
// (electron/preload.cjs) exposes to the page, and the IPC channel names behind it.
// T15: the snip, the overlay page and the settings warning use it.
// T16: markups (src/native/markups.ts in the main process, src/io/electronStore.ts in the page).

import type { LogicalRect } from "../snip/crop";
import type { CaptureInfo, CropInfo } from "../snip/flow";

/** Events between the editor and the overlay window (the names the Rust shell used). */
export const OVERLAY_EVENTS = [
  "collide:overlay-frame",
  "collide:overlay-ready",
  "collide:overlay-ping",
  "collide:overlay-frame-ack",
  "collide:overlay-result",
] as const;
export type OverlayEvent = (typeof OVERLAY_EVENTS)[number];

/** Request/reply channels (`ipcRenderer.invoke`), keyed by bridge method. */
export const INVOKE_CHANNELS = {
  captureMonitor: "collide:capture-monitor",
  cropCapture: "collide:crop-capture",
  hideEditor: "collide:hide-editor",
  showEditor: "collide:show-editor",
  showOverlay: "collide:show-overlay",
  hideOverlay: "collide:hide-overlay",
  copyImage: "collide:copy-image",
  settingsStatus: "collide:settings-status",
  "markups.save": "collide:markups-save",
  "markups.open": "collide:markups-open",
  "markups.pick": "collide:markups-pick",
  "markups.list": "collide:markups-list",
} as const;
export type InvokeMethod = keyof typeof INVOKE_CHANNELS;

/** One-way channels. */
export const OVERLAY_EVENT_CHANNEL = "collide:overlay-event";
export const SNIP_REQUEST_CHANNEL = "collide:snip-request";

/** What every invoke channel answers; the preload turns `ok: false` into a rejected promise with `error` as its message. */
export type IpcReply<T = unknown> = { ok: true; value: T } | { ok: false; error: string };

/** Where to put the overlay: the captured monitor, as `captureMonitor()` reported it (physical px). */
export interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Outcome of loading settings.json (same shape as the Rust `SettingsStatus`). */
export interface SettingsStatus {
  hotkey: string;
  /** Cause + fix text for a Toast, when the configured hotkey could not be used. */
  warning: string | null;
}

/** The three files of a markup folder, as they cross the bridge. */
export interface MarkupFiles {
  sourcePng: Uint8Array;
  /** annotations.json text. */
  annotations: string;
  exportPng: Uint8Array;
}

/** What opening a markup reads: `export.png` is written by Save and never read back. */
export type OpenedMarkupFiles = Omit<MarkupFiles, "exportPng">;

export interface CollideBridge {
  /** Capture the display under the cursor at full physical size; the main process holds the frame for the crop. */
  captureMonitor(): Promise<CaptureInfo>;
  /** Crop the held frame to `box` (logical px relative to the overlay) at `scale`. */
  cropCapture(box: LogicalRect, scale: number): Promise<CropInfo>;
  /** Hide the editor for a snip, leaving no ghost in the capture; resolves once the overlay window's page has loaded. */
  hideEditor(): Promise<void>;
  /** Put the editor back exactly where it was (position, size, maximized, opacity), show and focus it. */
  showEditor(): Promise<void>;
  /** Place the overlay on the captured display, then show and focus it. */
  showOverlay(bounds: OverlayBounds): Promise<void>;
  hideOverlay(): Promise<void>;
  /** Put a PNG data URL (`data:image/png;base64,...`) on the clipboard as an image. For when the web clipboard refuses. */
  copyImage(png: string): Promise<void>;
  /** The hotkey in use, and a warning when settings.json or the registration had a problem. */
  settingsStatus(): Promise<SettingsStatus | null>;
  /** Call `cb` when the global shortcut asks for a snip Returns the unsubscribe function. */
  onSnipRequest(cb: () => void): () => void;
  /** Markup folders under Documents/Collide/Markups. The main process refuses any path outside that folder. */
  markups: {
    /** Write the three files into `folderName` (one folder name) under Markups. Resolves with the folder's path. */
    save(folderName: string, files: MarkupFiles): Promise<string>;
    /** Read a markup folder inside Markups (a path from save, pick or list). */
    open(folder: string): Promise<OpenedMarkupFiles>;
    /** Show the folder dialog, starting in Markups. Null if cancelled; rejects for a folder outside Markups. */
    pick(): Promise<string | null>;
    /** The folders directly inside Markups (full paths). */
    list(): Promise<string[]>;
  };
  /** The overlay events: sent to every Collide window, the sender included (as the Rust shell's emit/listen did). */
  overlay: {
    emit(event: OverlayEvent, payload?: unknown): void;
    /** Returns the unsubscribe function. */
    on(event: OverlayEvent, cb: (payload: unknown) => void): () => void;
  };
}

/** `Object.keys(window.collide)`, sorted. The preload exposes exactly these. */
export const BRIDGE_KEYS = [
  "captureMonitor",
  "copyImage",
  "cropCapture",
  "hideEditor",
  "hideOverlay",
  "markups",
  "onSnipRequest",
  "overlay",
  "settingsStatus",
  "showEditor",
  "showOverlay",
] as const;

declare global {
  interface Window {
    /** Present only in the Electron shell. */
    collide?: CollideBridge;
  }
}
