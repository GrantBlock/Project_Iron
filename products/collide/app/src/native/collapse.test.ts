// @vitest-environment node
// T31, replaced by T48 (Grant 2026-11-20): collapse is the compact view. The page sends { collapsed, height } (height = the
// compact block measured in CSS px; there is no `canvas` any more). Collapsing unmaximizes (remembered), makes the window
// PANEL_WIDTH wide and `height` tall, docked at the right edge of the work area of its display, y kept but inside the work
// area; any minimum size is lifted. Expanding restores the exact earlier bounds and the minimum, and re-maximizes.
// Written before the code (Lydia, tests first). API assumed: createCollapse(deps).apply({ collapsed, height }) -> { maximized },
// the window also has getContentBounds, getNormalBounds, maximize, unmaximize, getMinimumSize, setMinimumSize.
import { describe, expect, it } from "vitest";
import { createCollapse, PANEL_WIDTH } from "./collapse";
import type { Rect } from "./windows";

/** A fake window that behaves like Electron's: maximizing fills the work area, unmaximize goes back to the normal bounds,
 *  setBounds cannot go below the minimum size, and the native frame makes the page area smaller than the window. */
function fakeWindow(start: Rect, opts: { maximized?: boolean; min?: [number, number]; frame?: { w: number; h: number }; area?: Rect } = {}) {
  const area = opts.area ?? SCREEN;
  const frame = opts.frame ?? { w: 0, h: 0 };
  const state = {
    bounds: start,
    normal: start,
    maximized: opts.maximized ?? false,
    min: opts.min ?? ([0, 0] as [number, number]),
    destroyed: false,
    log: [] as string[],
  };
  if (state.maximized) state.bounds = area;
  const win = {
    isDestroyed: () => state.destroyed,
    getBounds: () => state.bounds,
    getContentBounds: (): Rect => ({ x: state.bounds.x, y: state.bounds.y, width: state.bounds.width - frame.w, height: state.bounds.height - frame.h }),
    getNormalBounds: () => (state.maximized ? state.normal : state.bounds),
    setBounds: (b: Rect) => {
      state.log.push(`setBounds ${b.x},${b.y} ${b.width}x${b.height}`);
      const next = { ...b, width: Math.max(b.width, state.min[0]), height: Math.max(b.height, state.min[1]) };
      if (state.maximized) state.normal = next;
      else state.bounds = next;
    },
    isMaximized: () => state.maximized,
    maximize: () => {
      state.log.push("maximize");
      if (!state.maximized) state.normal = state.bounds;
      state.maximized = true;
      state.bounds = area;
    },
    unmaximize: () => {
      state.log.push("unmaximize");
      state.maximized = false;
      state.bounds = state.normal;
    },
    getMinimumSize: () => [...state.min],
    setMinimumSize: (w: number, h: number) => {
      state.log.push(`setMinimumSize ${w}x${h}`);
      state.min = [w, h];
    },
  };
  return { state, win };
}
const SCREEN: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const START: Rect = { x: 200, y: 120, width: 1280, height: 800 };
const H = 312; // a measured compact block height (CSS px)

const make = (w: ReturnType<typeof fakeWindow>["win"], area: (b: Rect) => Rect = () => SCREEN) => createCollapse({ editor: () => w, workArea: area });

