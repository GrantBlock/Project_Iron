// Pure rules of the markup engine (RUN3 T32), after ../../layout-prototype.html. Everything is in image pixels.
import type { Shape } from "../model";
import type { Point } from "./viewport";
import type { ShapePatch } from "./store";

/** Pens, highlighters and added images are in the list without a number or a bubble (Grant 2026-11-15). */
export const isCallout = (s: Pick<Shape, "type">): boolean => s.type !== "pen" && s.type !== "hl" && s.type !== "image";

/** Gap between the content and an added image (RUN3 T33, as the prototype: 24 image px). */
export const IMAGE_GAP = 24;

/**
 * Where an added image goes (RUN3 T33, Grant 2026-11-15): beside the content, right of the base image and of every
 * image added before, at the top. The canvas grows to fit (the print area).
 * T46 (2.1, Grant 2026-11-19): an added snip is the same size as the original, measured on screen: it keeps its own
 * pixel size, one image pixel per captured pixel like the first snip (it used to be stretched to the base's height).
 */
export function placeBeside(base: { width: number; height: number }, shapes: readonly Shape[], size: { width: number; height: number }): { x: number; y: number; w: number; h: number } {
  const right = Math.max(base.width, ...shapes.filter((s) => s.type === "image").map((s) => s.x + s.w));
  return { x: right + IMAGE_GAP, y: 0, w: Math.round(size.width), h: Math.round(size.height) };
}

/** T46 (3.1): the first snip's name in the list. */
export const BASE_IMAGE_LABEL = "image 1";

/** T46 (3.2): an added image's name in the list, from its file (`image-<n>.png` is "image n+1"), so names stay put. */
export function imageLabel(src: string): string {
  const m = /^image-(\d+)\.png$/.exec(src);
  return m ? `image ${Number(m[1]) + 1}` : "image";
}

/** T46 (3.4): the part of the first snip's file that is shown, in file pixels; no crop = the whole file. */
export function sourceCrop(source: { width: number; height: number; crop?: { x: number; y: number; w: number; h: number } }): { x: number; y: number; width: number; height: number } {
  const c = source.crop;
  if (!c) return { x: 0, y: 0, width: source.width, height: source.height };
  const x = Math.round(c.x * source.width), y = Math.round(c.y * source.height);
  return { x, y, width: Math.max(1, Math.round((c.x + c.w) * source.width) - x), height: Math.max(1, Math.round((c.y + c.h) * source.height) - y) };
}

/** Freehand strokes: the eraser takes them whole. */
export const isStroke = (s: Pick<Shape, "type">): boolean => s.type === "pen" || s.type === "hl";

/**
 * Display numbers: callouts counted from the back (shapes are stored back to front), so a new callout,
 * drawn in front, takes the next number and the existing numbers stay (Grant 2026-11-15).
 */
export function calloutNumbers(shapes: readonly Shape[]): Map<string, number> {
  const out = new Map<string, number>();
  let k = 0;
  for (const s of shapes) if (isCallout(s)) out.set(s.id, ++k);
  return out;
}

/** Fill in percent. Older markups: a filled shape reads as 30 %. */
export const fillPctOf = (s: Shape): number => s.fillPct ?? (s.fill ? 30 : 0);

/** The three card toggles. Older markups: "Hide #" hid the bubble and its arrow. */
export const hiddenOf = (s: Shape) => ({ text: !!s.hideText, bubble: !!(s.hideBubble ?? s.hideNumber), outline: !!s.hideOutline });

/** Shapes with a fill amount on their card. */
export const canFill = (s: Pick<Shape, "type">) => s.type === "rect" || s.type === "ellipse";

/** Points of a line or stroke in image pixels (x, y pairs). */
export function strokePoints(s: Pick<Shape, "x" | "y" | "w" | "h" | "pts">): number[] {
  const p = s.pts ?? [];
  const out: number[] = [];
  for (let i = 0; i + 1 < p.length; i += 2) out.push(s.x + p[i] * s.w, s.y + p[i + 1] * s.h);
  return out;
}

/** A line or stroke from image-pixel points: its box and the points inside it, 0 to 1. */
export function fromPoints(points: readonly Point[]): { x: number; y: number; w: number; h: number; pts: number[] } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  const pts: number[] = [];
  for (const p of points) pts.push(w ? (p.x - x) / w : 0, h ? (p.y - y) / h : 0);
  return { x, y, w, h, pts };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
export const roundPts = (pts: number[]) => pts.map(r6);

function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
function segsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/** Shortest distance between segments ab and cd. */
export function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (segsCross(a, b, c, d)) return 0;
  return Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));
}

/** Pen and highlighter strokes the eraser's move from `a` to `b` touches (within `reach` plus half the stroke). */
export function strokesHit(shapes: readonly Shape[], a: Point, b: Point, reach: number): string[] {
  const hit: string[] = [];
  for (const s of shapes) {
    if (!isStroke(s)) continue;
    const p = strokePoints(s);
    const half = (s.type === "hl" ? highlighterWidth(s.strokeWidth) : s.strokeWidth) / 2;
    let touched = false;
    for (let i = 0; i + 1 < p.length && !touched; i += 2) {
      const c = { x: p[i], y: p[i + 1] };
      const d = i + 3 < p.length ? { x: p[i + 2], y: p[i + 3] } : c;
      if (segmentDistance(a, b, c, d) <= reach + half) touched = true;
    }
    if (touched) hit.push(s.id);
  }
  return hit;
}

/** A highlighter is a wide, see-through stroke (A: four times the line thickness). */
export const highlighterWidth = (stroke: number) => stroke * 4;

