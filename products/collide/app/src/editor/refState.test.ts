import { describe, expect, it } from "vitest";
import type { Shape } from "../model";
import { delayLabel, refState, type RefInput } from "./refState";

const style = { stroke: "#FF3D1F", strokeWidth: 3 };
const shapes: Shape[] = [
  { id: "a1", type: "rect", x: 10, y: 20, w: 30.456, h: 40, callout: 1, note: "First", ...style },
  { id: "a2", type: "ellipse", x: 0, y: 0, w: 5, h: 5, fill: true, ...style },
  { id: "a3", type: "point", x: 7, y: 8, w: 0, h: 0, callout: 2, hideNumber: true, stroke: "#4C87C4", strokeWidth: 5 },
];
const base: RefInput = { image: { name: "guard.png" }, shapes, selectedId: "a2", tool: "rect", color: "var(--signal-500)", strokeWidth: 3, scale: 0.4949, fitted: true, snipDelay: 0 };

describe("reference test hook: window.__collide.state()", () => {
  it("empty canvas: blank view, nothing open, missing concepts are null or []", () => {
    expect(refState({ ...base, image: null, shapes: [], selectedId: null })).toEqual({
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
      theme: null,
      aura: null,
      sidebar: { delay: "No delay", addMode: null, collapsed: null },
      splash: null,
    });
  });

  it("open image: the snip editor with its tool, colour, thickness, selection and zoom", () => {
    const s = refState(base);
    expect(s).toMatchObject({ version: 1, view: "snip", editor: "snip", activeTool: "rect", color: "var(--signal-500)", stroke: 3, selection: ["a2"], zoom: { percent: 49, fit: true } });
  });

  it("items are front to back, with number, note, hide toggles and fill", () => {
    const items = refState(base).items;
    expect(items.map((x) => [x.id, x.type, x.number])).toEqual([
      ["a3", "point", 2],
      ["a2", "ellipse", null],
      ["a1", "rect", 1],
    ]);
    expect(items[0]).toEqual({ id: "a3", type: "point", number: 2, note: "", hidden: { text: false, bubble: true, outline: false }, fill: 0, color: "#4C87C4", stroke: 5, x: 7, y: 8, w: 0, h: 0, points: null, bubble: null });
    expect(items[1].fill).toBe(100);
    expect(items[2]).toMatchObject({ note: "First", w: 30.46, hidden: { text: false, bubble: false, outline: false } });
  });

  it("no selection is an empty list", () => {
    expect(refState({ ...base, selectedId: null }).selection).toEqual([]);
  });

  it("the delay uses the prototype's words", () => {
    expect([0, 3, 5, 10].map(delayLabel)).toEqual(["No delay", "3 s", "5 s", "10 s"]);
    expect(refState({ ...base, snipDelay: 5 }).sidebar.delay).toBe("5 s");
  });

  it("returns a fresh plain JSON object and leaves its input alone", () => {
    const before = JSON.stringify(base);
    const a = refState(base);
    const b = refState(base);
    expect(a).not.toBe(b);
    expect(a.items).not.toBe(b.items);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    a.items[0].note = "changed";
    expect(JSON.stringify(base)).toBe(before);
    expect(refState(base).items[0].note).toBe("");
  });
});
