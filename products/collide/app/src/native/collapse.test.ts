// @vitest-environment node
import { describe, expect, it } from "vitest";
import { COMPACT_MIN_HEIGHT, createCollapse, PANEL_WIDTH } from "./collapse";
import type { Rect } from "./windows";

/** A fake BrowserWindow. `frame` is what the native frame adds around the page (0 on Linux under xvfb, more on Windows). */
function fakeWindow(start: Rect, maximized = false, frame = { w: 0, h: 0 }) {
  const state = {
    bounds: start,
    normal: start,
    maximized,
    destroyed: false,
    moves: [] as Rect[],
    calls: [] as string[],
    minimum: [0, 0] as [number, number],
    resizable: true,
  };
  const win = {
    isDestroyed: () => state.destroyed,
    getBounds: () => state.bounds,
    getContentBounds: () => ({ x: state.bounds.x, y: state.bounds.y, width: state.bounds.width - frame.w, height: state.bounds.height - frame.h }),
    getNormalBounds: () => state.normal,
    setBounds: (b: Rect) => {
      if (b.width < state.minimum[0] || b.height < state.minimum[1]) throw new Error("smaller than the minimum size");
      if (!state.resizable) throw new Error("not resizable");
      state.bounds = b;
      state.normal = b;
      state.moves.push(b);
      state.calls.push("setBounds");
    },
    isMaximized: () => state.maximized,
    maximize: () => {
      state.maximized = true;
      state.bounds = { x: 0, y: 0, width: 1920, height: 1040 };
      state.calls.push("maximize");
    },
    unmaximize: () => {
      state.maximized = false;
      state.bounds = state.normal;
      state.calls.push("unmaximize");
    },
    getMinimumSize: () => [...state.minimum],
    setMinimumSize: (w: number, h: number) => {
      state.minimum = [w, h];
      state.calls.push(`setMinimumSize ${w} ${h}`);
    },
    isResizable: () => state.resizable,
    setResizable: (r: boolean) => {
      state.resizable = r;
      state.calls.push(`setResizable ${r}`);
    },
  };
  if (maximized) state.bounds = { x: 0, y: 0, width: 1920, height: 1040 };
  return { state, win };
}
const SCREEN: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const START: Rect = { x: 200, y: 120, width: 1280, height: 800 };
/** The page's compact block: brand row and the six controls, in CSS px. */
const BLOCK = 214;

