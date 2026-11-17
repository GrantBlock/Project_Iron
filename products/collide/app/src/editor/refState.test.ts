import { describe, expect, it } from "vitest";
import type { Shape } from "../model";
import { delayLabel, refState, type RefInput, type ShellRefInput } from "./refState";

const style = { stroke: "#FF3D1F", strokeWidth: 3 };
const shapes: Shape[] = [
  { id: "a1", type: "rect", x: 10, y: 20, w: 30.456, h: 40, callout: 1, note: "First", ...style },
  { id: "a2", type: "ellipse", x: 0, y: 0, w: 5, h: 5, fill: true, ...style },
  { id: "a3", type: "point", x: 7, y: 8, w: 0, h: 0, callout: 2, hideNumber: true, stroke: "#4C87C4", strokeWidth: 5 },
  { id: "a4", type: "pen", x: 1, y: 2, w: 10, h: 4, pts: [0, 0, 0.5, 1, 1, 0], stroke: "blue", strokeWidth: 2 },
];
const base: RefInput = { image: { name: "guard.png" }, shapes, selectedId: "a2", tool: "rect", color: "blue", strokeWidth: 3, scale: 0.4949, fitted: true };
const blank: ShellRefInput = { tabs: [], active: null, theme: "system", aura: "sage", snipDelay: 0, addMode: "Current", collapsed: false, splash: null };
/** A shell with one Snip tab in front. */
const shell: ShellRefInput = { ...blank, tabs: [{ id: "t1", title: "guard.png", kind: "snip", dirty: false }], active: "t1" };

describe("reference test hook: window.__collide.state()", () => {
  it("blank canvas: nothing open, no editor; the shell's own fields are there", () => {
    expect(refState(blank, null)).toEqual({
      version: 1,
      view: "blank",
      mode: null,
      tabs: [],
      editor: null,
      activeTool: null,
      color: null,
      stroke: null,
      items: [],
      selection: [],
      zoom: null,
      theme: "system",
      aura: null,
      sidebar: { delay: "No delay", addMode: "Current", collapsed: false },
      splash: null,
      pdf: null,
    });
  });

  it("open image: the snip editor with its tool, colour, thickness, selection and zoom", () => {
    const s = refState(shell, base);
    expect(s).toMatchObject({ version: 1, view: "snip", editor: "snip", activeTool: "rect", color: "blue", stroke: 3, selection: ["a2"], zoom: { percent: 49, fit: true } });
  });

  it("items are front to back; callouts numbered from the back; pens without a number; hide toggles and fill", () => {
    const items = refState(shell, base).items;
    expect(items.map((x) => [x.id, x.type, x.number])).toEqual([
      ["a4", "pen", null],
      ["a3", "point", 3],
      ["a2", "ellipse", 2],
      ["a1", "rect", 1],
    ]);
    expect(items[0]).toMatchObject({ color: "blue", points: 3, bubble: null });
    expect(items[1]).toEqual({ id: "a3", type: "point", number: 3, note: "", hidden: { text: false, bubble: true, outline: false }, fill: 0, color: "#4C87C4", stroke: 5, x: 7, y: 8, w: 0, h: 0, points: null, bubble: null });
    // An old filled shape reads as 30 %.
    expect(items[2].fill).toBe(30);
    expect(items[3]).toMatchObject({ note: "First", w: 30.46, hidden: { text: false, bubble: false, outline: false } });
  });

  it("no selection is an empty list", () => {
    expect(refState(shell, { ...base, selectedId: null }).selection).toEqual([]);
  });

  it("the delay uses the prototype's words", () => {
    expect([0, 3, 5, 10].map(delayLabel)).toEqual(["No delay", "3 s", "5 s", "10 s"]);
    expect(refState({ ...shell, snipDelay: 5 }, base).sidebar.delay).toBe("5 s");
  });

  it("returns a fresh plain JSON object and leaves its input alone", () => {
    const before = JSON.stringify([shell, base]);
    const a = refState(shell, base);
    const b = refState(shell, base);
    expect(a).not.toBe(b);
    expect(a.items).not.toBe(b.items);
    expect(a.tabs).not.toBe(b.tabs);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    a.items[0].note = "changed";
    a.tabs[0].title = "changed";
    expect(JSON.stringify([shell, base])).toBe(before);
    expect(refState(shell, base).items[0].note).toBe("");
  });

  it("tabs run left to right with the one in front marked; the view is that tab's kind (T31)", () => {
    const s = refState(
      {
        ...blank,
        tabs: [
          { id: "t1", title: "Line 3 conveyor guard", kind: "snip", dirty: true },
          { id: "t2", title: "P06.md", kind: "markdown", dirty: false },
          { id: "t3", title: "Settings", kind: "settings", dirty: false },
        ],
        active: "t3",
      },
      null,
    );
    expect(s.tabs).toEqual([
      { id: "t1", title: "Line 3 conveyor guard", kind: "snip", dirty: true, active: false },
      { id: "t2", title: "P06.md", kind: "markdown", dirty: false, active: false },
      { id: "t3", title: "Settings", kind: "settings", dirty: false, active: true },
    ]);
    expect(s).toMatchObject({ view: "settings", editor: null, mode: null, activeTool: null, items: [], zoom: null });
  });

  it("a Markdown tab in front: the markdown view in Edit, no drawing surface yet", () => {
    const s = refState({ ...blank, tabs: [{ id: "t2", title: "P06.md", kind: "markdown", dirty: false }], active: "t2" }, null);
    expect(s).toMatchObject({ view: "markdown", editor: "markdown", mode: "edit", activeTool: null, color: null, stroke: null, items: [] });
  });

  it("a snip editor that is not in front is not reported", () => {
    expect(refState({ ...shell, tabs: [...shell.tabs, { id: "t9", title: "Settings", kind: "settings", dirty: false }], active: "t9" }, base)).toMatchObject({ view: "settings", items: [], selection: [], zoom: null });
  });

  it("theme, Aura ground, sidebar choices and the splash (T31)", () => {
    expect(refState({ ...blank, theme: "aura", aura: "moss" }, null)).toMatchObject({ theme: "aura", aura: "moss" });
    expect(refState({ ...blank, theme: "dark", aura: "moss" }, null)).toMatchObject({ theme: "dark", aura: null });
    expect(refState({ ...blank, snipDelay: 10, addMode: "Behind", collapsed: true }, null).sidebar).toEqual({ delay: "10 s", addMode: "Behind", collapsed: true });
    expect(refState({ ...blank, splash: { kind: "delete", title: "builder-v0.1.zip" } }, null).splash).toEqual({ kind: "delete", title: "builder-v0.1.zip" });
  });
});

