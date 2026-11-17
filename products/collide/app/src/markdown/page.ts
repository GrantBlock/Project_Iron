// The Markdown page as a markup surface (RUN3 T34), after ../../../layout-prototype.html (fitPage, the Ctrl + wheel
// zoom): a fixed-width page in page pixels with room beside, above and below it for bubbles; shapes can start in
// that margin (negative page pixels). Fit scales the page and its side room to the pane, at most 100%.
import { clampScale, zoomAt, type Point, type Size, type View } from "../editor/viewport";

/** Page width in page pixels (the prototype's PAGE_W). */
export const PAGE_W = 680;
/** Room beside and above the page at Fit, in page pixels. */
export const PAGE_SIDE = 210;
export const PAGE_TOP = 90;
/** Space the pane keeps free at Fit, in screen pixels. */
const PANE_PAD = 44;
/** One Ctrl + wheel notch or Ctrl+= / Ctrl+−: 10% (the prototype's step). */
export const ZOOM_STEP = 1.1;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

/** The fitted view: the page centred across, its top margin at the top. */
export function fitPage(pane: Size): View {
  const k = clampScale(Math.min(1, (pane.width - PANE_PAD) / (PAGE_W + 2 * PAGE_SIDE)));
  return { scale: k, x: (pane.width - PAGE_W * k) / 2, y: PAGE_TOP * k };
}

/** Zoom by `steps` notches (positive = in) around `at` (pane pixels): the page pixel under it stays there. */
export function zoomPage(v: View, at: Point, steps: number): View {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * ZOOM_STEP ** steps));
  return zoomAt(v, at, next);
}

/**
 * Scroll (a plain wheel) by screen pixels. The page can go up until its end (plus the bottom margin) reaches the
 * bottom of the pane, and down until its top margin shows; across, it keeps some of the page in view.
 */
export function scrollPage(v: View, pane: Size, pageH: number, dx: number, dy: number): View {
  const k = v.scale;
  const top = PAGE_TOP * k;
  const bottom = Math.min(top, pane.height - (pageH + PAGE_TOP) * k);
  const left = pane.width - (PAGE_W + PAGE_SIDE) * k;
  const right = PAGE_SIDE * k;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const x = (PAGE_W + 2 * PAGE_SIDE) * k <= pane.width ? v.x : clamp(v.x - dx, left, right);
  return { ...v, x, y: clamp(v.y - dy, bottom, top) };
}
