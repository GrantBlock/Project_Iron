// The reference test hook (RUN3 T30): what `window.__collide.state()` returns.
// The prototype (../../layout-prototype.html) returns the same shape; see ../../prototype-checks/HOOK.md.
// Read-only and cheap: a fresh plain JSON object built from the editor's real state.
// Concepts the app does not have yet are null or []; the task that builds each one fills it in.
import type { Shape } from "../model";

export interface RefItem {
  id: string;
  type: string;
  /** Display number; null for items without one. */
  number: number | null;
  note: string;
  hidden: { text: boolean; bubble: boolean; outline: boolean };
  /** Fill, percent 0 to 100. */
  fill: number;
  color: string | null;
  stroke: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pen and highlighter strokes: how many points. */
  points: number | null;
  /** The note bubble as placed; `moved` = the user dropped it there. */
  bubble: { x: number; y: number; w: number; h: number; moved: boolean } | null;
}

export interface RefState {
  version: 1;
  view: "blank" | "snip" | "markdown" | "image" | "file" | "settings";
  mode: "edit" | "preview" | null;
  tabs: { id: string; title: string; kind: RefState["view"]; dirty: boolean; active: boolean }[];
  editor: "snip" | "markdown" | null;
  activeTool: string | null;
  color: string | null;
  stroke: number | null;
  /** Front to back. */
  items: RefItem[];
  selection: string[];
  zoom: { percent: number; fit: boolean } | null;
  theme: string | null;
  aura: string | null;
  sidebar: { delay: string | null; addMode: string | null; collapsed: boolean | null };
  splash: { kind: "close" | "delete"; title: string } | null;
}

/** What the editor shell hands over: its state as it is right now. */
export interface RefInput {
  /** The open image, or null on the empty canvas. */
  image: { name: string } | null;
  /** Shapes in draw order (back to front), as stored. */
  shapes: readonly Shape[];
  selectedId: string | null;
  tool: string;
  /** The toolbar colour as stored (a design-system token or a hex value). */
  color: string;
  strokeWidth: number;
  /** View scale (1 = 100%) and whether it is fitted to the window. */
  scale: number;
  fitted: boolean;
  /** New snip delay in seconds (0 = none). */
  snipDelay: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The prototype's words for the delay: "No delay", "3 s", "5 s", "10 s". */
export const delayLabel = (seconds: number): string => (seconds > 0 ? `${seconds} s` : "No delay");

function item(s: Shape): RefItem {
  return {
    id: s.id,
    type: s.type,
    number: s.callout ?? null,
    note: s.note ?? "",
    // The app has one toggle today, "Hide #": the note box and its arrow.
    hidden: { text: false, bubble: !!s.hideNumber, outline: false },
    fill: s.fill ? 100 : 0,
    color: s.stroke,
    stroke: s.strokeWidth,
    x: r2(s.x),
    y: r2(s.y),
    w: r2(s.w),
    h: r2(s.h),
    points: null,
    bubble: null,
  };
}

export function refState(i: RefInput): RefState {
  const open = i.image !== null;
  return {
    version: 1,
    view: open ? "snip" : "blank",
    mode: null,
    tabs: [],
    editor: open ? "snip" : null,
    activeTool: open ? i.tool : null,
    color: open ? i.color : null,
    stroke: open ? i.strokeWidth : null,
    items: open ? [...i.shapes].reverse().map(item) : [],
    selection: open && i.selectedId !== null ? [i.selectedId] : [],
    zoom: open ? { percent: Math.round(i.scale * 100), fit: i.fitted } : null,
    theme: null,
    aura: null,
    sidebar: { delay: delayLabel(i.snipDelay), addMode: null, collapsed: null },
    splash: null,
  };
}
