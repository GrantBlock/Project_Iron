// Pure rules of the markup engine (RUN3 T32), after ../../layout-prototype.html. Everything is in image pixels.
import type { Shape } from "../model";
import type { Point } from "./viewport";

/** Pens, highlighters and added images are in the list without a number or a bubble (Grant 2026-11-15). */
export const isCallout = (s: Pick<Shape, "type">): boolean => s.type !== "pen" && s.type !== "hl";

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
