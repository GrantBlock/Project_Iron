// The type of `window.lite`, the preload's bridge (electron/preload.cjs). Read-only facts
// about the desktop shell; later tasks add calls (L08: Open folder) here and in the preload.
export interface LiteBridge {
  readonly desktop: true;
  readonly platform: string;
  readonly versions: { readonly electron: string; readonly chrome: string };
}

/** `Object.keys(window.lite)`, sorted. The preload exposes exactly these. */
export const BRIDGE_KEYS = ["desktop", "platform", "versions"] as const;

declare global {
  interface Window {
    /** Present only in the Electron app. */
    lite?: LiteBridge;
  }
}
