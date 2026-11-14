import { describe, expect, it } from "vitest";
import { canRedo, canUndo, HISTORY_LIMIT, historyReducer, initialHistory, type HistoryAction, type HistoryState } from "./history";
import type { NewShape } from "./store";

const rect: NewShape = { type: "rect", x: 10, y: 20, w: 30, h: 40, stroke: "#FF3D1F", strokeWidth: 3 };
const run = (actions: HistoryAction[], from: HistoryState = initialHistory) => actions.reduce(historyReducer, from);
const loaded = () => run([{ type: "load", width: 800, height: 600 }]);
const add = (): HistoryAction => ({ type: "add", shape: rect, numbered: true });
const ids = (h: HistoryState) => h.present.doc!.shapes.map((s) => s.id);

describe("history", () => {
  it("starts empty; load resets history", () => {
    const h = run([{ type: "load", width: 10, height: 10 }, add(), { type: "load", width: 5, height: 5 }]);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it("undo and redo restore the doc", () => {
    let h = run([...[add(), add()], { type: "update", id: "a1", patch: { x: 99 } }], loaded());
    expect(h.past).toHaveLength(3);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc!.shapes[0].x).toBe(10);
    h = historyReducer(h, { type: "undo" });
    expect(ids(h)).toEqual(["a1"]);
    h = historyReducer(h, { type: "redo" });
    h = historyReducer(h, { type: "redo" });
    expect(h.present.doc!.shapes[0].x).toBe(99);
    expect(canRedo(h)).toBe(false);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("caps the past at 50 steps", () => {
    const h = run(Array.from({ length: 60 }, add), loaded());
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    let u = h;
    for (let i = 0; i < 100; i++) u = historyReducer(u, { type: "undo" });
    expect(u.present.doc!.shapes).toHaveLength(10);
    expect(canUndo(u)).toBe(false);
  });

  it("a new action clears redo", () => {
    let h = run([add(), add(), { type: "undo" }], loaded());
    expect(canRedo(h)).toBe(true);
    h = historyReducer(h, add());
    expect(canRedo(h)).toBe(false);
  });

  it("selection is not a step", () => {
    const base = run([add(), add()], loaded());
    const h = run([{ type: "select", id: "a1" }, { type: "select", id: null }], base);
    expect(h.past).toBe(base.past);
    expect(h.present.selectedId).toBeNull();
  });

  it("undo of delete restores the shape, its selection and consistent ids", () => {
    let h = run([add(), add(), { type: "select", id: "a2" }, { type: "remove", id: "a2" }], loaded());
    expect(h.present.selectedId).toBeNull();
    h = historyReducer(h, { type: "undo" });
    expect(ids(h)).toEqual(["a1", "a2"]);
    expect(h.present.selectedId).toBe("a2");
    // Redo the delete, add (reuses a2), undo the add, undo the delete: original a2 is back.
    h = run([{ type: "redo" }, add()], h);
    expect(h.present.doc!.shapes[1].id).toBe("a2");
    h = run([{ type: "undo" }, { type: "undo" }], h);
    expect(ids(h)).toEqual(["a1", "a2"]);
  });

  it("a note typing burst is one step until commit", () => {
    const note = (n: string): HistoryAction => ({ type: "update", id: "a1", patch: { note: n } });
    let h = run([add()], loaded());
    const steps = h.past.length;
    h = run([note("h"), note("he"), note("hel")], h);
    expect(h.past).toHaveLength(steps + 1);
    expect(h.present.doc!.shapes[0].note).toBe("hel");
    h = run([{ type: "commit" }, note("hello")], h);
    expect(h.past).toHaveLength(steps + 2);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc!.shapes[0].note).toBe("hel");
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc!.shapes[0].note).toBeUndefined();
  });

  it("a different action or shape ends a burst; selection does not", () => {
    const note = (id: string, n: string): HistoryAction => ({ type: "update", id, patch: { note: n } });
    let h = run([add(), add(), note("a1", "x"), { type: "select", id: "a2" }, note("a1", "xy")], loaded());
    expect(h.past).toHaveLength(3);
    h = run([note("a2", "z")], h);
    expect(h.past).toHaveLength(4);
    h = run([{ type: "update", id: "a2", patch: { x: 1 } }, note("a2", "zz")], h);
    expect(h.past).toHaveLength(6);
  });
});
