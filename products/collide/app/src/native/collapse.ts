// T31, replaced by T48 (Grant 2026-11-20): the collapse button makes the compact view. The page sends
// { collapsed, height }: height is the compact block (brand row + the five controls) measured in CSS px.
// Collapsing unmaximizes the window (remembered), lifts any minimum size, and makes the page area exactly PANEL_WIDTH
// wide and `height` tall, docked at the right edge of the work area of its screen, y kept but inside the work area.
// While compact, a new height (a pill appears) resizes it. Expanding restores the minimum size (T50: the full view's
// MIN_WIDTH x MIN_HEIGHT content size from minSize.ts when main.cjs passes `minimum`), the exact earlier
// bounds, and maximizes again if it was maximized.
// Electron's BrowserWindow and screen are passed in, so this is unit-tested with a fake window.
// Window sizes, DPI and a second monitor on Windows are a manual check (TESTER-NOTES Run 4 item 7).
import type { Rect, WindowLike } from "./windows";

/** The panel's width: `--side-w` in src/shell/shell.css. */
export const PANEL_WIDTH = 276;

type CollapseWindow = Pick<WindowLike, "isDestroyed" | "getBounds" | "setBounds" | "getNormalBounds" | "isMaximized" | "maximize" | "unmaximize"> & {
  /** The page area (the window without its native frame). */
  getContentBounds(): Rect;
  getMinimumSize(): number[];
  setMinimumSize(width: number, height: number): void;
};

export interface CollapseDeps {
  /** The editor window, or null once it is gone. */
  editor: () => CollapseWindow | null;
  /** The usable area of the screen a window with these bounds is on (main process: `screen.getDisplayMatching(b).workArea`). */
  workArea: (bounds: Rect) => Rect;
  /** The page's zoom factor (CSS px to window units); 1 when absent. */
  zoom?: () => number;
  /**
   * T50: the full view's minimum page-area size (src/native/minSize.ts, window units). When given, Expand restores
   * exactly this (plus the window's frame) instead of the size read before the collapse.
   */
  minimum?: () => { width: number; height: number };
}

export interface CollapseReply {
  /** True when the window is maximized. */
  maximized: boolean;
}

const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/** What the window was before it became compact. */
interface Saved {
  bounds: Rect;
  maximized: boolean;
  min: [number, number];
}

export function createCollapse(deps: CollapseDeps) {
  let saved: Saved | null = null;
  return {
    /** `request` comes from the page: { collapsed, height }. Anything else changes nothing. */
    apply(request: unknown): CollapseReply {
      const w = deps.editor();
      if (!w || w.isDestroyed()) return { maximized: false };
      const r = (typeof request === "object" && request !== null ? request : {}) as { collapsed?: unknown; height?: unknown };

      if (r.collapsed === true) {
        const height = r.height;
        if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return { maximized: w.isMaximized() };
        const first = !saved;
        if (!saved) {
          const maximized = w.isMaximized();
          const min = w.getMinimumSize();
          saved = { bounds: maximized ? w.getNormalBounds() : w.getBounds(), maximized, min: [min[0] ?? 0, min[1] ?? 0] };
        }
        if (w.isMaximized()) w.unmaximize();
        const min = w.getMinimumSize();
        if ((min[0] ?? 0) > 0 || (min[1] ?? 0) > 0) w.setMinimumSize(0, 0);

        const zoom = deps.zoom?.() || 1;
        const now = w.getBounds();
        const content = w.getContentBounds();
        const frameW = Math.max(0, now.width - content.width);
        const frameH = Math.max(0, now.height - content.height);
        // The first time, y is the window's (normal) y; afterwards the compact window's own, so a moved one stays put.
        const from = first ? saved.bounds : now;
        const area = deps.workArea(from);
        const width = Math.round(PANEL_WIDTH * zoom) + frameW;
        const tall = Math.min(Math.ceil(height * zoom) + frameH, area.height);
        const target = { x: area.x + area.width - width, y: clamp(from.y, area.y, area.y + area.height - tall), width, height: tall };
        if (!same(now, target)) w.setBounds(target);
        return { maximized: false };
      }

      if (r.collapsed === false && saved) {
        const back = saved;
        saved = null;
        const full = deps.minimum?.();
        if (full) {
          // T50: Electron's minimum size is the whole window's; the content minimum plus the frame.
          const now = w.getBounds();
          const content = w.getContentBounds();
          w.setMinimumSize(full.width + Math.max(0, now.width - content.width), full.height + Math.max(0, now.height - content.height));
        } else if (back.min[0] > 0 || back.min[1] > 0) w.setMinimumSize(back.min[0], back.min[1]);
        // The user may have maximized the compact window: setBounds would then only change its normal bounds.
        if (w.isMaximized()) w.unmaximize();
        if (!same(w.getBounds(), back.bounds)) w.setBounds(back.bounds);
        if (back.maximized) w.maximize();
        return { maximized: back.maximized };
      }
      return { maximized: w.isMaximized() };
    },
  };
}
