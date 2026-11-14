import { describe, expect, it } from "vitest";
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fitView,
  imageToScreen,
  panBy,
  screenToImage,
  wheelFactor,
  zoomAt,
  type View,
} from "./viewport";

const view: View = { scale: 1.5, x: 40, y: -20 };

describe("coordinate conversion", () => {
  it("converts screen to image and back", () => {
    const p = { x: 300, y: 200 };
    const img = screenToImage(view, p);
    expect(img).toEqual({ x: (300 - 40) / 1.5, y: (200 + 20) / 1.5 });
    const back = imageToScreen(view, img);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
  it("maps the image origin to the view offset", () => {
    expect(imageToScreen(view, { x: 0, y: 0 })).toEqual({ x: 40, y: -20 });
  });
});

describe("zoomAt", () => {
  it("keeps the image point under the cursor fixed", () => {
    const cursor = { x: 250, y: 130 };
    const before = screenToImage(view, cursor);
    const next = zoomAt(view, cursor, 3.2);
    expect(next.scale).toBe(3.2);
    const after = screenToImage(next, cursor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
  it("zooms out around the cursor too", () => {
    const cursor = { x: 10, y: 400 };
    const before = screenToImage(view, cursor);
    const after = screenToImage(zoomAt(view, cursor, 0.4), cursor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
  it("clamps to 10%–800%", () => {
    expect(zoomAt(view, { x: 0, y: 0 }, 100).scale).toBe(MAX_SCALE);
    expect(zoomAt(view, { x: 0, y: 0 }, 0.001).scale).toBe(MIN_SCALE);
    expect(MIN_SCALE).toBe(0.1);
    expect(MAX_SCALE).toBe(8);
  });
  it("stays anchored when clamped", () => {
    const cursor = { x: 120, y: 90 };
    const before = screenToImage(view, cursor);
    const after = screenToImage(zoomAt(view, cursor, 1000), cursor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
});

describe("clampScale / wheelFactor / panBy", () => {
  it("clampScale limits both ends", () => {
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(1)).toBe(1);
    expect(clampScale(9)).toBe(MAX_SCALE);
  });
  it("wheel up zooms in, wheel down zooms out, zero is neutral", () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
  });
  it("panBy translates without changing scale", () => {
    expect(panBy(view, 5, -7)).toEqual({ scale: 1.5, x: 45, y: -27 });
  });
});

describe("fitView", () => {
  it("centres the image and never upscales past 100%", () => {
    const v = fitView({ width: 1000, height: 800 }, { width: 400, height: 300 });
    expect(v.scale).toBe(1);
    expect(v.x).toBe(300);
    expect(v.y).toBe(250);
  });
  it("shrinks a large image to fit with padding", () => {
    const v = fitView({ width: 500, height: 400 }, { width: 2000, height: 1000 }, 50);
    expect(v.scale).toBeCloseTo(400 / 2000, 9);
    expect(2000 * v.scale + 2 * v.x).toBeCloseTo(500, 9);
  });
});
