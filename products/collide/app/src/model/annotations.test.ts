import { describe, expect, it } from "vitest";
import { nextCalloutNumber, parse, serialize, type AnnotationsDoc, type Shape } from "./index";

const common = { x: 1, y: 2, w: 30, h: 40, stroke: "#E53935", strokeWidth: 3 };
const shapes: Shape[] = [
  { id: "a1", type: "rect", ...common },
  { id: "a2", type: "ellipse", page: 1, ...common, callout: 1, note: "Button misaligned" },
  { id: "a3", type: "arrow", ...common, points: [0, 0, 50, 20] },
  { id: "a4", type: "text", ...common, text: "Hello", fontSize: 16 },
  { id: "a5", type: "callout", ...common, callout: 2 },
  { id: "a6", type: "highlight", ...common },
];
const doc: AnnotationsDoc = { version: 1, source: { kind: "image", width: 800, height: 600 }, shapes };

function err(json: string): string {
  const r = parse(json);
  if (r.ok) throw new Error("expected parse to fail");
  return r.error;
}
const withShape = (s: unknown) => JSON.stringify({ ...doc, shapes: [s] });

describe("annotations", () => {
  it("round-trips every shape type", () => {
    const r = parse(serialize(doc));
    expect(r).toEqual({ ok: true, doc });
  });

  it("rejects invalid JSON without throwing", () => {
    expect(err("{nope")).toMatch(/not valid JSON/);
    expect(err("")).toMatch(/not valid JSON/);
  });

  it("rejects wrong types with the JSON path", () => {
    expect(err(withShape({ ...shapes[0], w: "wide" }))).toContain("shapes[0].w must be a number");
    expect(err(withShape({ ...shapes[0], w: -1 }))).toContain("shapes[0].w must be a number ≥ 0");
    expect(err(JSON.stringify({ ...doc, shapes: "x" }))).toContain("shapes must be an array");
    expect(err(JSON.stringify({ ...doc, source: { kind: "image", width: "1", height: 2 } }))).toContain("source.width");
  });

  it("rejects an unknown shape type naming the path and allowed types", () => {
    const msg = err(withShape({ ...shapes[0], type: "star" }));
    expect(msg).toContain("shapes[0].type");
    expect(msg).toContain("rect, ellipse, arrow, text, callout, highlight");
  });

  it("rejects wrong version and missing type-specific fields", () => {
    expect(err(JSON.stringify({ ...doc, version: 2 }))).toContain("version");
    expect(err(withShape({ id: "t", type: "text", ...common, fontSize: 12 }))).toContain("shapes[0].text");
    expect(err(withShape({ id: "r", type: "arrow", ...common, points: [1, 2] }))).toContain("shapes[0].points");
  });

  it("computes the next callout number", () => {
    expect(nextCalloutNumber([])).toBe(1);
    expect(nextCalloutNumber(shapes)).toBe(3);
  });

  it("handles gaps in callout numbers", () => {
    const gap = [
      { ...shapes[0], callout: 1 },
      { ...shapes[0], id: "b", callout: 5 },
    ] as Shape[];
    expect(nextCalloutNumber(gap)).toBe(6);
  });

  it("rejects null and arrays with a clear message", () => {
    expect(err("null")).toContain("must be an object");
    expect(err("[]")).toContain("must be an object");
  });

  it("explains a too-short points array", () => {
    expect(err(withShape({ id: "r", type: "arrow", ...common, points: [1, 2] }))).toBe(
      "shapes[0].points must have 4 numbers [x1, y1, x2, y2] — check annotations.json",
    );
  });
});