/** Space around anything that spills past the image, in image pixels (Grant 2026-11-15: a tight margin). */
export const PRINT_MARGIN = 12;

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The print area: what Copy takes and Fit shows. The image, every shape and every shown note bubble,
 * with PRINT_MARGIN when anything spills past the image.
 */
export function printArea(image: { width: number; height: number }, shapes: readonly Shape[], bubbles: ReadonlyMap<string, Area>): Area {
  let x0 = 0;
  let y0 = 0;
  let x1 = image.width;
  let y1 = image.height;
  const add = (a: number, b: number, c: number, d: number) => {
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
    y1 = Math.max(y1, d);
  };
  for (const s of shapes) {
    const width = s.type === "hl" ? highlighterWidth(s.strokeWidth) : s.strokeWidth;
    const pad = width / 2 + (s.type === "point" ? Math.max(4, s.strokeWidth * 1.5) : 0);
    add(s.x - pad, s.y - pad, s.x + s.w + pad, s.y + s.h + pad);
    const b = bubbles.get(s.id);
    if (b && !hiddenOf(s).bubble) add(b.x, b.y, b.x + b.w, b.y + b.h);
  }
  const spill = x0 < 0 || y0 < 0 || x1 > image.width || y1 > image.height;
  const m = spill ? PRINT_MARGIN : 0;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}

/** Whole pixels of an area, as Copy renders it. */
export function pixelArea(a: Area): { x: number; y: number; width: number; height: number } {
  const x = Math.floor(a.x);
  const y = Math.floor(a.y);
  return { x, y, width: Math.ceil(a.x + a.w) - x, height: Math.ceil(a.y + a.h) - y };
}

/** T39: the whole image, as a crop. */
export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 } as const;
type CropBox = { x: number; y: number; w: number; h: number };
const isFull = (c: CropBox) => Math.abs(c.x) < 1e-6 && Math.abs(c.y) < 1e-6 && Math.abs(c.w - 1) < 1e-6 && Math.abs(c.h - 1) < 1e-6;

/**
 * T39 (Grant 2026-11-17): re-crop an added image. Its scale stays (canvas px per file px) and what stays visible stays
 * where it was: the box moves by the change at the crop's top-left. A crop of the whole file is stored as no crop.
 */
export function cropImage(
  shape: { x: number; y: number; w: number; h: number; crop?: CropBox },
  file: { width: number; height: number },
  next: CropBox,
): { x: number; y: number; w: number; h: number; crop: CropBox | undefined } {
  const o = shape.crop ?? FULL_CROP;
  const sx = shape.w / (o.w * file.width), sy = shape.h / (o.h * file.height);
  return {
    x: Math.round(shape.x + (next.x - o.x) * file.width * sx),
    y: Math.round(shape.y + (next.y - o.y) * file.height * sy),
    w: Math.max(8, Math.round(next.w * file.width * sx)),
    h: Math.max(8, Math.round(next.h * file.height * sy)),
    crop: isFull(next) ? undefined : { ...next },
  };
}

/** T39: the crop in file pixels, for drawing. */
export const cropPixels = (c: CropBox, file: { width: number; height: number }) => ({ x: c.x * file.width, y: c.y * file.height, width: c.w * file.width, height: c.h * file.height });

/** T41: size given to a shape switched from a point or a flat line, so it stays visible (as the prototype: 80 x 50). */
export const DEFAULT_BOX = { w: 80, h: 50 } as const;
/** Below this many image pixels a box side counts as flat (A). */
const FLAT = 2;

/** Types a callout card can switch between. */
export type CardType = "rect" | "ellipse" | "line" | "cross" | "point";

/**
 * T41 (8.1): the patch that switches a callout card's type. Number, note and position stay. A line spans its box
 * corner to corner (two points, adjustable at each end); a line switched back gives the rectangle over its box.
 * A point, or a flat side, gets the default size centred where it was. A point sits at the old box's centre.
 */
export function switchType(s: Shape, to: CardType): ShapePatch {
  if (to === s.type) return {};
  if (to === "point") return { type: to, x: s.x + s.w / 2, y: s.y + s.h / 2, w: 0, h: 0, pts: undefined };
  let { x, y, w, h } = s;
  // A point is drawn at (x, y); a flat side has nothing to show: give them the default size around the centre.
  if (s.type === "point" || w < FLAT) {
    x = (s.type === "point" ? s.x : s.x + s.w / 2) - DEFAULT_BOX.w / 2;
    w = DEFAULT_BOX.w;
  }
  if (s.type === "point" || (to !== "line" && h < FLAT)) {
    y = (s.type === "point" ? s.y : s.y + s.h / 2) - DEFAULT_BOX.h / 2;
    h = DEFAULT_BOX.h;
  }
  return { type: to, x, y, w, h, pts: to === "line" ? [0, 0, 1, 1] : undefined };
}

/** T41 (7.1): a line's two ends in image pixels, where its handles go; null for anything else (arrows keep the Transformer). */
export function lineEnds(s: Shape): [Point, Point] | null {
  if (s.type !== "line") return null;
  const p = strokePoints(s);
  if (p.length < 4) return null;
  return [
    { x: p[0], y: p[1] },
    { x: p[p.length - 2], y: p[p.length - 1] },
  ];
}

/** T41 (7.1): move one end of a line to `p` (image px); the other end stays. */
export function moveLineEnd(s: Shape, end: 0 | 1, p: Point): ShapePatch {
  const e = lineEnds(s);
  if (!e) return {};
  const next: [Point, Point] = end === 0 ? [p, e[1]] : [e[0], p];
  const g = fromPoints(next);
  return { x: g.x, y: g.y, w: g.w, h: g.h, pts: roundPts(g.pts) };
}
