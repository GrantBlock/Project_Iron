// @vitest-environment node
// T50 (Grant 2026-11-20): collapsing lifts the full view's minimum window size, Expand puts back exactly MIN_WIDTH x
// MIN_HEIGHT (the content size, plus the window's frame), whatever the minimum read before the collapse was.
import { describe, expect, it } from "vitest";
import { createCollapse } from "./collapse";
import { MIN_HEIGHT, MIN_WIDTH } from "./minSize";
import type { Rect } from "./windows";

const FRAME = { w: 16, h: 39 };
function fakeWindow(start: Rect, min: [number, number]) {
  const state = { bounds: start, min, log: [] as string[] };
  const win = {
    isDestroyed: () => false,
    getBounds: () => state.bounds,
    setBounds: (b: Rect) => {
      state.bounds = { ...b, width: Math.max(b.width, state.min[0]), height: Math.max(b.height, state.min[1]) };
    },
    getContentBounds: () => ({ x: state.bounds.x + 8, y: state.bounds.y + 31, width: state.bounds.width - FRAME.w, height: state.bounds.height - FRAME.h }),
    getNormalBounds: () => state.bounds,
    isMaximized: () => false,
    maximize: () => undefined,
    unmaximize: () => undefined,
    getMinimumSize: () => [...state.min],
    setMinimumSize: (w: number, h: number) => {
      state.log.push(`setMinimumSize ${w}x${h}`);
      state.min = [w, h];
    },
  };
  return { state, win };
}
const SCREEN: Rect = { x: 0, y: 0, width: 1920, height: 1040 };

describe("the full view's minimum around the compact view (T50)", () => {
  it("collapse lifts the minimum; Expand restores MIN_WIDTH x MIN_HEIGHT plus the frame", () => {
    // A stale minimum before the collapse (another DPI, say) is not what comes back.
    const { state, win } = fakeWindow({ x: 100, y: 100, width: 1400, height: 900 }, [1000, 500]);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN, minimum: () => ({ width: MIN_WIDTH, height: MIN_HEIGHT }) });
    c.apply({ collapsed: true, height: 312 });
    expect(state.min).toEqual([0, 0]);
    expect(state.bounds.width).toBe(276 + FRAME.w);
    c.apply({ collapsed: false });
    expect(state.min).toEqual([MIN_WIDTH + FRAME.w, MIN_HEIGHT + FRAME.h]);
    expect(state.bounds).toEqual({ x: 100, y: 100, width: 1400, height: 900 });
  });

  it("without `minimum` the minimum read before the collapse comes back (T48 behaviour)", () => {
    const { state, win } = fakeWindow({ x: 100, y: 100, width: 1400, height: 900 }, [1000, 500]);
    const c = createCollapse({ editor: () => win, workArea: () => SCREEN });
    c.apply({ collapsed: true, height: 312 });
    c.apply({ collapsed: false });
    expect(state.min).toEqual([1000, 500]);
  });
});
