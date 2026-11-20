// T31: the collapsed window (Grant 2026-11-15). T48 (Grant 2026-11-20): collapse is the compact view.
// Collapsing reduces the app to the sidebar's top block (brand row, New snip, Add snip, Open, New file). The desktop
// window becomes PANEL_WIDTH wide and exactly as tall as that block (the page measures it and sends its height),
// docked at the right edge of its screen, with or without a tab open. A maximized window is unmaximized first.
// Expanding restores the exact earlier bounds and maximizes again if it was maximized. A minimum size or a fixed size
// on the window is lifted while compact and put back on expand.
// Electron's BrowserWindow and screen are passed in, so this is unit-tested with a fake window.
// Window sizes, DPI and a second monitor on Windows are a manual check (TESTER-NOTES Run 4 item 7).
import type { Rect } from "./windows";

/** The Recents panel's width: `--side-w` in src/shell/shell.css. */
export const PANEL_WIDTH = 276;
/** (A) The smallest compact height in CSS px, whatever the page sends (ISSUES 57). */
export const COMPACT_MIN_HEIGHT = 120;
/** (A) The compact height when the page sends none (ISSUES 57). */
const DEFAULT_HEIGHT = 260;

/** The part of Electron's BrowserWindow the compact view uses. */
export interface CollapseWindow {
  isDestroyed(): boolean;
  getBounds(): Rect;
  setBounds(bounds: Rect): void;
  /** The page's area inside the native frame. */
  getContentBounds(): Rect;
  /** The un-maximized bounds. */
  getNormalBounds(): Rect;
  isMaximized(): boolean;
  maximize(): void;
  unmaximize(): void;
  getMinimumSize(): number[];
  setMinimumSize(width: number, height: number): void;
  isResizable(): boolean;
  setResizable(resizable: boolean): void;
}

export interface CollapseDeps {
  /** The editor window, or null once it is gone. */
  editor: () => CollapseWindow | null;
  /** The usable area of the screen a window with these bounds is on (main process: `screen.getDisplayMatching(b).workArea`). */
  workArea: (bounds: Rect) => Rect;
  /** The page's zoom factor (CSS px to screen DIP). Default 1. */
  zoom?: () => number;
}

export interface CollapseReply {
  /** True when the window is maximized (after the request). */
  maximized: boolean;
}

const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Saved {
  bounds: Rect;
  maximized: boolean;
  minimum: [number, number];
  resizable: boolean;
}

export function createCollapse(deps: CollapseDeps) {
  /** The window as it was before it became compact. */
  let saved: Saved | null = null;

  /** setBounds, allowing a size below the window's minimum and on a fixed-size window. */
  const place = (w: CollapseWindow, b: Rect) => {
    if (same(w.getBounds(), b)) return;
    const fixed = !w.isResizable();
    if (fixed) w.setResizable(true);
    w.setBounds(b);
    if (fixed) w.setResizable(false);
  };

  return {
    /** `request` comes from the page: { collapsed, height } (height: the compact block in CSS px). Anything else changes nothing. */
    apply(request: unknown): CollapseReply {
      const w = deps.editor();
      if (!w || w.isDestroyed()) return { maximized: false };
      const r = (typeof request === "object" && request !== null ? request : {}) as { collapsed?: unknown; height?: unknown };
      if (r.collapsed === true) {
        if (!saved) {
          const maximized = w.isMaximized();
          const [mw = 0, mh = 0] = w.getMinimumSize();
          saved = { bounds: maximized ? w.getNormalBounds() : w.getBounds(), maximized, minimum: [mw, mh], resizable: w.isResizable() };
          if (maximized) w.unmaximize();
          if (mw > 0 || mh > 0) w.setMinimumSize(0, 0);
        } else if (w.isMaximized()) {
          w.unmaximize();
        }
        const now = w.getBounds();
        const content = w.getContentBounds();
        const frameW = Math.max(0, now.width - content.width);
        const frameH = Math.max(0, now.height - content.height);
        const zoom = deps.zoom?.() || 1;
        const area = deps.workArea(now);
        const asked = typeof r.height === "number" && Number.isFinite(r.height) ? r.height : DEFAULT_HEIGHT;
        const width = Math.round(PANEL_WIDTH * zoom) + frameW;
        const height = Math.min(area.height, Math.round(Math.max(COMPACT_MIN_HEIGHT, asked) * zoom) + frameH);
        const y = clamp(now.y, area.y, area.y + area.height - height);
        place(w, { x: area.x + area.width - width, y, width, height });
      } else if (r.collapsed === false && saved) {
        const back = saved;
        saved = null;
        if (back.minimum[0] > 0 || back.minimum[1] > 0) w.setMinimumSize(back.minimum[0], back.minimum[1]);
        place(w, back.bounds);
        if (back.resizable !== w.isResizable()) w.setResizable(back.resizable);
        if (back.maximized) w.maximize();
      }
      return { maximized: w.isMaximized() };
    },
  };
}
