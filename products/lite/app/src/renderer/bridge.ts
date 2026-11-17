// The type of `window.lite`, the preload's bridge (electron/preload.cjs): read-only facts
// about the desktop shell, and (L08) opening a folder and reading its files, read only.
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
}

/** `Object.keys(window.lite)`, sorted. The preload exposes exactly these. */
export const BRIDGE_KEYS = ["desktop", "openFolder", "platform", "readFile", "versions"] as const;

declare global {
  interface Window {
    /** Present only in the Electron app. */
    lite?: LiteBridge;
  }
}
