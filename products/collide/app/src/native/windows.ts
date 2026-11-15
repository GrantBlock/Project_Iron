// T15: window choreography for a snip, ported from src-tauri/src/snip.rs. The JS
// orchestrator (`src/snip/flow.ts`) decides the order; this only moves windows.
// Electron's BrowserWindow is passed in (typed by the members used), so the moves
// are unit-tested with fake windows.

import type { OverlayBounds } from "./bridge";
import type { Frame } from "./capture";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The part of Electron's `BrowserWindow` the choreography uses. */
export interface WindowLike {
  isDestroyed(): boolean;
  getBounds(): Rect;
  setBounds(bounds: Rect): void;
  /** The un-maximized bounds. */
  getNormalBounds(): Rect;
  setPosition(x: number, y: number): void;
  isMaximized(): boolean;
  maximize(): void;
  unmaximize(): void;
  isMinimized(): boolean;
  restore(): void;
  getOpacity(): number;
  setOpacity(opacity: number): void;
  show(): void;
  hide(): void;
  focus(): void;
}

/** The overlay window plus a promise that settles once its page has loaded (or failed to). */
export interface OverlayHandle {
  window: WindowLike;
  loaded: Promise<void>;
}

export interface ChoreographyDeps {
  /** The editor window, or null once it is gone. */
  editor: () => WindowLike | null;
  /** The overlay window, created (hidden) on first use and again if it was destroyed. */
  overlay: () => OverlayHandle;
}

export interface Choreography {
  hideEditor(): Promise<void>;
  showEditor(): void;
  showOverlay(bounds: Rect): void;
  hideOverlay(): void;
}

/** Far outside any monitor (the coordinate Windows itself uses for minimized windows). */
export const OFF_SCREEN = { x: -32000, y: -32000 } as const;

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const missing = (label: string) => new Error(`The ${label} window is missing — restart Collide.`);
const failed = (what: string, e: unknown) => new Error(`Could not ${what} (${detailOf(e)}) — restart Collide and try again.`);

/** Where the editor was before a snip moved it off-screen, so `showEditor` can put it back exactly. */
interface Saved {
  bounds: Rect;
  normalBounds: Rect;
  maximized: boolean;
  opacity: number;
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function createChoreography(deps: ChoreographyDeps): Choreography {
  let saved: Saved | null = null;

  const editor = () => {
    const w = deps.editor();
    if (!w || w.isDestroyed()) throw missing("main");
    return w;
  };

  return {
    /**
     * Hide the editor without leaving a ghost in the capture. Windows fades a hidden
     * window out over ~200 ms (DWM animation), so the capture could catch it half-
     * transparent. Making it fully transparent and moving it off-screen are both
     * instant, so the fade happens where nothing can see it.
     */
    async hideEditor() {
      const w = editor();
      try {
        // A second hide before a show keeps the first, real, position.
        if (!saved) saved = { bounds: w.getBounds(), normalBounds: w.getNormalBounds(), maximized: w.isMaximized(), opacity: w.getOpacity() };
        w.setOpacity(0);
        w.setPosition(OFF_SCREEN.x, OFF_SCREEN.y);
      } catch {
        // Best effort, as in snip.rs: the hide below is what matters.
      }
      try {
        w.hide();
      } catch (e) {
        throw failed("hide the editor", e);
      }
      // Have the overlay's page loaded before the flow pings it. The Tauri shell
      // opened that window (hidden) at startup; here it is opened by the first snip.
      await deps.overlay().loaded;
    },

    showEditor() {
      const w = editor();
      const s = saved;
      saved = null;
      if (s) {
        try {
          if (s.maximized && !w.isMaximized()) {
            // The move took it out of the maximized state: put the normal bounds back, then maximize.
            w.setBounds(s.normalBounds);
            w.maximize();
          } else {
            if (!s.maximized && w.isMaximized()) w.unmaximize();
            w.setBounds(s.bounds);
          }
        } catch {
          // Best effort: a window in the wrong place is still better than none.
        }
      }
      try {
        if (w.isMinimized()) w.restore();
        w.show();
        if (s) w.setOpacity(s.opacity);
      } catch (e) {
        throw failed("show the editor", e);
      }
      try {
        w.focus();
      } catch (e) {
        throw failed("focus the editor", e);
      }
    },

    /** Size and place the overlay on the captured display (Electron's units, DIP), then show and focus it. */
    showOverlay(bounds: Rect) {
      const w = deps.overlay().window;
      if (w.isDestroyed()) throw missing("overlay");
      try {
        w.setBounds(bounds);
        // (A) Moving a window between displays with different scaling can leave it at the old display's size; a second set fixes it.
        if (!sameRect(w.getBounds(), bounds)) w.setBounds(bounds);
      } catch (e) {
        throw failed("position the overlay", e);
      }
      try {
        w.show();
      } catch (e) {
        throw failed("show the overlay", e);
      }
      try {
        w.focus();
      } catch (e) {
        throw failed("focus the overlay", e);
      }
    },

    hideOverlay() {
      const w = deps.overlay().window;
      if (w.isDestroyed()) throw missing("overlay");
      try {
        w.hide();
      } catch (e) {
        throw failed("hide the overlay", e);
      }
    },
  };
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Where the overlay goes, in Electron's units (DIP). The flow passes the captured
 * monitor in physical px, as `captureMonitor()` reported it. When that is the
 * held frame's monitor, the answer is the captured display's own bounds (exact at
 * any scaling and on any monitor); otherwise the request is scaled down.
 */
export function overlayBoundsFor(frame: Frame | null, requested: unknown): Rect {
  const r = (requested ?? {}) as Partial<OverlayBounds>;
  if (!isNumber(r.x) || !isNumber(r.y) || !isNumber(r.width) || !isNumber(r.height) || r.width <= 0 || r.height <= 0) {
    throw new Error("The overlay position is not valid — start a new snip.");
  }
  const m = frame?.monitor;
  if (m && frame.display && m.x === r.x && m.y === r.y && m.width === r.width && m.height === r.height) return { ...frame.display.bounds };
  const scale = m && m.scaleFactor > 0 ? m.scaleFactor : 1;
  return { x: Math.round(r.x / scale), y: Math.round(r.y / scale), width: Math.round(r.width / scale), height: Math.round(r.height / scale) };
}
