// @vitest-environment node
// T50 (Grant 2026-11-20), written before the code (Lydia, tests first). API assumed: src/native/minSize.ts exports
// MIN_WIDTH and MIN_HEIGHT, the full app's minimum window content size in CSS px (measured from the real layout: e2e/minSizeT50.spec.ts).
import { describe, expect, it } from "vitest";
import { PANEL_WIDTH } from "./collapse";
import { MIN_HEIGHT, MIN_WIDTH } from "./minSize";

describe("the full app's minimum window size (T50)", () => {
  it("are whole numbers of CSS px", () => {
    expect(Number.isInteger(MIN_WIDTH)).toBe(true);
    expect(Number.isInteger(MIN_HEIGHT)).toBe(true);
  });
  it("keep the sidebar docked (above the 820 px phone layout) and are larger than the compact view", () => {
    expect(MIN_WIDTH).toBeGreaterThan(820);
    expect(MIN_WIDTH).toBeGreaterThan(PANEL_WIDTH);
    expect(MIN_HEIGHT).toBeGreaterThan(300);
  });
  it("fit the 1280 x 800 window the app opens with", () => {
    expect(MIN_WIDTH).toBeLessThanOrEqual(1280);
    expect(MIN_HEIGHT).toBeLessThanOrEqual(800);
  });
});