describe("the compact window (T48)", () => {
  it("windowed: collapsing makes the window PANEL_WIDTH wide and the measured height tall, at the right edge of its screen, y kept", () => {
    expect(PANEL_WIDTH).toBe(276);
    const { state, win } = fakeWindow(START);
    const c = make(win);
    expect(c.apply({ collapsed: true, height: H })).toEqual({ maximized: false });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: H });
    // Asking again moves nothing.
    c.apply({ collapsed: true, height: H });
    expect(state.log.filter((l) => l.startsWith("setBounds"))).toHaveLength(1);
  });

  it("an open tab changes nothing: there is no canvas rule any more (was: windowed with a tab open keeps its size)", () => {
    const { state, win } = fakeWindow(START);
    const c = make(win);
    c.apply({ collapsed: true, canvas: true, height: H });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: H });
  });

  it("when the page measures a new height (a pill appears), the window follows; Expand still restores the very first bounds", () => {
    const { state, win } = fakeWindow(START);
    const c = make(win);
    c.apply({ collapsed: true, height: H });
    c.apply({ collapsed: true, height: 340 });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: 340 });
    c.apply({ collapsed: false, height: 340 });
    expect(state.bounds).toEqual(START);
  });

  it("the content area is exactly 276 wide and as tall as the block, whatever the native frame adds", () => {
    const { state, win } = fakeWindow(START, { frame: { w: 16, h: 39 } });
    make(win).apply({ collapsed: true, height: H });
    expect(win.getContentBounds().width).toBe(PANEL_WIDTH);
    expect(win.getContentBounds().height).toBe(H);
    expect(state.bounds.x + state.bounds.width).toBe(SCREEN.x + SCREEN.width);
  });

  it("y is kept but clamped inside the work area (bottom, top, a taskbar on top)", () => {
    const low = fakeWindow({ x: 300, y: 900, width: 1000, height: 700 });
    make(low.win).apply({ collapsed: true, height: H });
    expect(low.state.bounds.y).toBe(1040 - H);
    const high = fakeWindow({ x: 300, y: -30, width: 1000, height: 700 });
    make(high.win).apply({ collapsed: true, height: H });
    expect(high.state.bounds.y).toBe(0);
    const area = { x: 0, y: 40, width: 1920, height: 1000 };
    const top = fakeWindow({ x: 300, y: 10, width: 1000, height: 700 }, { area });
    make(top.win, () => area).apply({ collapsed: true, height: H });
    expect(top.state.bounds.y).toBe(40);
    // A height taller than the work area cannot overflow it.
    const tall = fakeWindow(START);
    make(tall.win).apply({ collapsed: true, height: 5000 });
    expect(tall.state.bounds.y).toBeGreaterThanOrEqual(0);
    expect(tall.state.bounds.y + tall.state.bounds.height).toBeLessThanOrEqual(1040);
  });

  it("a second screen: docked to the right edge of the screen the window is on", () => {
    const left: Rect = { x: -1920, y: 0, width: 1920, height: 1080 };
    const { state, win } = fakeWindow({ x: -1700, y: 40, width: 1000, height: 700 });
    make(win, (b) => (b.x < 0 ? left : SCREEN)).apply({ collapsed: true, height: H });
    expect(state.bounds).toEqual({ x: -PANEL_WIDTH, y: 40, width: PANEL_WIDTH, height: H });
  });

  it("windowed: Expand restores the exact earlier bounds and does not maximize", () => {
    const { state, win } = fakeWindow(START);
    const c = make(win);
    c.apply({ collapsed: true, height: H });
    expect(c.apply({ collapsed: false, height: H })).toEqual({ maximized: false });
    expect(state.bounds).toEqual(START);
    expect(state.log).not.toContain("maximize");
    // A second Expand has nothing to restore.
    const n = state.log.length;
    c.apply({ collapsed: false, height: H });
    expect(state.log).toHaveLength(n);
  });

  it("maximized: collapsing unmaximizes (was: maximized keeps its size) and Expand restores the bounds and re-maximizes", () => {
    const { state, win } = fakeWindow(START, { maximized: true });
    state.normal = START;
    const c = make(win);
    expect(c.apply({ collapsed: true, height: H })).toEqual({ maximized: false });
    expect(state.maximized).toBe(false);
    expect(state.bounds.width).toBe(PANEL_WIDTH);
    expect(state.bounds.height).toBe(H);
    expect(state.bounds.x).toBe(1920 - PANEL_WIDTH);
    // Re-sending while compact does not forget that it was maximized.
    c.apply({ collapsed: true, height: H });
    expect(c.apply({ collapsed: false, height: H })).toEqual({ maximized: true });
    expect(state.maximized).toBe(true);
    // The bounds under the maximized window are the exact earlier ones, set before maximizing.
    expect(state.normal).toEqual(START);
    const log = state.log;
    expect(log.indexOf("maximize")).toBeGreaterThan(log.lastIndexOf(`setBounds ${START.x},${START.y} ${START.width}x${START.height}`));
  });

  it("maximized, y comes from the window's normal bounds, kept and clamped", () => {
    const { state, win } = fakeWindow({ x: 100, y: 1000, width: 1000, height: 700 }, { maximized: true });
    state.normal = { x: 100, y: 1000, width: 1000, height: 700 };
    make(win).apply({ collapsed: true, height: H });
    expect(state.bounds.y).toBe(1040 - H);
  });

  it("the minimum size is lifted while compact and comes back on Expand", () => {
    const { state, win } = fakeWindow(START, { min: [800, 500] });
    const c = make(win);
    c.apply({ collapsed: true, height: H });
    expect(state.min).toEqual([0, 0]);
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: H });
    c.apply({ collapsed: false, height: H });
    expect(state.min).toEqual([800, 500]);
    expect(state.bounds).toEqual(START);
    // Lifted before the window is made small (a minimum would block it), restored before it grows back or maximizes.
    expect(state.log.indexOf("setMinimumSize 0x0")).toBeLessThan(state.log.indexOf(`setBounds ${1920 - PANEL_WIDTH},120 ${PANEL_WIDTH}x${H}`));
  });

  it("maximized with a minimum size: lifted, restored, re-maximized", () => {
    const { state, win } = fakeWindow(START, { maximized: true, min: [800, 500] });
    state.normal = START;
    const c = make(win);
    c.apply({ collapsed: true, height: H });
    expect(state.min).toEqual([0, 0]);
    expect(state.bounds.width).toBe(PANEL_WIDTH);
    c.apply({ collapsed: false, height: H });
    expect(state.min).toEqual([800, 500]);
    expect(state.maximized).toBe(true);
    expect(state.normal).toEqual(START);
  });

  it("not collapsed, a bad request or no window: nothing moves", () => {
    const { state, win } = fakeWindow(START);
    const c = make(win);
    const bad = [{ collapsed: false, height: H }, { collapsed: "yes", height: H }, { collapsed: true }, { collapsed: true, height: "tall" }, { collapsed: true, height: -5 }, { collapsed: true, height: NaN }, null, undefined, "collapse", 7];
    for (const request of bad) c.apply(request);
    expect(state.log).toEqual([]);
    state.destroyed = true;
    expect(c.apply({ collapsed: true, height: H })).toEqual({ maximized: false });
    expect(createCollapse({ editor: () => null, workArea: () => SCREEN }).apply({ collapsed: true, height: H })).toEqual({ maximized: false });
    expect(state.log).toEqual([]);
  });
});

describe("the compact window, review round 1 (T48, Farengar)", () => {
  it("a compact window the user maximized: Expand unmaximizes it and restores the exact earlier bounds", () => {
    const { state, win } = fakeWindow(START);
    const c = make(win);
    c.apply({ collapsed: true, height: H });
    win.maximize(); // title-bar double-click or Win+Up while compact
    expect(c.apply({ collapsed: false, height: H })).toEqual({ maximized: false });
    expect(state.maximized).toBe(false);
    expect(state.bounds).toEqual(START);
  });
});
