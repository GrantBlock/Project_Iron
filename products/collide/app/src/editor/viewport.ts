// Zoom/pan math for the editor canvas. A View maps image pixels to screen pixels:
//   screen = image * scale + (x, y)
// Screen coordinates are relative to the canvas container's top-left.

export interface View {
  scale: number;
  x: number;
  y: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.1; // 10% (A)
export const MAX_SCALE = 8; // 800% (A)
const WHEEL_SENSITIVITY = 0.0015; // (A) zoom factor per wheel delta unit, exponential

export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export const screenToImage = (v: View, p: Point): Point => ({ x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale });
export const imageToScreen = (v: View, p: Point): Point => ({ x: p.x * v.scale + v.x, y: p.y * v.scale + v.y });

/** Zoom to `nextScale` (clamped) keeping the image point under `cursor` fixed on screen. */
export function zoomAt(v: View, cursor: Point, nextScale: number): View {
  const scale = clampScale(nextScale);
  const anchor = screenToImage(v, cursor);
  return { scale, x: cursor.x - anchor.x * scale, y: cursor.y - anchor.y * scale };
}

/** Multiplicative zoom factor for a wheel `deltaY` (negative deltaY zooms in). */
export const wheelFactor = (deltaY: number): number => Math.exp(-deltaY * WHEEL_SENSITIVITY);

export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, x: v.x + dx, y: v.y + dy });

/** Scale an image to fit the container (never above 100%), centred, with padding. */
export function fitView(container: Size, image: Size, padding = 48): View {
  const availW = Math.max(1, container.width - padding * 2);
  const availH = Math.max(1, container.height - padding * 2);
  const scale = clampScale(Math.min(1, availW / image.width, availH / image.height));
  return {
    scale,
    x: (container.width - image.width * scale) / 2,
    y: (container.height - image.height * scale) / 2,
  };
}
