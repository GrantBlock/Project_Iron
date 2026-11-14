// Pure geometry for the drawing tools. Everything here is in image pixels.
import type { NewShape } from "./store";
import type { Point } from "./viewport";

export type DrawTool = "rect" | "ellipse" | "arrow";

/** Diameter of a callout badge in image pixels (A). */
export const BADGE_SIZE = 24;
/** Default text size in image pixels (A). */
export const DEFAULT_FONT_SIZE = 16;
/** A drag shorter than this many screen pixels in both axes is a click, not a shape (A). */
export const MIN_DRAG_SCREEN_PX = 6;

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalised bounds of a drag between two points, whichever direction it went. */
export function dragBounds(a: Point, b: Point): Bounds {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/** True when a drag is big enough (on screen, at the given zoom) to create a shape. */
export function isRealDrag(a: Point, b: Point, scale: number): boolean {
  return Math.abs(b.x - a.x) * scale >= MIN_DRAG_SCREEN_PX || Math.abs(b.y - a.y) * scale >= MIN_DRAG_SCREEN_PX;
}

export interface Style {
  stroke: string;
  strokeWidth: number;
}

/** Build the shape a drag from `a` to `b` draws. Arrows keep their direction in `points`. */
export function shapeFromDrag(tool: DrawTool, a: Point, b: Point, style: Style): NewShape {
  const bounds = dragBounds(a, b);
  if (tool === "arrow") {
    return {
      type: "arrow",
      ...bounds,
      ...style,
      points: [a.x - bounds.x, a.y - bounds.y, b.x - bounds.x, b.y - bounds.y],
    };
  }
  return { type: tool, ...bounds, ...style };
}

/** A callout badge centred on a click. */
export function calloutAt(p: Point, style: Style): NewShape {
  return { type: "callout", x: p.x - BADGE_SIZE / 2, y: p.y - BADGE_SIZE / 2, w: BADGE_SIZE, h: BADGE_SIZE, ...style };
}

/** Text box with its top-left at a click. `size` is the measured text size. */
export function textAt(p: Point, text: string, size: { w: number; h: number }, style: Style, fontSize = DEFAULT_FONT_SIZE): NewShape {
  return { type: "text", x: p.x, y: p.y, w: size.w, h: size.h, ...style, text, fontSize };
}

/** Scale arrow end points when its bounds change from `from` to `to`. Zero-size axes stay unscaled. */
export function scalePoints(points: [number, number, number, number], from: Bounds, to: Bounds): [number, number, number, number] {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return [points[0] * sx, points[1] * sy, points[2] * sx, points[3] * sy];
}

/** What a Transformer leaves on a node, relative to its shape's group: node offset and scale. */
export interface NodeTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Convert the result of a Transformer resize into a shape patch (image pixels).
 * Group origin = shape.x/y; the node sat at its base offset (0,0 for rect/arrow/text, the centre for ellipse)
 * before the resize, so `t.x/t.y` is the new offset of that same reference point.
 * `measure` sizes text at a font size.
 */
export function resizeShape(
  shape: { type: string; x: number; y: number; w: number; h: number; points?: [number, number, number, number]; fontSize?: number; text?: string },
  t: NodeTransform,
  measure: (text: string, fontSize: number) => { w: number; h: number },
): { x: number; y: number; w: number; h: number; points?: [number, number, number, number]; fontSize?: number } {
  const sx = Math.abs(t.scaleX);
  const sy = Math.abs(t.scaleY);
  if (shape.type === "text") {
    const fontSize = (shape.fontSize ?? DEFAULT_FONT_SIZE) * sy;
    const size = measure(shape.text ?? "", fontSize);
    return { x: shape.x + t.x, y: shape.y + t.y, ...size, fontSize };
  }
  const w = shape.w * sx;
  const h = shape.h * sy;
  if (shape.type === "ellipse") {
    return { x: shape.x + t.x - w / 2, y: shape.y + t.y - h / 2, w, h };
  }
  const x = shape.x + t.x;
  const y = shape.y + t.y;
  if (shape.type === "arrow" && shape.points) {
    return { x, y, w, h, points: scalePoints(shape.points, shape, { x, y, w, h }) };
  }
  return { x, y, w, h };
}