describe("reference test hook: a Markdown tab (RUN3 T34)", () => {
  const md: ShellRefInput = { ...blank, tabs: [{ id: "t2", title: "P06.md", kind: "markdown", dirty: true }], active: "t2" };
  const page = { mode: "preview" as const, shapes, selectedId: "a1", tool: "pen", color: "yellow" as const, strokeWidth: 2, scale: 0.7531, fitted: false };

  it("Preview: the page's tool, colour, items in page pixels, selection and zoom", () => {
    const s = refState(md, null, page);
    expect(s).toMatchObject({ view: "markdown", editor: "markdown", mode: "preview", activeTool: "pen", color: "yellow", stroke: 2, selection: ["a1"], zoom: { percent: 75, fit: false } });
    expect(s.items.map((i) => `${i.type}:${i.number ?? "-"}`)).toEqual(["pen:-", "point:3", "ellipse:2", "rect:1"]);
  });

  it("Edit: no drawing surface, no zoom; the colour and thickness are still the editor's", () => {
    const s = refState(md, null, { ...page, mode: "edit", scale: null });
    expect(s).toMatchObject({ mode: "edit", activeTool: null, color: "yellow", stroke: 2, selection: [], zoom: null });
    expect(s.items).toHaveLength(4);
  });

  // RUN3 T38 (app only): a PDF tab reads like a Markdown page in Preview, plus its page and page count.
  it("a PDF tab in front: the pdf view and editor, the page's items in points, the page index and count", () => {
    const pdfShell: ShellRefInput = { ...blank, tabs: [{ id: "t3", title: "two-pages.pdf", kind: "pdf", dirty: true }], active: "t3" };
    const s = refState(pdfShell, null, null, { pageIndex: 1, pageCount: 2, shapes, selectedId: "a3", tool: "rect", color: "red", strokeWidth: 3, scale: 1.25, fitted: false });
    expect(s).toMatchObject({ view: "pdf", editor: "pdf", mode: null, activeTool: "rect", color: "red", stroke: 3, selection: ["a3"], zoom: { percent: 125, fit: false }, pdf: { pageIndex: 1, pageCount: 2 } });
    expect(s.items.map((i) => i.id)).toEqual(["a4", "a3", "a2", "a1"]);
    // No PDF editor on screen: the view, no items, no page.
    expect(refState(pdfShell, null)).toMatchObject({ view: "pdf", editor: "pdf", items: [], pdf: null });
    // Another tab in front: no PDF fields.
    expect(refState(shell, base, null, { pageIndex: 0, pageCount: 2, shapes, selectedId: null, tool: "select", color: null, strokeWidth: 3, scale: 1, fitted: true }).pdf).toBeNull();
  });
});
