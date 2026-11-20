// T50 (Grant 2026-11-20): the full app's minimum window size, the window's content size (the page area) in CSS px
// at page zoom 1 (= window units, DIP). Measured with Playwright from the real layout (Hrongar, ISSUES 61): the
// viewport was stepped down one px at a time until something no longer fitted.
// - Width 1197: the Markdown toolbar's first row needs 921 px without scrolling across, plus the 276 px sidebar
//   (--side-w). The Snip toolbar needs 842 (1118 window), the PDF toolbar fits at 1197; the header goes icon-only
//   on its own measured width, so it never sets the width.
// - Height 415: the smallest at which the callout panel shows its first callout whole without its list scrolling
//   (A), with a 1197 px window. The sidebar's own content needs 307, the toolbar and header fit far lower.
// electron/main.cjs gives these to the editor window (useContentSize, minWidth, minHeight); collapse.ts lifts them
// for the compact view and puts them back on Expand.

/** The full view's minimum page-area width, CSS px. */
export const MIN_WIDTH = 1197;
/** The full view's minimum page-area height, CSS px. */
export const MIN_HEIGHT = 415;

type Box = { x: number; y: number; width: number; height: number };

/**
 * T50 review (A): on a small or high-scaling screen the minimum can be larger than the work area. The window's
 * minimum (whole window, Electron's setMinimumSize) is the content minimum plus the frame, but never more than the
 * work area per side.
 */
export function fitMinimum(frame: { width: number; height: number }, area: Box, min = { width: MIN_WIDTH, height: MIN_HEIGHT }): [number, number] {
  return [Math.min(min.width + frame.width, area.width), Math.min(min.height + frame.height, area.height)];
}

/** Bounds moved and, if needed, shrunk to lie inside the work area; null when they already fit. */
export function fitBounds(b: Box, area: Box): Box | null {
  const width = Math.min(b.width, area.width);
  const height = Math.min(b.height, area.height);
  const x = Math.max(area.x, Math.min(b.x, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(b.y, area.y + area.height - height));
  return x === b.x && y === b.y && width === b.width && height === b.height ? null : { x, y, width, height };
}

/** What a window needs for fitWindow: Electron's BrowserWindow has all of these. */
export interface FitWindow {
  getBounds(): Box;
  getContentBounds(): Box;
  setBounds(b: Box): void;
  setMinimumSize(width: number, height: number): void;
}

/** The full view's minimum on a window: inside its work area, minimum = min(MIN + frame, work area) per side. */
export function fitWindow(w: FitWindow, area: Box, min = { width: MIN_WIDTH, height: MIN_HEIGHT }): void {
  const b = w.getBounds();
  const c = w.getContentBounds();
  const frame = { width: Math.max(0, b.width - c.width), height: Math.max(0, b.height - c.height) };
  const [mw, mh] = fitMinimum(frame, area, min);
  // Lower the minimum first, so a window being fitted to a small screen is not held up by it.
  w.setMinimumSize(mw, mh);
  const fitted = fitBounds(b, area);
  if (fitted) w.setBounds(fitted);
}
