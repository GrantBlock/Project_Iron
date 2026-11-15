// T14: crop maths for a snip, ported from the Rust shell's crop.rs. Pure TypeScript:
// no Electron, no DOM. The main process uses it to crop the held frame
// (src/native/capture.ts).
//
// Coordinate spaces: the overlay is fullscreen on the captured monitor, so the
// incoming x/y/w/h are logical (CSS) px relative to the overlay window, i.e.
// relative to the monitor's top-left. The held frame is monitor-local physical
// px. So `physical = logical * scale`, and the monitor's virtual-desktop origin
// (negative for monitors left of / above the primary) is NOT subtracted: the
// incoming coordinates are never global. Passing global coordinates is a caller bug.

/** Box in logical px, relative to the overlay window (top-left origin). */
export interface LogicalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Box in monitor-local physical px, already clamped to the frame. */
export interface PhysicalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropErrorKind = "NoCapture" | "EmptyBox" | "OutsideFrame" | "InvalidInput" | "Encode" | "StateUnavailable";

function cropMessage(kind: CropErrorKind, detail: string): string {
  switch (kind) {
    case "NoCapture":
      return "No capture to crop — start a new snip.";
    case "EmptyBox":
      return "The selection has no width or height — drag a larger box and release again.";
    case "OutsideFrame":
      return "The selection is outside the captured screen — drag a box over the screen and release again.";
    case "InvalidInput":
      return "The selection or display scale is not a valid number — start a new snip.";
    case "Encode":
      return `Could not encode the cropped image as PNG — try again; if it repeats, restart Collide. (${detail})`;
    case "StateUnavailable":
      // Kept for parity with the Rust type (a poisoned mutex); nothing in the Node port raises it.
      return "Capture state is locked by a failed earlier capture — restart Collide.";
  }
}

/** Typed crop failure. `message` is the cause plus the fix, the same text the Rust shell sent. */
export class CropError extends Error {
  readonly kind: CropErrorKind;
  readonly detail: string;

  constructor(kind: CropErrorKind, detail = "") {
    super(cropMessage(kind, detail));
    this.name = "CropError";
    this.kind = kind;
    this.detail = detail;
  }
}

/** Snap values within float noise of an integer (e.g. 0.8 * 1.25 = 1.0000000000000002). */
function snap(v: number): number {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-6 ? r : v;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Logical box -> physical box clamped to a `frameW` x `frameH` frame.
 *
 * Rounding rule: scale first, then floor the near edges (x, y) and ceil the far
 * edges (x + w, y + h), so the crop never loses a partly-covered pixel. Edges are
 * derived from the scaled origin and far edge, not from a rounded width.
 *
 * Throws a `CropError`: `InvalidInput`, `EmptyBox` or `OutsideFrame`.
 */
export function cropRect(logical: LogicalRect, scale: number, frameW: number, frameH: number): PhysicalRect {
  // The box crosses a process boundary (page -> main), so its shape is checked, not trusted.
  const { x, y, w, h } = (logical ?? {}) as Partial<LogicalRect>;
  if (![x, y, w, h, scale].every(isFiniteNumber) || scale <= 0) {
    throw new CropError("InvalidInput");
  }
  const box = { x: x as number, y: y as number, w: w as number, h: h as number };
  if (box.w <= 0 || box.h <= 0) {
    throw new CropError("EmptyBox");
  }
  const x0 = Math.max(Math.floor(snap(box.x * scale)), 0);
  const y0 = Math.max(Math.floor(snap(box.y * scale)), 0);
  const x1 = Math.min(Math.ceil(snap((box.x + box.w) * scale)), frameW);
  const y1 = Math.min(Math.ceil(snap((box.y + box.h) * scale)), frameH);
  if (x1 <= x0 || y1 <= y0) {
    throw new CropError("OutsideFrame");
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
