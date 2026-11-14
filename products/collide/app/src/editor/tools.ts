export const TOOLS = ["select", "rect", "ellipse", "point"] as const;
export type Tool = (typeof TOOLS)[number];

/** Hotkey (lower-case key) → tool. */
export const TOOL_KEYS: Record<string, Tool> = { v: "select", r: "rect", o: "ellipse", p: "point" };

/** Stroke widths offered in the toolbar, in image pixels (A). */
export const STROKE_WIDTHS = [2, 3, 5] as const;
export const DEFAULT_STROKE_WIDTH = 3;
