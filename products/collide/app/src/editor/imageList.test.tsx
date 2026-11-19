// T46 (Run 4, items 2.1 and 3.1 to 3.4): the image list. An added snip keeps its own size (the original's scale);
// the first snip is "image 1" with Crop and no delete; each added image is its own entry with Crop; every callout has
// a delete that acts at once, and Undo brings it back with its original number.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { parse, serialize, type AnnotationsDoc, type Shape } from "../model";
import { decodeCollide, encodeCollide } from "../io/collideFile";
import { CalloutsPanel } from "./CalloutsPanel";
import { calloutNumbers, IMAGE_GAP, imageLabel, placeBeside, sourceCrop } from "./engine";
import { historyReducer, initialHistory, type HistoryState } from "./history";

afterEach(cleanup);

const style = { stroke: "red", strokeWidth: 3 };
const callout = (id: string, note: string): Shape => ({ id, type: "rect", x: 10, y: 10, w: 40, h: 30, note, ...style });
const image = (id: string, n: number): Shape => ({ id, type: "image", src: `image-${n}.png`, x: 424, y: 0, w: 320, h: 200, stroke: "gray", strokeWidth: 0 });

function panel(shapes: Shape[], extra: Partial<Parameters<typeof CalloutsPanel>[0]> = {}) {
  const props = {
    shapes,
    selectedId: null,
    onSelect: vi.fn(),
    onNote: vi.fn(),
    onCommit: vi.fn(),
    onPatch: vi.fn(),
    onReorder: vi.fn(),
    onRemove: vi.fn(),
    onCrop: vi.fn(),
    focus: null,
    onEscape: vi.fn(),
    ...extra,
  };
  render(<CalloutsPanel {...props} />);
  return props;
}

describe("2.1: an added snip is the same size as the original", () => {
  it("it keeps its own pixel size (the first snip's scale), beside the content", () => {
    expect(placeBeside({ width: 1280, height: 720 }, [], { width: 320, height: 200 })).toEqual({ x: 1280 + IMAGE_GAP, y: 0, w: 320, h: 200 });
    expect(placeBeside({ width: 400, height: 300 }, [], { width: 1920, height: 1080 })).toEqual({ x: 424, y: 0, w: 1920, h: 1080 });
  });
});

describe("3.1 to 3.4: the image entries", () => {
  it("3.1: the first snip is listed as 'image 1', with Crop and no delete button", () => {
    const onCropBase = vi.fn();
    panel([], { base: { cropped: false, onCrop: onCropBase } });
    const row = screen.getByTestId("base-image-row");
    expect(within(row).getByText("image 1", { exact: true })).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /delete/i })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Crop image 1" }));
    expect(onCropBase).toHaveBeenCalledTimes(1);
  });

  it("3.2 and 3.4: each added image is its own entry, named in order, with Crop and Delete", () => {
    const p = panel([callout("a1", "x"), image("a2", 1), image("a3", 2)], { base: { cropped: false, onCrop: vi.fn() } });
    const rows = screen.getAllByTestId("image-row");
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining("image 3"), expect.stringContaining("image 2"), expect.stringContaining("image 1")]);
    fireEvent.click(screen.getByRole("button", { name: "Crop image 3" }));
    expect(p.onCrop).toHaveBeenCalledWith("a3");
    fireEvent.click(screen.getByRole("button", { name: "Crop image 2" }));
    expect(p.onCrop).toHaveBeenCalledWith("a2");
    fireEvent.click(screen.getByRole("button", { name: "Delete image 2" }));
    expect(p.onRemove).toHaveBeenCalledWith("a2");
  });

  it("image names follow the file (image-<n>.png is image n+1), so they stay put when another goes", () => {
    expect(imageLabel("image-1.png")).toBe("image 2");
    expect(imageLabel("image-12.png")).toBe("image 13");
  });

  it("the first snip's entry is only on a Snip tab (Markdown and PDF pass no base)", () => {
    panel([callout("a1", "x")]);
    expect(screen.queryByTestId("base-image-row")).toBeNull();
  });
});

