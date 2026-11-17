import { describe, expect, it } from "vitest";
import type { Shape } from "../model";
import { hasNoteBox, layoutNotes, leader, leaderTarget, nearestSide, NOTE_GAP, NOTE_PAD, NOTE_CHIP_W, NOTE_STACK_GAP, NOTE_TILT, NOTE_W, noteSize, POINT_CLEARANCE, noteHeight, placeNote, snapNote } from "./notes";

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

  it("places a box outside the image, off the shape's centre line (box above the line, angled leader)", () => {
    const b = placeNote({ x: 0, y: 140, w: 20, h: 20 }, img, { w: 100, h: 30 }, []);
    expect(b).toEqual({ x: -NOTE_GAP - 100, y: 135 - NOTE_TILT, w: 100, h: 30, side: "left" });
    const [x1, y1, x2, y2] = leader({ type: "rect", x: 0, y: 140, w: 20, h: 20 }, b)!;
    const deg = (Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * 180) / Math.PI;
    expect(deg).toBeGreaterThan(10);
    expect(deg).toBeLessThan(30);
    const r = placeNote({ x: 380, y: 140, w: 20, h: 20 }, img, { w: 100, h: 30 }, []);
    expect(r.x).toBe(400 + NOTE_GAP);
  });

  it("stacks boxes beside each other (right, bottom, top or left) so they never overlap, off the image", () => {
    const shapes = [rect("a1", 0, 100), rect("a2", 0, 105), rect("a3", 0, 110)];
    const boxes = [...layoutNotes(shapes, img, () => 15).values()];
    const apart = (a: (typeof boxes)[number], b: (typeof boxes)[number]) =>
      a.x + a.w + NOTE_STACK_GAP <= b.x || b.x + b.w + NOTE_STACK_GAP <= a.x || a.y + a.h + NOTE_STACK_GAP <= b.y || b.y + b.h + NOTE_STACK_GAP <= a.y;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(apart(boxes[i], boxes[j])).toBe(true);
    expect(boxes.every((b) => b.x + b.w <= 0 || b.y + b.h <= 0 || b.y >= img.height)).toBe(true);
  });

  it("a dropped box snaps beside a nearby box, edges lined up; far away it stays", () => {
    const other = { x: 0, y: 0, w: 100, h: 30 };
    expect(snapNote({ x: 110, y: 3, w: 80, h: 30 }, [other], 10)).toEqual({ x: 100 + NOTE_STACK_GAP, y: 0 });
    expect(snapNote({ x: 2, y: 40, w: 80, h: 30 }, [other], 10)).toEqual({ x: 0, y: 30 + NOTE_STACK_GAP });
    expect(snapNote({ x: 300, y: 300, w: 80, h: 30 }, [other], 10)).toBeNull();
  });

  it("keeps a box the user moved/resized and fits its height to the text", () => {
    const s = rect("a1", 10, 10, 40, 20, { label: { x: 500, y: 20, w: 150 }, note: "long" });
    const box = layoutNotes([s], img, (_t, w) => (w < 100 ? 60 : 30)).get("a1")!;
    expect(box).toEqual({ x: 500, y: 20, w: 150, h: noteHeight(30) });
    expect(noteHeight(30)).toBe(30 + NOTE_PAD * 2);
    expect(layoutNotes([{ ...s, label: undefined }], img, () => 15).get("a1")!.w).toBe(NOTE_W);
  });

  it("an empty note is a number chip (so the number and arrow still show); typing grows it to a box", () => {
    const s = rect("a1", 10, 140);
    expect(noteSize(s, 150, () => 15)).toEqual({ w: NOTE_CHIP_W, h: noteHeight(0) });
    expect(noteSize({ ...s, note: "  " } as Shape, 150, () => 15).w).toBe(NOTE_CHIP_W);
    expect(noteSize({ ...s, note: "hi" } as Shape, 150, () => 15)).toEqual({ w: 150, h: noteHeight(15) });
    expect(noteSize({ ...s, note: "hi" } as Shape, undefined, () => 15).w).toBe(NOTE_W);
  });

  it("callout shapes get boxes (numbers come from the order, T32); pens and old badges do not", () => {
    expect(hasNoteBox(rect("a1", 0, 0))).toBe(true);
    expect(hasNoteBox({ ...rect("a1", 0, 0), callout: undefined } as Shape)).toBe(true);
    expect(hasNoteBox({ ...rect("a1", 0, 0), type: "line", pts: [0, 0, 1, 1] } as Shape)).toBe(true);
    expect(hasNoteBox({ ...rect("a1", 0, 0), type: "pen", pts: [0, 0, 1, 1] } as Shape)).toBe(false);
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
    expect(leaderTarget({ type: "cross", x: 100, y: 100, w: 80, h: 40 }, { x: 0, y: 0 })).toEqual({ x: 140, y: 120 });
  });

  it("starts on the box edge facing the shape", () => {
    const pts = leader({ type: "point", x: 200, y: 150, w: 0, h: 0 }, { x: -140, y: 135, w: 100, h: 30 });
    expect(pts).toEqual([-40, 150, 200 - POINT_CLEARANCE, 150]);
  });
});
