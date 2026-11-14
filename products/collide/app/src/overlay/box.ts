export interface Point {
  x: number;
  y: number;
}
/** Box in logical px relative to the overlay (= monitor top-left). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalize two drag corners into a box with positive w/h, optionally clamped to bounds. */
export function normalizeBox(a: Point, b: Point, bounds?: { w: number; h: number }): Box {
  let x0 = Math.min(a.x, b.x);
  let y0 = Math.min(a.y, b.y);
  let x1 = Math.max(a.x, b.x);
  let y1 = Math.max(a.y, b.y);
  if (bounds) {
    x0 = Math.min(Math.max(x0, 0), bounds.w);
    y0 = Math.min(Math.max(y0, 0), bounds.h);
    x1 = Math.min(Math.max(x1, 0), bounds.w);
    y1 = Math.min(Math.max(y1, 0), bounds.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface PhysRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Snap values within float noise of an integer (mirrors crop.rs `snap`). */
function snap(v: number): number {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-6 ? r : v;
}

/**
 * Logical box -> physical crop rect clamped to the frame. Port of crop.rs `crop_rect`:
 * floor the near edges, ceil the far edges, clamp. Returns null where Rust errors
 * (invalid input, empty box, fully outside the frame).
 */
export function cropRect(box: Box, scale: number, frameW: number, frameH: number): PhysRect | null {
  const { x, y, w, h } = box;
  if (![x, y, w, h, scale].every(Number.isFinite) || scale <= 0) return null;
  if (w <= 0 || h <= 0) return null;
  const x0 = Math.max(Math.floor(snap(x * scale)), 0);
  const y0 = Math.max(Math.floor(snap(y * scale)), 0);
  const x1 = Math.min(Math.ceil(snap((x + w) * scale)), frameW);
  const y1 = Math.min(Math.ceil(snap((y + h) * scale)), frameH);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Readout text, mono, with the × sign: exactly the size crop_capture will produce. */
export function readout(box: Box, scale: number, frameW: number, frameH: number): string {
  const r = cropRect(box, scale, frameW, frameH);
  return `${r ? r.w : 0} × ${r ? r.h : 0}`;
}

export function isEmptyBox(box: Box): boolean {
  return box.w <= 0 || box.h <= 0;
}
