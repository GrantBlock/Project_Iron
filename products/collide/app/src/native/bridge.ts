// T14: the type of `window.collide`, the only thing the Electron preload
// (electron/preload.cjs) exposes to the page, and the IPC channel names behind it.
// T15: the snip, the overlay page and the settings warning use it.
// T16: markups (src/native/markups.ts in the main process, src/io/electronStore.ts in the page).
// RUN3 T35: Collide files (src/native/collideFiles.ts in the main process, src/io/collideFile.ts packs them).
// RUN3 T36: storage (src/native/storage.ts): the folder's size and item count, and keep the newest N.

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
  collapse: "collide:collapse",
  "markups.save": "collide:markups-save",
  "markups.open": "collide:markups-open",
  "markups.pick": "collide:markups-pick",
  "markups.list": "collide:markups-list",
  "markups.remove": "collide:markups-remove",
  "collideFiles.save": "collide:collide-files-save",
  "collideFiles.open": "collide:collide-files-open",
  "collideFiles.pick": "collide:collide-files-pick",
  "collideFiles.openPdf": "collide:collide-files-open-pdf",
  "collideFiles.exportPdf": "collide:collide-files-export-pdf",
  "storage.info": "collide:storage-info",
  "storage.setKeep": "collide:storage-set-keep",
  "storage.prune": "collide:storage-prune",
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

/** RUN3 T36: what Settings → Storage shows (src/native/storage.ts). */
export interface StorageInfo {
  /** The storage folder's path. */
  folder: string;
  /** Saved snips (markup folders) and Collide files in it. */
  items: number;
  bytes: number;
  /** Keep the newest this many; null = off, every item is kept. */
  keep: number | null;
}

/** The three files of a markup folder, as they cross the bridge. */
export interface MarkupFiles {
  sourcePng: Uint8Array;
  /** annotations.json text. */
  annotations: string;
  exportPng: Uint8Array;
  /** RUN3 T33: added images, `image-<n>.png` beside source.png. Open reads the ones annotations.json lists. */
  images?: MarkupImageFile[];
}

/** One added image's file (RUN3 T33). */
export interface MarkupImageFile {
  name: string;
  png: Uint8Array;
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
  /**
   * T31: fit the window to the collapsed layout. Windowed and collapsed with nothing open (`canvas` false), it shrinks to
   * the Recents panel at the right of its screen; otherwise it gets its size back. Says whether the window is maximized.
   */
  collapse(state: { collapsed: boolean; canvas: boolean }): Promise<{ maximized: boolean }>;
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
    /** Delete a markup folder inside Markups for good (its three files, then the folder). Recents asks first. */
    remove(folder: string): Promise<void>;
  };
  /**
   * RUN3 T35: Collide files (`.collide`), in Documents/Collide/Markups beside the markup folders (A). Only bytes cross:
   * the page packs and checks the package. The main process refuses any path outside that folder.
   */
  collideFiles: {
    /** Write the package as `name` (a file name ending in .collide). Without `replace`, a taken name gets `-2`, `-3`, ... Resolves with the path. */
    save(name: string, bytes: Uint8Array, replace: boolean): Promise<string>;
    /** Read a Collide file inside Markups. */
    open(file: string): Promise<Uint8Array>;
    /** The Open dialog (sidebar Open): a PDF (RUN3 T38, any folder), a .collide file, or a saved markup (its folder or its annotations.json). Null if cancelled. */
    pick(): Promise<{ kind: "collide"; file: string } | { kind: "markup"; folder: string } | { kind: "pdf"; file: string } | null>;
    /** RUN3 T38: read a PDF that Open picked this run, or one inside Markups; any other path is refused. */
    openPdf(file: string): Promise<Uint8Array>;
    /** RUN3 T38: write an exported PDF as `name` (ending in .pdf) in Markups; a taken name gets `-2`, ... Resolves with the path. */
    exportPdf(name: string, bytes: Uint8Array): Promise<string>;
  };
  /**
   * RUN3 T36: storage on the server PC (Server mode): the folder that holds the saved snips and Collide files, its size
   * and item count, and "keep the newest N" (off until set). The main process keeps the setting and deletes.
   */
  storage: {
    info(): Promise<StorageInfo>;
    /** A whole number from 1, or null for off (keep every file). Deletes nothing by itself. */
    setKeep(keep: number | null): Promise<StorageInfo>;
    /** After a save: delete the oldest items beyond N, never the open ones (names or paths of the items open in tabs). */
    prune(open: string[]): Promise<{ deleted: string[]; info: StorageInfo }>;
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
  "collapse",
  "collideFiles",
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
  "storage",
] as const;

declare global {
  interface Window {
    /** Present only in the Electron shell. */
    collide?: CollideBridge;
  }
}
