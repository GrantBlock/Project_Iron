import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findItem } from "../data/sample";
import { bodiesLabel, glbParts, isSample, readGlbJson } from "./glb";

const file = (id: string) => readFileSync(fileURLToPath(new URL(`../assets/models/${id}.glb`, import.meta.url)));

describe("sample GLBs (pnpm models) match the prototype's parts lists", () => {
  for (const id of ["m1", "m2"]) {
    it(`${id}`, () => {
      const item = findItem(id);
      if (item?.type !== "model") throw new Error("not a model");
      const json = readGlbJson(file(id));
      expect(glbParts(json).map((p) => ({ name: p.name, bodies: bodiesLabel(p.bodies) }))).toEqual(item.parts);
      expect(isSample(json)).toBe(true);
      expect(file(id).byteLength).toBeLessThan(64 * 1024);
    });
  }
});

describe("readGlbJson / glbParts", () => {
  it("rejects other files", () => {
    expect(() => readGlbJson(new TextEncoder().encode("not a glb at all, really"))).toThrow("Not a GLB");
  });

  it("descends into a single wrapper node and names unnamed parts", () => {
    const json = {
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "root", children: [1, 2] }, { mesh: 0 }, { name: "B", children: [3, 4] }, { mesh: 1 }, { mesh: 2 }],
    };
    expect(glbParts(json)).toEqual([
      { name: "Part 1", bodies: 1 },
      { name: "B", bodies: 2 },
    ]);
    expect(isSample(json)).toBe(false);
  });

  it("labels body counts", () => {
    expect([bodiesLabel(1), bodiesLabel(2)]).toEqual(["1 body", "2 bodies"]);
  });
});
