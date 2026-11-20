// The reference test hook (RUN3 T30): what `window.__collide.state()` returns.
// The prototype (../../layout-prototype.html) returns the same shape; see ../../prototype-checks/HOOK.md.
// Read-only and cheap: a fresh plain JSON object built from the shell's and the open editor's real state.
// Concepts the app does not have yet are null or []; the task that builds each one fills it in
// (T31: tabs, view, theme, sidebar and splash; the items are still the old engine's until T32).
import type { Shape } from "../model";
import { calloutNumbers, fillPctOf, hiddenOf } from "./engine";
import { isRole, type Role } from "./tools";
import { AURA_GROUNDS, THEMES, groundInUse, type AuraGround, type Theme } from "../shell/prefs";

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
  view: "blank" | "snip" | "markdown" | "pdf" | "image" | "file" | "settings";
  mode: "edit" | "preview" | null;
  tabs: { id: string; title: string; kind: RefState["view"]; dirty: boolean; active: boolean }[];
  editor: "snip" | "markdown" | "pdf" | null;
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
  /** RUN3 T38, app only (the prototype has no PDF): the PDF tab in front, its page (from 0) and how many it has. */
  pdf: { pageIndex: number; pageCount: number } | null;
}

/** What the open Snip editor hands over: its state as it is right now. */
export interface RefInput {
  /** The open image. */
  image: { name: string } | null;
  /** Shapes in draw order (back to front), as stored. */
  shapes: readonly Shape[];
  selectedId: string | null;
  tool: string;
  /** The pressed colour; null after a draw. */
  color: Role | null;
  strokeWidth: number;
  /** View scale (1 = 100%) and whether it is fitted to the window. */
  scale: number;
  fitted: boolean;
  /** Where each callout's bubble is (image px). */
  bubbles?: BubbleMap;
}

/** What the open Markdown editor hands over (T34): shapes in page pixels; the view only in Preview. */
export interface MdRefInput {
  mode: "edit" | "preview";
  shapes: readonly Shape[];
  selectedId: string | null;
  tool: string;
  color: Role | null;
  strokeWidth: number;
  /** Preview's zoom; null in Edit. */
  scale: number | null;
  fitted: boolean;
  bubbles?: BubbleMap;
}

/** What the open PDF editor hands over (RUN3 T38): the page in front's items in PDF points, and the page. */
export interface PdfRefInput {
  pageIndex: number;
  pageCount: number;
  shapes: readonly Shape[];
  selectedId: string | null;
  tool: string;
  color: Role | null;
  strokeWidth: number;
  scale: number;
  fitted: boolean;
  bubbles?: BubbleMap;
}

/** What the layout shell hands over (T31). */
export interface ShellRefInput {
  /** Left to right. */
  tabs: readonly { id: string; title: string; kind: Exclude<RefState["view"], "blank">; dirty: boolean }[];
  /** Id of the tab in front, or null on the blank canvas. */
  active: string | null;
  /** The theme as chosen: "system", "light", "dark" or "aura". */
  theme: string;
  aura: string;
  /** The computer asks for dark (Match system); absent = dark, as without matchMedia. */
  systemDark?: boolean;
  /** New snip delay in seconds (0 = none). */
  snipDelay: number;
  addMode: string;
  collapsed: boolean;
  splash: RefState["splash"];
}

