// The type of `window.lite`, the preload's bridge (electron/preload.cjs): read-only facts
// about the desktop shell, (L08) opening a folder and reading its files, read only, and (L10) the
// frameless window's drawn buttons.
import type { FolderListing } from "../native/folder";

export type { FolderEntry, FolderListing, FileKind } from "../native/folder";

export interface LiteBridge {
  readonly desktop: true;
  readonly platform: string;
  readonly versions: { readonly electron: string; readonly chrome: string };
  /** Shows the system folder dialog; resolves to the folder's listing, or null if cancelled. */
  openFolder(): Promise<FolderListing | null>;
  /** Reads a file of the opened folder by its relative path. The main process checks the path. */
  readFile(path: string): Promise<Uint8Array>;
  /** The title bar's drawn window buttons (the window is frameless). */
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  /** Calls `listener` with the maximized state now and on every change; returns an unsubscribe. */
  onMaximizedChange(listener: (maximized: boolean) => void): () => void;
}

/** The window buttons' part of the bridge. */
export type WindowControls = Pick<LiteBridge, "minimize" | "toggleMaximize" | "close" | "onMaximizedChange">;

/** `Object.keys(window.lite)`, sorted. The preload exposes exactly these. */
export const BRIDGE_KEYS = ["close", "desktop", "minimize", "onMaximizedChange", "openFolder", "platform", "readFile", "toggleMaximize", "versions"] as const;

declare global {
  interface Window {
    /** Present only in the Electron app. */
    lite?: LiteBridge;
  }
}
