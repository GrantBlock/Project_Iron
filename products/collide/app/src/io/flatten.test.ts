import { describe, expect, it, vi } from "vitest";
import type Konva from "konva";
import { dataUrlToBlob, exportFileName, flatten } from "./flatten";

function stubStage(toDataURL: () => string) {
  const st = { x: 12, y: -7, sx: 2.5, sy: 2.5 };
  const tr = { v: true, visible: vi.fn((b?: boolean) => (b === undefined ? tr.v : ((tr.v = b), tr))) };
  const stage = {
    x: () => st.x,
    y: () => st.y,
    scaleX: () => st.sx,
    scaleY: () => st.sy,
    position: (p: { x: number; y: number }) => ((st.x = p.x), (st.y = p.y)),
    scale: (p: { x: number; y: number }) => ((st.sx = p.x), (st.sy = p.y)),
    find: () => [tr],
    batchDraw: vi.fn(),
    toDataURL: vi.fn(toDataURL),
  };
  return { stage: stage as unknown as Konva.Stage, raw: stage, st, tr };
}

describe("flatten helpers", () => {
  it("names exports after the source", () => {
    expect(exportFileName("shot.png")).toBe("shot-markup.png");
    expect(exportFileName("a.b.jpeg")).toBe("a.b-markup.png");
    expect(exportFileName("noext")).toBe("noext-markup.png");
    expect(exportFileName("")).toBe("image-markup.png");
  });
  it("converts a data URL to a PNG blob", () => {
    const blob = dataUrlToBlob("data:image/png;base64,iVBORw0KGgo=");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(8);
  });
});

describe("flatten", () => {
  it("renders at 1:1 from the origin and restores the view", () => {
    const { stage, raw, st, tr } = stubStage(() => "data:image/png;base64,AAAA");
    const out = flatten(stage, { width: 400, height: 300 });
    expect(out).toEqual({ dataUrl: "data:image/png;base64,AAAA", width: 400, height: 300 });
    expect(raw.toDataURL).toHaveBeenCalledWith({ x: 0, y: 0, width: 400, height: 300, pixelRatio: 1, mimeType: "image/png" });
    expect(st).toEqual({ x: 12, y: -7, sx: 2.5, sy: 2.5 });
    expect(tr.v).toBe(true);
  });
  it("rethrows when drawing fails and still restores position, scale and Transformer", () => {
    const { stage, st, tr } = stubStage(() => {
      throw new Error("tainted canvas");
    });
    expect(() => flatten(stage, { width: 400, height: 300 })).toThrow("tainted canvas");
    expect(st).toEqual({ x: 12, y: -7, sx: 2.5, sy: 2.5 });
    expect(tr.v).toBe(true);
  });
  it("rejects when there is no image size", () => {
    const { stage } = stubStage(() => "");
    expect(() => flatten(stage, { width: 0, height: 0 })).toThrow(/no image/);
  });
});