describe("3.3: every callout has a delete button; Undo restores its original number", () => {
  it("each callout card has a delete button that removes it at once, with no confirmation", () => {
    const confirm = vi.spyOn(window, "confirm");
    const p = panel([callout("a1", "one"), callout("a2", "two"), callout("a3", "three")]);
    expect(screen.getAllByRole("button", { name: /^Delete callout \d$/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Delete callout 2" }));
    expect(p.onRemove).toHaveBeenCalledWith("a2");
    expect(p.onSelect).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("Undo restores the deleted callout with its original number and note", () => {
    let h: HistoryState = historyReducer(initialHistory, { type: "load", width: 400, height: 300 });
    for (const n of ["one", "two", "three"]) h = historyReducer(h, { type: "add", shape: { type: "rect", x: 10, y: 10, w: 40, h: 30, note: n, ...style } });
    const before = calloutNumbers(h.present.doc!.shapes);
    expect([...before.values()]).toEqual([1, 2, 3]);
    h = historyReducer(h, { type: "remove", id: "a2" });
    expect(h.present.doc!.shapes.map((s) => s.note)).toEqual(["one", "three"]);
    h = historyReducer(h, { type: "undo" });
    const back = h.present.doc!.shapes.find((s) => s.id === "a2")!;
    expect(back.note).toBe("two");
    expect(calloutNumbers(h.present.doc!.shapes).get("a2")).toBe(2);
    expect(calloutNumbers(h.present.doc!.shapes)).toEqual(before);
  });
});

describe("3.4: Crop on image 1 (the first snip)", () => {
  const load = () => {
    let h: HistoryState = historyReducer(initialHistory, { type: "load", width: 400, height: 300 });
    h = historyReducer(h, { type: "add", shape: { type: "rect", x: 150, y: 100, w: 40, h: 30, ...style } });
    h = historyReducer(h, { type: "add", shape: { type: "arrow", x: 120, y: 90, w: 20, h: 10, points: [0, 0, 20, 10], ...style } });
    return h;
  };

  it("the crop is in pixels of the whole file; none = the whole image", () => {
    expect(sourceCrop({ width: 400, height: 300 })).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(sourceCrop({ width: 400, height: 300, crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.5 } })).toEqual({ x: 100, y: 30, width: 200, height: 150 });
  });

  it("cropping moves every item with the picture (what you see stays put), in one undo step", () => {
    let h = load();
    h = historyReducer(h, { type: "cropSource", crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.5 } });
    const doc = h.present.doc!;
    expect(doc.source).toEqual({ kind: "image", width: 400, height: 300, crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.5 } });
    expect(doc.shapes.map((s) => [s.x, s.y])).toEqual([
      [50, 70],
      [20, 60],
    ]);
    // Again, wider: the shift is the change at the crop's top-left.
    h = historyReducer(h, { type: "cropSource", crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(h.present.doc!.source.crop).toBeUndefined();
    expect(h.present.doc!.shapes.map((s) => [s.x, s.y])).toEqual([
      [150, 100],
      [120, 90],
    ]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc!.source.crop).toEqual({ x: 0.25, y: 0.1, w: 0.5, h: 0.5 });
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc!.source.crop).toBeUndefined();
    expect(h.present.doc!.shapes[0]).toMatchObject({ x: 150, y: 100 });
  });

  it("the same crop again is no step", () => {
    const h = load();
    expect(historyReducer(h, { type: "cropSource", crop: { x: 0, y: 0, w: 1, h: 1 } })).toBe(h);
  });

  it("annotations.json and the .collide file keep the first snip's crop; older files (no crop) still open", () => {
    const doc: AnnotationsDoc = { version: 1, source: { kind: "image", width: 400, height: 300, crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.5 } }, shapes: [callout("a1", "x")] };
    expect(parse(serialize(doc))).toEqual({ ok: true, doc });
    expect(parse(JSON.stringify({ ...doc, source: { ...doc.source, crop: { x: 0.8, y: 0, w: 0.5, h: 1 } } })).ok).toBe(false);
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const back = decodeCollide(encodeCollide({ kind: "snip", title: "x", doc, source: png, images: [], preview: png }));
    expect(back.kind === "snip" && back.doc.source).toEqual(doc.source);
    const plain = { ...doc, source: { kind: "image" as const, width: 400, height: 300 } };
    const old = decodeCollide(encodeCollide({ kind: "snip", title: "x", doc: plain, source: png, images: [], preview: png }));
    expect(old.kind === "snip" && old.doc.source).toEqual(plain.source);
  });
});
