import { Group, Mesh, Object3D } from "three";
import { describe, expect, it } from "vitest";
import { initialState, select, selectPart } from "../state";
import { fitDistance, nodeName, partOf } from "./viewer";

describe("viewer helpers", () => {
  it("fitDistance: the sphere fits the narrower field of view", () => {
    const wide = fitDistance(1, 35, 2);
    const tall = fitDistance(1, 35, 0.5);
    expect(wide).toBeCloseTo((1 / Math.sin((35 * Math.PI) / 360)) * 1.02, 6);
    expect(tall).toBeGreaterThan(wide);
    expect(fitDistance(2, 35, 2)).toBeCloseTo(wide * 2, 6);
  });

  it("partOf finds the top-level part of a picked mesh", () => {
    const root = new Group();
    const part = new Group();
    const inner = new Group();
    const mesh = new Mesh();
    root.add(part);
    part.add(inner);
    inner.add(mesh);
    expect(partOf(mesh, root)).toBe(part);
    expect(partOf(part, root)).toBe(part);
    expect(partOf(new Object3D(), root)).toBeNull();
    expect(partOf(null, root)).toBeNull();
  });

  it("nodeName prefers the file's name over the loader's sanitized one", () => {
    const o = new Object3D();
    o.name = "Transfer_axis";
    expect(nodeName(o)).toBe("Transfer_axis");
    o.userData.name = "Transfer axis";
    expect(nodeName(o)).toBe("Transfer axis");
  });
});

describe("part selection state", () => {
  it("selects, clears, and resets when another item opens", () => {
    let s = select(initialState(), "m1");
    s = selectPart(s, "Guard door");
    expect(s.part).toBe("Guard door");
    expect(selectPart(s, "Guard door")).toBe(s);
    expect(selectPart(s, null).part).toBeNull();
    expect(select(s, "m2").part).toBeNull();
  });
});
