import { describe, expect, it } from "vitest";
import { MarkupError, MemoryMarkupStore, markupFolderName, parseAnnotations } from "./markupStore";
import type { AnnotationsDoc } from "../model";

const doc: AnnotationsDoc = {
  version: 1,
  source: { kind: "image", width: 400, height: 300 },
  shapes: [
    { id: "a1", type: "rect", x: 10, y: 20, w: 100, h: 50, stroke: "#E53935", strokeWidth: 3, callout: 1, note: "Misaligned" },
    { id: "a2", type: "arrow", x: 5, y: 5, w: 0, h: 0, stroke: "#E53935", strokeWidth: 2, points: [0, 0, 40, 30] },
  ],
};
const bytes = (...n: number[]) => new Uint8Array(n);

describe("markupFolderName", () => {
  it("is YYYY-MM-DD_<slug> from the source name", () => {
    expect(markupFolderName("Conveyor HMI (v2).png", new Date(2026, 10, 13))).toBe("2026-11-13_conveyor-hmi-v2");
  });
  it("falls back to 'markup' for an empty slug", () => {
    expect(markupFolderName("???.png", new Date(2026, 0, 5))).toBe("2026-01-05_markup");
  });
});

describe("MemoryMarkupStore", () => {
  it("round-trips source bytes and the annotations doc", async () => {
    const s = new MemoryMarkupStore();
    const id = await s.save("2026-11-13_x", { sourcePng: bytes(137, 80, 78, 71, 1), annotations: doc, exportPng: bytes(9, 9) });
    const m = await s.open(id);
    expect(m.annotations).toEqual(doc);
    expect([...m.sourcePng]).toEqual([137, 80, 78, 71, 1]);
    expect(m.folderName).toBe("2026-11-13_x");
    expect(await s.list()).toEqual(["2026-11-13_x"]);
  });
  it("opening a missing folder names the cause and fix", async () => {
    await expect(new MemoryMarkupStore().open("nope")).rejects.toThrow(/No saved markup named "nope".*Save one first/);
  });
  it("surfaces a corrupt annotations.json clearly", async () => {
    const s = new MemoryMarkupStore();
    await s.save("f", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) });
    s.setRawAnnotations("f", "{ not json");
    await expect(s.open("f")).rejects.toThrow(/not valid JSON/);
    s.setRawAnnotations("f", JSON.stringify({ ...doc, shapes: [{ ...doc.shapes[0], w: "wide" }] }));
    await expect(s.open("f")).rejects.toThrow(/shapes\[0\]\.w must be a number — check annotations\.json/);
  });
});

describe("parseAnnotations", () => {
  it("throws a MarkupError with a title", () => {
    try {
      parseAnnotations("[]");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(MarkupError);
      expect((e as MarkupError).title).toBe("Could not open markup");
    }
  });
});
