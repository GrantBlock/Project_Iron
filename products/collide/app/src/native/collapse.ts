// T31: the collapsed window (Grant 2026-11-15). Collapsing moves Recents to the right.
// Windowed: the window shrinks to the Recents panel at the right edge of its screen; a new or opened
// snip gives it back the size it had, so the canvas fits. Maximized: the window keeps its size
// (the page shows a blank canvas beside the panel).
// Electron's BrowserWindow and screen are passed in, so this is unit-tested with a fake window.
// Window sizes on Windows are a manual check (TESTER-NOTES).
import type { Rect, WindowLike } from "./windows";

/** The Recents panel's width: `--side-w` in src/shell/shell.css. */
export const PANEL_WIDTH = 276;

export interface CollapseDeps {
  /** The editor window, or null once it is gone. */
  editor: () => Pick<WindowLike, "isDestroyed" | "getBounds" | "setBounds" | "isMaximized"> | null;
  /** The usable area of the screen a window with these bounds is on (main process: `screen.getDisplayMatching(b).workArea`). */
  workArea: (bounds: Rect) => Rect;
}

export interface CollapseReply {
  /** True when the window is maximized, so the page keeps its canvas. */
  maximized: boolean;
}

const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function createCollapse(deps: CollapseDeps) {
  /** The window's bounds from before it shrank to the panel. */
  let saved: Rect | null = null;
  return {
    /** `request` comes from the page: { collapsed, canvas } (canvas = a tab is open). Anything else changes nothing. */
    apply(request: unknown): CollapseReply {
      const w = deps.editor();
      if (!w || w.isDestroyed()) return { maximized: false };
      if (w.isMaximized()) return { maximized: true };
      const r = (typeof request === "object" && request !== null ? request : {}) as { collapsed?: unknown; canvas?: unknown };
      const now = w.getBounds();
      if (r.collapsed === true && r.canvas === false) {
        saved ??= now;
        const area = deps.workArea(now);
        const panel = { x: area.x + area.width - PANEL_WIDTH, y: now.y, width: PANEL_WIDTH, height: now.height };
        if (!same(now, panel)) w.setBounds(panel);
      } else if (saved) {
        const back = saved;
        saved = null;
        if (!same(now, back)) w.setBounds(back);
      }
      return { maximized: false };
    },
  };
}