/** The Aura ground in use, or null when the look is not Aura (T52: Match system on a light computer is "paper"). */
function auraInUse(shell: ShellRefInput): string | null {
  const known = (THEMES as readonly string[]).includes(shell.theme) && (AURA_GROUNDS as readonly string[]).includes(shell.aura);
  if (!known) return shell.theme === "aura" ? shell.aura : null;
  return groundInUse(shell.theme as Theme, shell.aura as AuraGround, shell.systemDark ?? true);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The prototype's words for the delay: "No delay", "3 s", "5 s", "10 s". */
export const delayLabel = (seconds: number): string => (seconds > 0 ? `${seconds} s` : "No delay");

/** Bubble boxes as placed (image px), from the editor's layout; absent when the editor has none. */
export type BubbleMap = ReadonlyMap<string, { x: number; y: number; w: number; h: number }>;

function item(s: Shape, number: number | null, bubbles: BubbleMap | undefined): RefItem {
  const b = number !== null ? bubbles?.get(s.id) : undefined;
  return {
    id: s.id,
    type: s.type,
    number,
    note: s.note ?? "",
    hidden: hiddenOf(s),
    fill: fillPctOf(s),
    color: s.type === "image" ? null : isRole(s.stroke) || s.stroke.startsWith("#") ? s.stroke : null,
    stroke: s.type === "image" ? null : s.strokeWidth,
    x: r2(s.x),
    y: r2(s.y),
    w: r2(s.w),
    h: r2(s.h),
    points: s.pts && (s.type === "pen" || s.type === "hl") ? s.pts.length / 2 : null,
    bubble: b ? { x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h), moved: !!s.label } : null,
  };
}

function items(shapes: readonly Shape[], bubbles: BubbleMap | undefined): RefItem[] {
  const numbers = calloutNumbers(shapes);
  return [...shapes].reverse().map((s) => item(s, numbers.get(s.id) ?? null, bubbles));
}

/** `editor` is the Snip editor of the tab in front, or null when that tab is not a snip (or nothing is open). */
/**
 * `editor` is the Snip editor of the tab in front, or null when that tab is not a snip (or nothing is open);
 * `md` the Markdown editor of the tab in front (T34).
 */
export function refState(shell: ShellRefInput, editor: RefInput | null, md: MdRefInput | null = null, pdfEditor: PdfRefInput | null = null): RefState {
  const front = shell.tabs.find((t) => t.id === shell.active) ?? null;
  const view: RefState["view"] = front ? front.kind : "blank";
  const snip = view === "snip" && editor !== null && editor.image !== null ? editor : null;
  // RUN3 T38: a PDF page reads like a Markdown page in Preview (items in PDF points instead of page pixels).
  const pdf = view === "pdf" ? pdfEditor : null;
  const doc = view === "markdown" ? md : pdf ? { ...pdf, mode: "preview" as const } : null;
  const page = doc?.mode === "preview" ? doc : null;
  const zoom = snip ? { percent: Math.round(snip.scale * 100), fit: snip.fitted } : page && page.scale !== null ? { percent: Math.round(page.scale * 100), fit: page.fitted } : null;
  return {
    version: 1,
    view,
    // A Markdown file opens in Preview (T34); without its editor on screen the tab reads as Edit (source only).
    mode: view === "markdown" ? (doc?.mode ?? "edit") : null,
    tabs: shell.tabs.map((t) => ({ id: t.id, title: t.title, kind: t.kind, dirty: t.dirty, active: t.id === shell.active })),
    editor: view === "snip" || view === "markdown" || view === "pdf" ? view : null,
    activeTool: snip ? snip.tool : page ? page.tool : null,
    color: snip ? snip.color : doc ? doc.color : null,
    stroke: snip ? snip.strokeWidth : doc ? doc.strokeWidth : null,
    items: snip ? items(snip.shapes, snip.bubbles) : doc ? items(doc.shapes, doc.bubbles) : [],
    selection: snip && snip.selectedId !== null ? [snip.selectedId] : page && page.selectedId !== null ? [page.selectedId] : [],
    zoom,
    theme: shell.theme,
    // The Aura ground in use (T52: Match system on a light computer reports "paper").
    aura: auraInUse(shell),
    sidebar: { delay: delayLabel(shell.snipDelay), addMode: shell.addMode, collapsed: shell.collapsed },
    splash: shell.splash ? { kind: shell.splash.kind, title: shell.splash.title } : null,
    pdf: pdf ? { pageIndex: pdf.pageIndex, pageCount: pdf.pageCount } : null,
  };
}
