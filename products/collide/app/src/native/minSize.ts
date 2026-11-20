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