describe("collapsed window (T31, compact view T48)", () => {
  it("windowed: collapsing shrinks the window to the panel's width and the compact block's height, at the right edge of its screen", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    expect(c.apply({ collapsed: true, height: BLOCK })).toEqual({ maximized: false });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: BLOCK });
    // Asking again moves nothing.
    c.apply({ collapsed: true, height: BLOCK });
    expect(state.moves).toHaveLength(1);
  });

  it("T48: a tab open makes no difference: the window stays compact; expanding restores the exact earlier bounds", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    c.apply({ collapsed: true, canvas: true, height: BLOCK });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: BLOCK });
    c.apply({ collapsed: true, canvas: false, height: BLOCK });
    expect(state.moves).toHaveLength(1);
    c.apply({ collapsed: false, canvas: true });
    expect(state.bounds).toEqual(START);
    expect(state.moves).toHaveLength(2);
  });

  it("a second screen: the panel docks to the right edge of the screen the window is on", () => {
    const { state, win } = fakeWindow({ x: -1700, y: 40, width: 1000, height: 700 });
    const c = createCollapse({ editor: () => win, workArea: (b) => (b.x < 0 ? { x: -1920, y: 0, width: 1920, height: 1080 } : SCREEN) });
    c.apply({ collapsed: true, height: BLOCK });
    expect(state.bounds).toEqual({ x: -PANEL_WIDTH, y: 40, width: PANEL_WIDTH, height: BLOCK });
  });

  it("T48: maximized: collapsing unmaximizes first, then shrinks; expanding restores the normal bounds and maximizes again", () => {
    const { state, win } = fakeWindow(START, true);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    expect(c.apply({ collapsed: true, height: BLOCK })).toEqual({ maximized: false });
    expect(state.maximized).toBe(false);
    expect(state.calls.indexOf("unmaximize")).toBeLessThan(state.calls.indexOf("setBounds"));
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: BLOCK });
    expect(c.apply({ collapsed: false })).toEqual({ maximized: true });
    expect(state.calls.slice(-2)).toEqual(["setBounds", "maximize"]);
    expect(state.normal).toEqual(START);
    expect(state.maximized).toBe(true);
  });

  it("T48: the native frame is added, so the page inside is PANEL_WIDTH wide and as tall as the block; the page's zoom is applied", () => {
    const { state, win } = fakeWindow(START, false, { w: 16, h: 39 });
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    c.apply({ collapsed: true, height: BLOCK });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH - 16, y: 120, width: PANEL_WIDTH + 16, height: BLOCK + 39 });
    const zoomed = fakeWindow(START);
    createCollapse({ editor: () => zoomed.win, workArea: () => SCREEN, zoom: () => 1.25 }).apply({ collapsed: true, height: 200 });
    expect(zoomed.state.bounds).toEqual({ x: 1920 - 345, y: 120, width: 345, height: 250 });
  });

  it("T48: the height is clamped to a minimum and to the work area; y stays but is kept inside the work area", () => {
    const low = fakeWindow({ x: 200, y: 900, width: 1280, height: 800 });
    createCollapse({ editor: () => low.win, workArea: () => SCREEN }).apply({ collapsed: true, height: BLOCK });
    expect(low.state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 1040 - BLOCK, width: PANEL_WIDTH, height: BLOCK });

    const tiny = fakeWindow(START);
    createCollapse({ editor: () => tiny.win, workArea: () => SCREEN }).apply({ collapsed: true, height: 3 });
    expect(tiny.state.bounds.height).toBe(COMPACT_MIN_HEIGHT);

    const tall = fakeWindow({ x: 200, y: -50, width: 1280, height: 800 });
    createCollapse({ editor: () => tall.win, workArea: () => ({ x: 0, y: 0, width: 1920, height: 400 }) }).apply({ collapsed: true, height: 5000 });
    expect(tall.state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 0, width: PANEL_WIDTH, height: 400 });

    // No height from the page: a sensible default, still inside the minimum and the work area.
    const none = fakeWindow(START);
    createCollapse({ editor: () => none.win, workArea: () => SCREEN }).apply({ collapsed: true });
    expect(none.state.bounds.height).toBeGreaterThanOrEqual(COMPACT_MIN_HEIGHT);
    expect(none.state.bounds.width).toBe(PANEL_WIDTH);
  });

  it("T48: a minimum size or a fixed size on the window is lifted while compact and put back on expand", () => {
    const { state, win } = fakeWindow(START);
    state.minimum = [800, 600];
    state.resizable = false;
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    c.apply({ collapsed: true, height: BLOCK });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: BLOCK });
    c.apply({ collapsed: false });
    expect(state.bounds).toEqual(START);
    expect(state.minimum).toEqual([800, 600]);
    expect(state.resizable).toBe(false);
  });

  it("T48: a new height from the page (the Connected pill shows) resizes the compact window; the saved bounds stay the first ones", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    c.apply({ collapsed: true, height: BLOCK });
    c.apply({ collapsed: true, height: BLOCK + 20 });
    expect(state.bounds.height).toBe(BLOCK + 20);
    c.apply({ collapsed: false });
    expect(state.bounds).toEqual(START);
  });

  it("not collapsed, a bad request or no window: nothing moves", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    for (const request of [{ collapsed: false, canvas: false }, { collapsed: "yes", canvas: 0 }, null, undefined, "collapse", 7]) c.apply(request);
    expect(state.moves).toEqual([]);
    state.destroyed = true;
    expect(c.apply({ collapsed: true, canvas: false })).toEqual({ maximized: false });
    expect(createCollapse({ editor: () => null, workArea: () => SCREEN }).apply({ collapsed: true, canvas: false })).toEqual({ maximized: false });
    expect(state.moves).toEqual([]);
  });
});
