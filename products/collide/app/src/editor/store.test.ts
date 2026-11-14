import { describe, expect, it } from "vitest";
import { initialState, nextShapeId, reducer, type Action, type EditorState, type NewShape } from "./store";

const style = { stroke: "#FF3D1F", strokeWidth: 3 };
const rect: NewShape = { type: "rect", x: 10, y: 20, w: 30, h: 40, ...style };

const run = (actions: Action[], from: EditorState = initialState) => actions.reduce(reducer, from);
const loaded = () => run([{ type: "load", width: 800, height: 600 }]);

describe("editor store", () => {
  it("ignores edits before an image is loaded", () => {
    expect(reducer(initialState, { type: "add", shape: rect })).toBe(initialState);
  });

  it("load creates an empty doc sized to the image", () => {
    expect(loaded().doc).toEqual({ version: 1, source: { kind: "image", width: 800, height: 600 }, shapes: [] });
  });

  it("add assigns sequential ids, selects the new shape and numbers on request", () => {
    const s = run([
      { type: "load", width: 800, height: 600 },
      { type: "add", shape: rect, numbered: true },
      { type: "add", shape: { type: "ellipse", x: 0, y: 0, w: 5, h: 5, ...style } },
      { type: "add", shape: { type: "callout", x: 0, y: 0, w: 24, h: 24, ...style } },
    ]);
    expect(s.doc!.shapes.map((x) => [x.id, x.type, x.callout])).toEqual([
      ["a1", "rect", 1],
      ["a2", "ellipse", undefined],
      ["a3", "callout", 2],
    ]);
    expect(s.selectedId).toBe("a3");
  });

  it("remove deletes the shape and clears its selection; ids and callout numbers are not reused wrongly", () => {
    let s = run([
      { type: "load", width: 10, height: 10 },
      { type: "add", shape: rect, numbered: true },
      { type: "add", shape: rect, numbered: true },
    ]);
    s = reducer(s, { type: "remove", id: "a2" });
    expect(s.doc!.shapes.map((x) => x.id)).toEqual(["a1"]);
    expect(s.selectedId).toBeNull();
    s = reducer(s, { type: "add", shape: rect, numbered: true });
    expect(s.doc!.shapes[1]).toMatchObject({ id: "a2", callout: 2 });
  });

  it("update merges a patch into one shape only", () => {
    let s = run([
      { type: "load", width: 10, height: 10 },
      { type: "add", shape: rect },
      { type: "add", shape: rect },
    ]);
    const before = s.doc!.shapes[1];
    s = reducer(s, { type: "update", id: "a1", patch: { x: 99, w: 7 } });
    expect(s.doc!.shapes[0]).toMatchObject({ x: 99, y: 20, w: 7, h: 40 });
    expect(s.doc!.shapes[1]).toBe(before);
  });

  it("is pure: the previous state is never mutated", () => {
    const s0 = loaded();
    const frozen = JSON.stringify(s0);
    reducer(s0, { type: "add", shape: rect, numbered: true });
    expect(JSON.stringify(s0)).toBe(frozen);
  });

  it("select toggles the selection and returns the same state when unchanged", () => {
    const s = run([{ type: "load", width: 10, height: 10 }, { type: "add", shape: rect }]);
    expect(reducer(s, { type: "select", id: "a1" })).toBe(s);
    expect(reducer(s, { type: "select", id: null }).selectedId).toBeNull();
  });

  it("nextShapeId skips ids already in use", () => {
    expect(nextShapeId([])).toBe("a1");
    expect(nextShapeId([{ id: "a7", ...rect } as never, { id: "custom", ...rect } as never])).toBe("a8");
  });
});
