import { describe, expect, it } from "vitest";
import type { Shape } from "../model";
import { calloutNumbers, fillPctOf, fromPoints, hiddenOf, pixelArea, printArea, PRINT_MARGIN, strokePoints, strokesHit, cropImage } from "./engine";
import { reducer, type EditorState } from "./store";
import { loadPenMemory, savePenMemory } from "./tools";

const st = { stroke: "red", strokeWidth: 3 };
const rect = (id: string, x = 10, y = 10): Shape => ({ id, type: "rect", x, y, w: 20, h: 10, ...st });
const pen = (id: string, pts: { x: number; y: number }[]): Shape => ({ id, type: "pen", ...fromPoints(pts), ...st });

describe("markup engine (T32)", () => {
  it("callouts are numbered from the back; pens and highlighters have no number", () => {
    const shapes = [rect("a1"), pen("a2", [{ x: 0, y: 0 }, { x: 5, y: 5 }]), rect("a3")];
    expect([...calloutNumbers(shapes)]).toEqual([["a1", 1], ["a3", 2]]);
  });

  it("strokes keep their points inside the box, so a resize scales them", () => {
    const s = pen("a1", [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 20, y: 30 }]);
    expect(s).toMatchObject({ x: 10, y: 20, w: 20, h: 20, pts: [0, 0, 1, 1, 0.5, 0.5] });
    expect(strokePoints({ ...s, w: 40 })).toEqual([10, 20, 50, 40, 30, 30]);
  });

  it("the eraser takes a whole stroke it crosses and leaves shapes alone", () => {
    const shapes = [rect("a1", 0, 0), pen("a2", [{ x: 0, y: 50 }, { x: 100, y: 50 }])];
    expect(strokesHit(shapes, { x: 50, y: 0 }, { x: 50, y: 100 }, 1)).toEqual(["a2"]);
    expect(strokesHit(shapes, { x: 5, y: 5 }, { x: 6, y: 6 }, 1)).toEqual([]);
  });

  it("older markups: Hide # hides the bubble, a filled shape is 30 %", () => {
    expect(hiddenOf({ ...rect("a1"), hideNumber: true })).toEqual({ text: false, bubble: true, outline: false });
    expect(fillPctOf({ ...rect("a1"), fill: true })).toBe(30);
    expect(fillPctOf({ ...rect("a1"), fill: true, fillPct: 0 })).toBe(0);
  });

  it("the print area is the image, or everything with a tight margin when something spills past it", () => {
    const img = { width: 100, height: 50 };
    expect(printArea(img, [rect("a1")], new Map())).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    const a = printArea(img, [rect("a1")], new Map([["a1", { x: 120, y: 0, w: 30, h: 10 }]]));
    expect(a).toEqual({ x: -PRINT_MARGIN, y: -PRINT_MARGIN, w: 150 + 2 * PRINT_MARGIN, h: 50 + 2 * PRINT_MARGIN });
    expect(pixelArea({ x: -0.5, y: 0, w: 10, h: 10 })).toEqual({ x: -1, y: 0, width: 11, height: 10 });
  });

  it("reorder moves a shape in draw order; removeMany is one change", () => {
    const s: EditorState = { doc: { version: 1, source: { kind: "image", width: 10, height: 10 }, shapes: [rect("a1"), rect("a2"), rect("a3")] }, selectedId: "a2" };
    expect(reducer(s, { type: "reorder", id: "a1", index: 2 }).doc!.shapes.map((x) => x.id)).toEqual(["a2", "a3", "a1"]);
    const r = reducer(s, { type: "removeMany", ids: ["a2", "a3"] });
    expect(r.doc!.shapes.map((x) => x.id)).toEqual(["a1"]);
    expect(r.selectedId).toBeNull();
  });

  it("the colour and thickness are remembered per editor", () => {
    savePenMemory("snip", { role: "blue", stroke: 5 });
    expect(loadPenMemory("snip")).toEqual({ role: "blue", stroke: 5 });
    expect(loadPenMemory("markdown")).toEqual({ role: "red", stroke: 3 });
  });
});

describe("T39 cropImage", () => {
  const file = { width: 1000, height: 500 };
  it("keeps the scale and keeps what stays visible in place", () => {
    // Shown whole at half size: 500 x 250 at (2000, 0).
    const r = cropImage({ x: 2000, y: 0, w: 500, h: 250 }, file, { x: 0.2, y: 0.4, w: 0.5, h: 0.5 });
    expect(r).toEqual({ x: 2100, y: 100, w: 250, h: 125, crop: { x: 0.2, y: 0.4, w: 0.5, h: 0.5 } });
  });
  it("widening back to the whole image stores no crop and restores the box", () => {
    const r = cropImage({ x: 2100, y: 100, w: 250, h: 125, crop: { x: 0.2, y: 0.4, w: 0.5, h: 0.5 } }, file, { x: 0, y: 0, w: 1, h: 1 });
    expect(r).toEqual({ x: 2000, y: 0, w: 500, h: 250, crop: undefined });
  });
});
