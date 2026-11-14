import { describe, expect, it } from "vitest";
import type { Shape } from "../model";
import { hasNoteBox, layoutNotes, leader, leaderTarget, nearestSide, NOTE_GAP, NOTE_PAD, NOTE_STACK_GAP, NOTE_W, POINT_CLEARANCE, noteHeight, placeNote } from "./notes";

const img = { width: 400, height: 300 };
const base = { stroke: "#f00", strokeWidth: 2 };
const rect = (id: string, x: number, y: number, w = 40, h = 20, extra: Partial<Shape> = {}): Shape =>
  ({ id, type: "rect", x, y, w, h, callout: Number(id.slice(1)), ...base, ...extra }) as Shape;

describe("note box layout", () => {
  it("picks the image side nearest the shape", () => {
    expect(nearestSide({ x: 10, y: 150 }, img)).toBe("left");
    expect(nearestSide({ x: 390, y: 150 }, img)).toBe("right");
    expect(nearestSide({ x: 200, y: 5 }, img)).toBe("top");
    expect(nearestSide({ x: 200, y: 295 }, img)).toBe("bottom");
  });

  it("places a box outside the image, lined up with the shape", () => {
    const b = placeNote({ x: 0, y: 140, w: 20, h: 20 }, img, { w: 100, h: 30 }, []);
    expect(b).toEqual({ x: -NOTE_GAP - 100, y: 135, w: 100, h: 30 });
    const r = placeNote({ x: 380, y: 140, w: 20, h: 20 }, img, { w: 100, h: 30 }, []);
    expect(r.x).toBe(400 + NOTE_GAP);
  });

  it("stacks boxes on the same side so they never overlap", () => {
    const shapes = [rect("a1", 0, 100), rect("a2", 0, 105), rect("a3", 0, 110)];
    const boxes = [...layoutNotes(shapes, img, () => 15, "x").values()];
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].h + NOTE_STACK_GAP);
    expect(boxes.every((b) => b.x + b.w <= 0)).toBe(true);
  });

  it("keeps a box the user moved/resized and fits its height to the text", () => {
    const s = rect("a1", 10, 10, 40, 20, { label: { x: 500, y: 20, w: 150 }, note: "long" });
    const box = layoutNotes([s], img, (_t, w) => (w < 100 ? 60 : 30), "x").get("a1")!;
    expect(box).toEqual({ x: 500, y: 20, w: 150, h: noteHeight(30) });
    expect(noteHeight(30)).toBe(30 + NOTE_PAD * 2);
    expect(layoutNotes([{ ...s, label: undefined }], img, () => 15, "x").get("a1")!.w).toBe(NOTE_W);
  });

  it("only rects, ellipses and points with a number get boxes", () => {
    expect(hasNoteBox(rect("a1", 0, 0))).toBe(true);
    expect(hasNoteBox({ ...rect("a1", 0, 0), callout: undefined } as Shape)).toBe(false);
    expect(hasNoteBox({ id: "a2", type: "callout", x: 0, y: 0, w: 24, h: 24, callout: 1, ...base })).toBe(false);
  });
});

describe("leader arrow", () => {
  it("ends on a rectangle's edge, an ellipse's outline, or the point", () => {
    expect(leaderTarget({ type: "rect", x: 100, y: 100, w: 50, h: 50 }, { x: 0, y: 125 })).toEqual({ x: 100, y: 125 });
    const e = leaderTarget({ type: "ellipse", x: 100, y: 100, w: 100, h: 50 }, { x: 0, y: 125 });
    expect(e.x).toBeCloseTo(100);
    expect(e.y).toBeCloseTo(125);
    expect(leaderTarget({ type: "point", x: 7, y: 9, w: 0, h: 0 }, { x: 0, y: 0 })).toEqual({ x: 7, y: 9 });
  });

  it("starts on the box edge facing the shape", () => {
    const pts = leader({ type: "point", x: 200, y: 150, w: 0, h: 0 }, { x: -140, y: 135, w: 100, h: 30 });
    expect(pts).toEqual([-40, 150, 200 - POINT_CLEARANCE, 150]);
  });
});
