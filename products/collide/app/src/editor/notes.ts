// Callout note boxes: pure layout for the box that sits outside the image and the
// arrow from it to its shape. Everything here is in image pixels.
import type { Shape } from "../model";
import type { Point } from "./viewport";

/** Default note box width (A). */
export const NOTE_W = 200;
/** Narrowest a box can be dragged (A). */
export const NOTE_MIN_W = 80;
/** Gap between the image edge and an auto-placed box (A). */
export const NOTE_GAP = 40;
/** Space between stacked boxes (A). */
export const NOTE_STACK_GAP = 8;
export const NOTE_PAD = 8; // (A)
export const NOTE_FONT = 12; // (A)
export const NOTE_BADGE = 18; // (A)
/** Gap the arrow leaves before a point marker (A). */
export const POINT_CLEARANCE = 7;
/** Space between the badge and the text. */
export const NOTE_BADGE_GAP = 6;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Side = "left" | "right" | "top" | "bottom";

/** Shapes that get a note box + arrow (callout badges, arrows and text keep their older look). */
export const hasNoteBox = (s: Shape): boolean =>
  (s.type === "rect" || s.type === "ellipse" || s.type === "point" || s.type === "cross") && s.callout !== undefined;

/** An empty note is just its number: a chip this wide (and `noteHeight(0)` tall). */
export const NOTE_CHIP_W = NOTE_PAD * 2 + NOTE_BADGE;

/** Width available to the note text inside a box of width `w`. */
export const noteTextWidth = (w: number): number => Math.max(1, w - NOTE_PAD * 2 - NOTE_BADGE - NOTE_BADGE_GAP);

/** Box height that fits text of height `textH` (auto-fit). */
export const noteHeight = (textH: number): number => Math.max(NOTE_BADGE, textH) + NOTE_PAD * 2;

export function shapeCentre(s: Pick<Shape, "x" | "y" | "w" | "h">): Point {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

/** The image edge closest to `p` (ties: left, right, top, bottom). */
export function nearestSide(p: Point, image: { width: number; height: number }): Side {
  const d: [Side, number][] = [
    ["left", p.x],
    ["right", image.width - p.x],
    ["top", p.y],
    ["bottom", image.height - p.y],
  ];
  return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

const overlaps = (a: Box, b: Box, m: number) =>
  a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

/**
 * Auto-place a note box of size `w` x `h` just outside the image on the side nearest the
 * shape, lined up with it, then slid along that side until it clears every box in `taken`.
 */
export function placeNote(
  shape: Pick<Shape, "x" | "y" | "w" | "h">,
  image: { width: number; height: number },
  size: { w: number; h: number },
  taken: readonly Box[],
): Box {
  const c = shapeCentre(shape);
  const side = nearestSide(c, image);
  const { w, h } = size;
  const box: Box =
    side === "left"
      ? { x: -NOTE_GAP - w, y: c.y - h / 2, w, h }
      : side === "right"
        ? { x: image.width + NOTE_GAP, y: c.y - h / 2, w, h }
        : side === "top"
          ? { x: c.x - w / 2, y: -NOTE_GAP - h, w, h }
          : { x: c.x - w / 2, y: image.height + NOTE_GAP, w, h };
  const vertical = side === "left" || side === "right";
  // Each pass moves past one blocker; bounded so a pathological layout cannot spin.
  for (let i = 0; i <= taken.length; i++) {
    const hit = taken.find((t) => overlaps(box, t, NOTE_STACK_GAP));
    if (!hit) break;
    if (vertical) box.y = hit.y + hit.h + NOTE_STACK_GAP;
    else box.x = hit.x + hit.w + NOTE_STACK_GAP;
  }
  return box;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where the arrow from `from` meets the shape: its outline (rect, ellipse) or the point itself. */
export function leaderTarget(s: Pick<Shape, "type" | "x" | "y" | "w" | "h">, from: Point): Point {
  if (s.type === "ellipse") {
    const c = shapeCentre(s);
    const rx = s.w / 2;
    const ry = s.h / 2;
    const dx = from.x - c.x;
    const dy = from.y - c.y;
    if (rx <= 0 || ry <= 0 || (dx === 0 && dy === 0)) return c;
    const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
    return t >= 1 ? from : { x: c.x + dx * t, y: c.y + dy * t };
  }
  if (s.type === "point") return { x: s.x, y: s.y };
  // An X has nothing at its box edges; point at where its legs cross.
  if (s.type === "cross") return shapeCentre(s);
  return { x: clamp(from.x, s.x, s.x + s.w), y: clamp(from.y, s.y, s.y + s.h) };
}

/** Arrow from the note box to its shape: [x1, y1, x2, y2], or null when the box covers the target. */
export function leader(s: Pick<Shape, "type" | "x" | "y" | "w" | "h">, box: Box): [number, number, number, number] | null {
  const boxC = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  let to = leaderTarget(s, boxC);
  const from = { x: clamp(to.x, box.x, box.x + box.w), y: clamp(to.y, box.y, box.y + box.h) };
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < 4) return null;
  // Stop short of a point so the arrowhead does not cover the marker.
  if (s.type === "point" && len > POINT_CLEARANCE * 2) {
    const k = (len - POINT_CLEARANCE) / len;
    to = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  }
  return [from.x, from.y, to.x, to.y];
}

/** Size of a shape's note box at width `w`: a number chip when the note is empty, else fitted to the text. */
export function noteSize(s: Shape, w: number | undefined, measure: (text: string, width: number) => number): { w: number; h: number } {
  const note = s.note?.trim();
  if (!note) return { w: NOTE_CHIP_W, h: noteHeight(0) };
  const width = w ?? NOTE_W;
  return { w: width, h: noteHeight(measure(note, noteTextWidth(width))) };
}

/**
 * Boxes for every shape with a note box, in shape order. A box the user moved/resized
 * keeps its stored `label`; others are auto-placed clear of the ones before them.
 * `measure(text, width)` returns the wrapped text height.
 */
export function layoutNotes(
  shapes: readonly Shape[],
  image: { width: number; height: number },
  measure: (text: string, width: number) => number,
): Map<string, Box> {
  const out = new Map<string, Box>();
  const taken: Box[] = [];
  for (const s of shapes) {
    if (!hasNoteBox(s)) continue;
    const { w, h } = noteSize(s, s.label?.w, measure);
    const box = s.label ? { x: s.label.x, y: s.label.y, w, h } : placeNote(s, image, { w, h }, taken);
    out.set(s.id, box);
    taken.push(box);
  }
  return out;
}
