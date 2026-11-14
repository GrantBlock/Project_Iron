import { describe, expect, it } from "vitest";
import { BADGE_SIZE, calloutAt, dragBounds, isRealDrag, resizeShape, scalePoints, shapeFromDrag } from "./geometry";
import { screenToImage, type View } from "./viewport";

const style = { stroke: "#4C87C4", strokeWidth: 3 };

describe("dragBounds", () => {
  const cases: [string, [number, number], [number, number]][] = [
    ["down-right", [10, 20], [110, 70]],
    ["up-left", [110, 70], [10, 20]],
    ["up-right", [10, 70], [110, 20]],
    ["down-left", [110, 20], [10, 70]],
  ];
  it.each(cases)("normalises a %s drag", (_n, a, b) => {
    expect(dragBounds({ x: a[0], y: a[1] }, { x: b[0], y: b[1] })).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });
});

describe("shapeFromDrag", () => {
  it("builds rect and ellipse with normalised bounds in any direction", () => {
    expect(shapeFromDrag("rect", { x: 50, y: 60 }, { x: 10, y: 20 }, style)).toEqual({ type: "rect", x: 10, y: 20, w: 40, h: 40, ...style });
    expect(shapeFromDrag("ellipse", { x: 5, y: 5 }, { x: 25, y: 15 }, style)).toMatchObject({ type: "ellipse", x: 5, y: 5, w: 20, h: 10 });
  });

  it("keeps arrow direction in points relative to its bounds", () => {
    const up = shapeFromDrag("arrow", { x: 100, y: 100 }, { x: 40, y: 30 }, style);
    expect(up).toMatchObject({ type: "arrow", x: 40, y: 30, w: 60, h: 70, points: [60, 70, 0, 0] });
    const down = shapeFromDrag("arrow", { x: 40, y: 30 }, { x: 100, y: 100 }, style);
    expect(down).toMatchObject({ points: [0, 0, 60, 70] });
  });

  it("is zoom independent: a drag at 200% maps to image pixels", () => {
    const view: View = { scale: 2, x: 30, y: 10 };
    const a = screenToImage(view, { x: 130, y: 110 });
    const b = screenToImage(view, { x: 430, y: 310 });
    expect(shapeFromDrag("rect", a, b, style)).toMatchObject({ x: 50, y: 50, w: 150, h: 100 });
    // Zoomed out to 50% the same image box needs half the screen distance.
    const out: View = { scale: 0.5, x: 0, y: 0 };
    expect(dragBounds(screenToImage(out, { x: 25, y: 25 }), screenToImage(out, { x: 100, y: 75 }))).toEqual({ x: 50, y: 50, w: 150, h: 100 });
  });
});

describe("isRealDrag", () => {
  it("measures the threshold on screen, not in image pixels", () => {
    expect(isRealDrag({ x: 0, y: 0 }, { x: 3, y: 3 }, 1)).toBe(false);
    expect(isRealDrag({ x: 0, y: 0 }, { x: 3, y: 3 }, 4)).toBe(true);
    expect(isRealDrag({ x: 0, y: 0 }, { x: 0, y: 6 }, 1)).toBe(true);
  });
});

describe("calloutAt", () => {
  it("centres the badge on the click", () => {
    expect(calloutAt({ x: 100, y: 50 }, style)).toMatchObject({ type: "callout", x: 100 - BADGE_SIZE / 2, y: 50 - BADGE_SIZE / 2, w: BADGE_SIZE, h: BADGE_SIZE });
  });
});

describe("scalePoints", () => {
  it("scales per axis and leaves zero-size axes alone", () => {
    expect(scalePoints([0, 0, 60, 70], { x: 0, y: 0, w: 60, h: 70 }, { x: 0, y: 0, w: 120, h: 35 })).toEqual([0, 0, 120, 35]);
    expect(scalePoints([0, 0, 60, 0], { x: 0, y: 0, w: 60, h: 0 }, { x: 0, y: 0, w: 30, h: 10 })).toEqual([0, 0, 30, 0]);
  });
});

describe("resizeShape", () => {
  const measure = (t: string, f: number) => ({ w: t.length * f * 0.5, h: f * 1.2 });
  it("resizes a rect by node scale and offset", () => {
    const r = resizeShape({ type: "rect", x: 100, y: 100, w: 80, h: 40 }, { x: -20, y: 0, scaleX: 1.25, scaleY: 2 }, measure);
    expect(r).toEqual({ x: 80, y: 100, w: 100, h: 80 });
  });
  it("keeps an ellipse's centre reference", () => {
    // base centre offset (40,20); dragging the right edge out by 40 moves the centre by 20.
    const r = resizeShape({ type: "ellipse", x: 100, y: 100, w: 80, h: 40 }, { x: 60, y: 20, scaleX: 1.5, scaleY: 1 }, measure);
    expect(r).toEqual({ x: 100, y: 100, w: 120, h: 40 });
  });
  it("scales arrow points with its bounds", () => {
    const r = resizeShape({ type: "arrow", x: 10, y: 10, w: 60, h: 70, points: [60, 70, 0, 0] }, { x: 0, y: 0, scaleX: 2, scaleY: 0.5 }, measure);
    expect(r).toMatchObject({ x: 10, y: 10, w: 120, h: 35, points: [120, 35, 0, 0] });
  });
  it("scales text by font size and re-measures", () => {
    const r = resizeShape({ type: "text", x: 5, y: 5, w: 40, h: 20, text: "abcd", fontSize: 16 }, { x: 0, y: 0, scaleX: 2, scaleY: 2 }, measure);
    expect(r).toMatchObject({ x: 5, y: 5, fontSize: 32, w: 64, h: 38.4 });
  });
});
