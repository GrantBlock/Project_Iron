// T41 (Run 4, items 8.1 and 7.1): a callout's type switch between rectangle and line, and a line's end handles.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Shape } from "../model";
import { CalloutsPanel } from "./CalloutsPanel";
import { DEFAULT_BOX, lineEnds, moveLineEnd, strokePoints, switchType } from "./engine";
import { historyReducer, initialHistory, type HistoryAction, type HistoryState } from "./history";
import { reducer, type EditorState } from "./store";

const style = { stroke: "red", strokeWidth: 3 };
const rect: Shape = { id: "a1", type: "rect", x: 40, y: 30, w: 100, h: 60, callout: 1, note: "Check this", ...style };
const line: Shape = { id: "a1", type: "line", x: 40, y: 30, w: 100, h: 60, pts: [0, 1, 1, 0], callout: 1, note: "Check this", ...style };
const arrow: Shape = { id: "a2", type: "arrow", x: 0, y: 0, w: 50, h: 20, points: [0, 0, 50, 20], ...style };

const withShape = (s: Shape): EditorState => ({ doc: { version: 1, source: { kind: "image", width: 400, height: 300 }, shapes: [s] }, selectedId: s.id });
const apply = (s: Shape, patch: ReturnType<typeof switchType>) => reducer(withShape(s), { type: "update", id: s.id, patch }).doc!.shapes[0];

describe("8.1: switching a rectangle callout to a line and back", () => {
  it("bug repro: the card's switch gives a line with two points, so it is drawn (it used to have none and vanished)", () => {
    const onPatch = vi.fn();
    render(
      <CalloutsPanel
        shapes={[rect]}
        selectedId={null}
        onSelect={() => {}}
        onNote={() => {}}
        onCommit={() => {}}
        onPatch={onPatch}
        onReorder={() => {}}
        onRemove={() => {}}
        focus={null}
        onEscape={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Type of callout 1" }), { target: { value: "line" } });
    expect(onPatch).toHaveBeenCalledTimes(1);
    const switched = apply(rect, onPatch.mock.calls[0][1]);
    expect(switched.type).toBe("line");
    // Something to draw: two end points, not an empty point list.
    expect(strokePoints(switched)).toHaveLength(4);
  });

  it("rectangle to line: an adjustable 2-point line across the rectangle; number, note and position kept", () => {
    const s = apply(rect, switchType(rect, "line"));
    expect(s).toMatchObject({ id: "a1", type: "line", x: 40, y: 30, w: 100, h: 60, callout: 1, note: "Check this" });
    expect(lineEnds(s)).toEqual([
      { x: 40, y: 30 },
      { x: 140, y: 90 },
    ]);
  });

  it("line to rectangle: the rectangle over the line's box; number, note and position kept; no line points left", () => {
    const s = apply(line, switchType(line, "rect"));
    expect(s).toMatchObject({ id: "a1", type: "rect", x: 40, y: 30, w: 100, h: 60, callout: 1, note: "Check this" });
    expect(s.pts).toBeUndefined();
  });

  it("a flat line switched to a rectangle gets the default size, centred where the line was (A)", () => {
    const flat: Shape = { ...line, x: 100, y: 50, w: 120, h: 0, pts: [0, 0, 1, 0] };
    const s = apply(flat, switchType(flat, "rect"));
    expect(s.type).toBe("rect");
    expect(s.w).toBe(120);
    expect(s.h).toBe(DEFAULT_BOX.h);
    expect(s.y + s.h / 2).toBe(50);
  });

  it("a point switched to a rectangle or a line gets the default size around the point, so it stays visible", () => {
    const point: Shape = { id: "a1", type: "point", x: 200, y: 100, w: 0, h: 0, callout: 1, ...style };
    const r = apply(point, switchType(point, "rect"));
    expect(r).toMatchObject({ type: "rect", w: DEFAULT_BOX.w, h: DEFAULT_BOX.h, x: 200 - DEFAULT_BOX.w / 2, y: 100 - DEFAULT_BOX.h / 2 });
    const l = apply(point, switchType(point, "line"));
    expect(strokePoints(l)).toHaveLength(4);
    expect(l.w).toBeGreaterThan(0);
  });
});

describe("7.1: a line callout's end handles", () => {
  it("a line has a handle at each end; an arrow has none (arrows are unchanged)", () => {
    expect(lineEnds(line)).toEqual([
      { x: 40, y: 90 },
      { x: 140, y: 30 },
    ]);
    expect(lineEnds(arrow)).toBeNull();
    expect(lineEnds(rect)).toBeNull();
  });

  it("dragging one end moves only that end, so the angle changes", () => {
    const s = apply(line, moveLineEnd(line, 1, { x: 140, y: 190 }));
    expect(lineEnds(s)).toEqual([
      { x: 40, y: 90 },
      { x: 140, y: 190 },
    ]);
    const t = apply(line, moveLineEnd(line, 0, { x: 0, y: 0 }));
    expect(lineEnds(t)).toEqual([
      { x: 0, y: 0 },
      { x: 140, y: 30 },
    ]);
    expect(t).toMatchObject({ callout: 1, note: "Check this" });
  });
});

describe("undo and redo cover the type switch and the end drag", () => {
  const run = (actions: HistoryAction[], from: HistoryState = initialHistory) => actions.reduce(historyReducer, from);
  it("switch, drag an end, then undo twice and redo twice", () => {
    let h = run([{ type: "load", width: 400, height: 300 }, { type: "add", shape: { type: "rect", x: 40, y: 30, w: 100, h: 60, ...style }, numbered: true }]);
    const first = h.present.doc!.shapes[0];
    h = historyReducer(h, { type: "update", id: "a1", patch: switchType(first, "line") });
    const asLine = h.present.doc!.shapes[0];
    h = historyReducer(h, { type: "update", id: "a1", patch: moveLineEnd(asLine, 1, { x: 300, y: 250 }) });
    const moved = h.present.doc!.shapes[0];
    h = run([{ type: "undo" }], h);
    expect(h.present.doc!.shapes[0]).toEqual(asLine);
    h = run([{ type: "undo" }], h);
    expect(h.present.doc!.shapes[0]).toEqual(first);
    h = run([{ type: "redo" }, { type: "redo" }], h);
    expect(h.present.doc!.shapes[0]).toEqual(moved);
    expect(lineEnds(moved)![1]).toEqual({ x: 300, y: 250 });
  });
});
