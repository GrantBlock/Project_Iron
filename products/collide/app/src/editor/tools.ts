// The markup engine's tools (RUN3 T32), after ../../layout-prototype.html: one set for Snip (and Markdown, T34).
export const TOOLS = ["select", "rect", "ellipse", "line", "cross", "point", "pen", "hl", "eraser"] as const;
export type Tool = (typeof TOOLS)[number];

/** Toolbar order: tool, icon, label, hotkey. The eraser's label says what it does. */
export const TOOL_BUTTONS: readonly (readonly [Tool, string, string, string])[] = [
  ["select", "mouse-pointer-2", "Select", "V"],
  ["rect", "square", "Rectangle", "R"],
  ["ellipse", "circle", "Ellipse", "O"],
  ["line", "minus", "Line", "L"],
  ["cross", "x", "X mark", "X"],
  ["point", "map-pin", "Point", "P"],
  ["pen", "pen-line", "Pen", "N"],
  ["hl", "highlighter", "Highlighter", "H"],
  ["eraser", "eraser", "Eraser: removes a whole pen or highlighter stroke", "E"],
];

/** Hotkey (lower-case key) → tool. */
export const TOOL_KEYS: Record<string, Tool> = { v: "select", r: "rect", o: "ellipse", l: "line", x: "cross", p: "point", n: "pen", h: "hl", e: "eraser" };

/** Tools that draw with a colour (picking one brings the last colour back). */
export const drawsWithColor = (t: Tool) => t !== "select" && t !== "eraser";

/** Stroke widths offered in the toolbar, in image pixels (A). */
export const STROKE_WIDTHS = [2, 3, 5] as const;
export const DEFAULT_STROKE_WIDTH = 3;

/** The four annotation colours, the same in every theme (Grant 2026-11-15): light, mid, dark of a material gradient. */
export const MAT = {
  red: ["#EF5350", "#E53935", "#C62828"],
  blue: ["#42A5F5", "#1E88E5", "#1565C0"],
  yellow: ["#FFEE58", "#FDD835", "#F9A825"],
  gray: ["#BDBDBD", "#757575", "#424242"],
} as const;
export type Role = keyof typeof MAT;
export const ROLES: readonly (readonly [Role, string])[] = [
  ["red", "Red"],
  ["blue", "Blue"],
  ["yellow", "Yellow"],
  ["gray", "Gray"],
];
export const DEFAULT_ROLE: Role = "red";
export const isRole = (c: unknown): c is Role => typeof c === "string" && Object.prototype.hasOwnProperty.call(MAT, c);
export const swatchBackground = (r: Role) => `linear-gradient(145deg, ${MAT[r][0]} 0%, ${MAT[r][1]} 55%, ${MAT[r][2]} 100%)`;
/** The paint for a stored colour: a role's mid tone, or an older markup's hex value as it is. */
export const paintOf = (stroke: string) => (isRole(stroke) ? MAT[stroke][1] : stroke);

/** The colour and thickness an editor remembers across reloads (per editor: "snip", later "markdown"). */
export interface PenMemory {
  role: Role;
  stroke: number;
}
const memKey = (editor: string) => `collide-pen-${editor}`;
export function loadPenMemory(editor: string): PenMemory {
  const out: PenMemory = { role: DEFAULT_ROLE, stroke: DEFAULT_STROKE_WIDTH };
  try {
    const raw = JSON.parse(localStorage.getItem(memKey(editor)) ?? "{}") as Partial<PenMemory>;
    if (isRole(raw.role)) out.role = raw.role;
    if (typeof raw.stroke === "number" && (STROKE_WIDTHS as readonly number[]).includes(raw.stroke)) out.stroke = raw.stroke;
  } catch {
    // No storage (private window) or unreadable: the defaults.
  }
  return out;
}
export function savePenMemory(editor: string, m: PenMemory) {
  try {
    localStorage.setItem(memKey(editor), JSON.stringify(m));
  } catch {
    // Not saved: the choice still holds until the window closes.
  }
}
