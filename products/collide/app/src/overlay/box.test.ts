import { describe, expect, it } from "vitest";
import { cropRect, isEmptyBox, normalizeBox, readout } from "./box";

describe("normalizeBox", () => {
  const a = { x: 100, y: 80 };
  it.each([
    ["down-right", { x: 300, y: 200 }],
    ["down-left", { x: -100 + 0, y: 200 }],
    ["up-right", { x: 300, y: 10 }],
    ["up-left", { x: 20, y: 10 }],
  ])("%s gives positive w/h", (_n, b) => {
    const box = normalizeBox(a, b);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
    expect(box.x).toBe(Math.min(a.x, b.x));
    expect(box.y).toBe(Math.min(a.y, b.y));
    expect(box.w).toBe(Math.abs(a.x - b.x));
  });
  it("is symmetric in its arguments", () => {
    expect(normalizeBox({ x: 5, y: 9 }, { x: 1, y: 2 })).toEqual(normalizeBox({ x: 1, y: 2 }, { x: 5, y: 9 }));
  });
  it("clamps to bounds", () => {
    expect(normalizeBox({ x: -20, y: 50 }, { x: 900, y: 700 }, { w: 800, h: 600 })).toEqual({ x: 0, y: 50, w: 800, h: 550 });
  });
  it("detects empty boxes", () => {
    expect(isEmptyBox(normalizeBox({ x: 4, y: 4 }, { x: 4, y: 40 }))).toBe(true);
    expect(isEmptyBox({ x: 0, y: 0, w: 1, h: 1 })).toBe(false);
  });
});

// Cases copied from src-tauri/src/crop.rs tests: [x, y, w, h, scale, frameW, frameH, expected rect].
const B = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const cases: [string, ReturnType<typeof B>, number, number, number, [number, number, number, number]][] = [
  ["integer 1x", B(10, 20, 100, 50), 1, 1920, 1080, [10, 20, 100, 50]],
  ["integer 1.25x", B(8, 8, 80, 40), 1.25, 1920, 1080, [10, 10, 100, 50]],
  ["integer 1.5x", B(10, 20, 100, 50), 1.5, 1920, 1080, [15, 30, 150, 75]],
  ["integer 2x", B(10, 20, 100, 50), 2, 1920, 1080, [20, 40, 200, 100]],
  ["fractional 1.25x", B(10.3, 10.3, 10.4, 10.4), 1.25, 1920, 1080, [12, 12, 14, 14]],
  ["fractional 1x", B(0.5, 0.5, 2, 2), 1, 100, 100, [0, 0, 3, 3]],
  ["fractional 1.5x", B(3.3, 3.3, 3.4, 3.4), 1.5, 100, 100, [4, 4, 7, 7]],
  ["fractional 2x", B(0.25, 0.25, 0.5, 0.5), 2, 100, 100, [0, 0, 2, 2]],
  ["float noise 1.25x", B(0.8, 0.8, 0.8, 0.8), 1.25, 100, 100, [1, 1, 1, 1]],
  ["sliver", B(5.1, 5.1, 0.01, 0.01), 1, 100, 100, [5, 5, 1, 1]],
  ["clamp top-left", B(-10, -10, 30, 30), 1, 100, 100, [0, 0, 20, 20]],
  ["clamp bottom-right", B(90, 95, 30, 30), 1, 100, 100, [90, 95, 10, 5]],
  ["clamp everything 2x", B(-1000, -1000, 5000, 5000), 2, 100, 80, [0, 0, 100, 80]],
];

describe("cropRect (port of crop.rs crop_rect)", () => {
  it.each(cases)("%s", (_n, box, scale, fw, fh, [x, y, w, h]) => {
    expect(cropRect(box, scale, fw, fh)).toEqual({ x, y, w, h });
    // The readout is exactly the crop size, origin included.
    expect(readout(box, scale, fw, fh)).toBe(`${w} × ${h}`);
  });
  it("returns null where Rust errors", () => {
    expect(cropRect(B(1, 1, 0, 10), 1, 100, 100)).toBeNull();
    expect(cropRect(B(1, 1, -5, 10), 1, 100, 100)).toBeNull();
    expect(cropRect(B(NaN, 0, 1, 1), 1, 10, 10)).toBeNull();
    expect(cropRect(B(0, 0, 1, 1), 0, 10, 10)).toBeNull();
    for (const b of [B(-30, 0, 30, 10), B(100, 0, 10, 10), B(0, 100, 10, 10), B(0, -10, 10, 10), B(500, 500, 10, 10)])
      expect(cropRect(b, 1, 100, 100)).toBeNull();
  });
});
