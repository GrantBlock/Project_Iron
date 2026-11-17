// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCollapse, PANEL_WIDTH } from "./collapse";
import type { Rect } from "./windows";

function fakeWindow(start: Rect, maximized = false) {
  const state = { bounds: start, maximized, destroyed: false, moves: [] as Rect[] };
  const win = {
    isDestroyed: () => state.destroyed,
    getBounds: () => state.bounds,
    setBounds: (b: Rect) => {
      state.bounds = b;
      state.moves.push(b);
    },
    isMaximized: () => state.maximized,
  };
  return { state, win };
}
const SCREEN: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const START: Rect = { x: 200, y: 120, width: 1280, height: 800 };

describe("collapsed window (T31)", () => {
  it("windowed: collapsing with nothing open shrinks the window to the panel at the right edge of its screen", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    expect(c.apply({ collapsed: true, canvas: false })).toEqual({ maximized: false });
    expect(state.bounds).toEqual({ x: 1920 - PANEL_WIDTH, y: 120, width: PANEL_WIDTH, height: 800 });
    // Asking again moves nothing.
    c.apply({ collapsed: true, canvas: false });
    expect(state.moves).toHaveLength(1);
  });

  it("windowed: an opened snip gives the window its size back; closing it shrinks it again; expanding restores it", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    c.apply({ collapsed: true, canvas: false });
    c.apply({ collapsed: true, canvas: true });
    expect(state.bounds).toEqual(START);
    c.apply({ collapsed: true, canvas: false });
    expect(state.bounds.width).toBe(PANEL_WIDTH);
    c.apply({ collapsed: false, canvas: false });
    expect(state.bounds).toEqual(START);
    expect(state.moves).toHaveLength(4);
  });

  it("a second screen: the panel docks to the right edge of the screen the window is on", () => {
    const { state, win } = fakeWindow({ x: -1700, y: 40, width: 1000, height: 700 });
    const c = createCollapse({ editor: () => win, workArea: (b) => (b.x < 0 ? { x: -1920, y: 0, width: 1920, height: 1080 } : SCREEN) });
    c.apply({ collapsed: true, canvas: false });
    expect(state.bounds).toEqual({ x: -PANEL_WIDTH, y: 40, width: PANEL_WIDTH, height: 700 });
  });

  it("maximized: the window keeps its size and the page is told so", () => {
    const { state, win } = fakeWindow(START, true);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    expect(c.apply({ collapsed: true, canvas: false })).toEqual({ maximized: true });
    expect(state.moves).toEqual([]);
  });

  it("not collapsed, a bad request or no window: nothing moves", () => {
    const { state, win } = fakeWindow(START);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    for (const request of [{ collapsed: false, canvas: false }, { collapsed: true, canvas: true }, { collapsed: "yes", canvas: 0 }, null, undefined, "collapse", 7]) c.apply(request);
    expect(state.moves).toEqual([]);
    state.destroyed = true;
    expect(c.apply({ collapsed: true, canvas: false })).toEqual({ maximized: false });
    expect(createCollapse({ editor: () => null, workArea: () => SCREEN }).apply({ collapsed: true, canvas: false })).toEqual({ maximized: false });
    expect(state.moves).toEqual([]);
  });
});
