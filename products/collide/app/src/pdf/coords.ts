// RUN3 T38: coordinates of a PDF page. The PDF editor keeps every item in page points as the page is shown:
// one unit is one PDF point (1/72 inch), (0, 0) is the shown page's top-left corner and y runs down, after the
// page's own rotation (/Rotate), exactly as pdf.js lays the page out at scale 1. The canvas's view maps those
// points to the screen (screen = points × zoom + pan), so the markup stays on the same spot at any zoom.
// Export maps the same points into the PDF's own space (origin bottom-left, y up, before the rotation).
import { imageToScreen, screenToImage, type Point, type View } from "../editor/viewport";

/** The page box the viewer shows (the CropBox), in PDF user space, before the rotation. */
export interface PdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A page rotation, as PDF allows it: a multiple of 90 degrees, clockwise when shown. */
export type Turn = 0 | 90 | 180 | 270;

/** Any /Rotate value as one of the four turns (negative and over-turned values wrap; anything else is 0). */
export function normalTurn(deg: number): Turn {
  if (!Number.isFinite(deg) || deg % 90 !== 0) return 0;
  return (((deg % 360) + 360) % 360) as Turn;
}

/** The page's size as shown, in points: a quarter turn swaps width and height. */
export function shownSize(box: PdfBox, turn: Turn): { width: number; height: number } {
  return turn === 90 || turn === 270 ? { width: box.height, height: box.width } : { width: box.width, height: box.height };
}

/**
 * The frame that draws shown points into the PDF: a shown point (u, v) is (u, −v) turned by `angle` degrees
 * (counter-clockwise, PDF's sense) about `origin`. pdf-lib's drawSvgPath and drawText take exactly this
 * (`x`, `y`, `rotate`), so every item is drawn upright on the shown page.
 */
export interface PdfFrame {
  origin: Point;
  angle: Turn;
}

export function pageFrame(box: PdfBox, turn: Turn): PdfFrame {
  const { x, y, width: w, height: h } = box;
  switch (turn) {
    case 90:
      return { origin: { x, y }, angle: 90 };
    case 180:
      return { origin: { x: x + w, y }, angle: 180 };
    case 270:
      return { origin: { x: x + w, y: y + h }, angle: 270 };
    default:
      return { origin: { x, y: y + h }, angle: 0 };
  }
}

const COS: Record<Turn, number> = { 0: 1, 90: 0, 180: -1, 270: 0 };
const SIN: Record<Turn, number> = { 0: 0, 90: 1, 180: 0, 270: -1 };

/** A shown point (points, y down) in PDF user space (y up, before the rotation). */
export function toPdf(frame: PdfFrame, p: Point): Point {
  const c = COS[frame.angle];
  const s = SIN[frame.angle];
  // (u, −v) turned by the angle, then moved to the origin.
  return { x: frame.origin.x + p.x * c + p.y * s, y: frame.origin.y + p.x * s - p.y * c };
}

/** A PDF user-space point as a shown point: the inverse of {@link toPdf}. */
export function fromPdf(frame: PdfFrame, q: Point): Point {
  const c = COS[frame.angle];
  const s = SIN[frame.angle];
  const dx = q.x - frame.origin.x;
  const dy = q.y - frame.origin.y;
  return { x: dx * c + dy * s, y: dx * s - dy * c };
}

/** A shown point (PDF points) on the screen at this view: the canvas's own mapping, named for the PDF page. */
export const pointsToScreen = (view: View, p: Point): Point => imageToScreen(view, p);
/** A screen point (canvas pixels) in shown PDF points at this view. */
export const screenToPoints = (view: View, p: Point): Point => screenToImage(view, p);
