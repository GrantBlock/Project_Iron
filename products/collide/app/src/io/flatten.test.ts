import { describe, expect, it, vi } from "vitest";
import type Konva from "konva";
import { contentBounds, copyPngToClipboard, dataUrlToBlob, exportFileName, flatten } from "./flatten";

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

describe("copyPngToClipboard", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  class FakeItem {
    constructor(public items: Record<string, Blob>) {}
  }

  it("writes one image/png item", async () => {
    vi.stubGlobal("ClipboardItem", FakeItem);
    const write = vi.fn().mockResolvedValue(undefined);
    await copyPngToClipboard(png, { write } as unknown as Clipboard);
    const [[items]] = write.mock.calls as [[FakeItem[]]];
    expect(items).toHaveLength(1);
    expect(items[0].items["image/png"].type).toBe("image/png");
    vi.unstubAllGlobals();
  });

  it("explains the fix when the clipboard API is missing", async () => {
    await expect(copyPngToClipboard(png, undefined)).rejects.toThrow(/use Export instead/);
  });
});

describe("contentBounds", () => {
  const img = { width: 400, height: 300 };
  it("is the plain image when every annotation is inside it", () => {
    expect(contentBounds(img, [{ x: 10, y: 10, width: 50, height: 50 }])).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });
  it("grows to hold a shape off the top-left, with padding, in whole pixels", () => {
    expect(contentBounds(img, [{ x: -40.5, y: -10, width: 100, height: 60 }], 24)).toEqual({ x: -65, y: -34, width: 489, height: 358 });
  });
  it("grows to the right and bottom too", () => {
    expect(contentBounds(img, [{ x: 350, y: 280, width: 200, height: 40 }], 10)).toEqual({ x: -10, y: -10, width: 570, height: 340 });
  });
});
