// RUN3 T33: images on the canvas. Placement, the aspect lock, the list, the file names and annotations.json.
import { describe, expect, it } from "vitest";
import { parse, serialize, type AnnotationsDoc, type Shape } from "../model";
import { MemoryMarkupStore } from "../io/markupStore";
import { nextImageFile } from "./EditorShell";
import { calloutNumbers, IMAGE_GAP, isCallout, placeBeside, printArea } from "./engine";
import { resizeShape } from "./geometry";
import { refState } from "./refState";
import { historyReducer, initialHistory } from "./history";

const base = { width: 1280, height: 720 };
const image = (id: string, x: number, w: number, h = 720): Shape => ({ id, type: "image", src: `image-${id.slice(1)}.png`, x, y: 0, w, h, stroke: "gray", strokeWidth: 0 });
const rect: Shape = { id: "a1", type: "rect", x: 10, y: 10, w: 50, h: 40, stroke: "red", strokeWidth: 3 };
const measure = () => ({ w: 0, h: 0 });

describe("images on the canvas (T33)", () => {
  // T46 (2.1, Grant 2026-11-19): an added snip keeps its own size (was: as tall as the base image, w 1152, h 720).
  it("an added image goes beside the base image, its own size (T46: was as tall as it)", () => {
    expect(placeBeside(base, [rect], { width: 320, height: 200 })).toEqual({ x: 1280 + IMAGE_GAP, y: 0, w: 320, h: 200 });
  });

  it("the next one goes beside the images added before", () => {
    const first = image("a2", 1304, 1152);
    // T46 (2.1): its own size (was w 1280, h 720).
    expect(placeBeside(base, [rect, first], { width: 1920, height: 1080 })).toEqual({ x: 1304 + 1152 + IMAGE_GAP, y: 0, w: 1920, h: 1080 });
  });

  it("the canvas grows: the print area takes the added image", () => {
    const area = printArea(base, [image("a2", 1304, 1152)], new Map());
    expect(area.x + area.w).toBeGreaterThanOrEqual(1304 + 1152);
    expect(area.h).toBeGreaterThanOrEqual(720);
  });

  it("resizing keeps the aspect, whatever the two scales say", () => {
    const im = image("a2", 1304, 1152);
    const r = resizeShape(im, { x: -100, y: 0, scaleX: 0.5, scaleY: 0.4 }, measure);
    expect(r).toEqual({ x: 1204, y: 0, w: 576, h: 360 });
    expect(r.w / r.h).toBeCloseTo(1152 / 720, 6);
  });

  it("images are in the list without a number and do not shift the callout numbers", () => {
    const shapes = [rect, image("a2", 1304, 1152), { ...rect, id: "a3" }];
    expect(isCallout(shapes[1])).toBe(false);
    expect([...calloutNumbers(shapes)]).toEqual([["a1", 1], ["a3", 2]]);
    const s = refState(
      { tabs: [{ id: "t1", title: "x", kind: "snip", dirty: true }], active: "t1", theme: "dark", aura: "sage", snipDelay: 0, addMode: "Current", collapsed: false, splash: null },
      { image: { name: "x" }, shapes, selectedId: "a2", tool: "select", color: null, strokeWidth: 3, scale: 1, fitted: true },
    );
    expect(s.items.map((i) => `${i.type}:${i.number ?? "-"}`)).toEqual(["rect:2", "image:-", "rect:1"]);
    expect(s.items[1]).toMatchObject({ number: null, bubble: null, color: null, stroke: null, points: null, w: 1152, h: 720 });
  });

  it("adding, moving and deleting an image are undo steps", () => {
    let h = historyReducer(initialHistory, { type: "load", width: 1280, height: 720 });
    const { id: _id, ...shape } = image("a1", 1304, 1152);
    void _id;
    h = historyReducer(h, { type: "add", shape });
    expect(h.present.selectedId).toBe("a1");
    h = historyReducer(h, { type: "update", id: "a1", patch: { x: 1400, y: 30 } });
    h = historyReducer(h, { type: "remove", id: "a1" });
    expect(h.present.doc?.shapes).toEqual([]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc?.shapes[0]).toMatchObject({ type: "image", x: 1400, y: 30 });
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "undo" });
    expect(h.present.doc?.shapes).toEqual([]);
    h = historyReducer(h, { type: "redo" });
    expect(h.present.doc?.shapes[0]).toMatchObject({ type: "image", src: "image-1.png", x: 1304 });
  });

  it("file names: image-<n>.png, the next free number", () => {
    expect(nextImageFile([])).toBe("image-1.png");
    expect(nextImageFile(["image-1.png", "image-3.png", "other.png"])).toBe("image-4.png");
  });

  it("annotations.json: the images list round-trips; older markups (no list) still open; other file names are refused", () => {
    const doc: AnnotationsDoc = { version: 1, source: { kind: "image", ...base }, shapes: [rect, image("a2", 1304, 1152)], images: [{ file: "image-2.png", width: 320, height: 200 }] };
    expect(parse(serialize(doc))).toEqual({ ok: true, doc });
    const old: AnnotationsDoc = { version: 1, source: { kind: "image", ...base }, shapes: [rect] };
    expect(parse(serialize(old))).toEqual({ ok: true, doc: old });
    const bad = parse(JSON.stringify({ ...doc, images: [{ file: "../source.png", width: 1, height: 1 }] }));
    expect(bad.ok).toBe(false);
    const badSrc = parse(JSON.stringify({ ...doc, shapes: [{ ...image("a2", 0, 10), src: "C:/x.png" }] }));
    expect(badSrc.ok).toBe(false);
  });

  it("the browser store keeps the image files with the markup", async () => {
    const s = new MemoryMarkupStore();
    const doc: AnnotationsDoc = { version: 1, source: { kind: "image", ...base }, shapes: [image("a1", 1304, 1152)], images: [{ file: "image-1.png", width: 320, height: 200 }] };
    const png = new Uint8Array([137, 80, 78, 71, 7]);
    await s.save("m", { sourcePng: new Uint8Array([137, 80, 78, 71]), annotations: doc, exportPng: new Uint8Array([1]), images: [{ name: "image-1.png", png }] });
    const m = await s.open("m");
    expect(m.annotations).toEqual(doc);
    expect(m.images.map((i) => [i.name, [...i.png]])).toEqual([["image-1.png", [...png]]]);
    // An older markup: no images.
    await s.save("old", { sourcePng: new Uint8Array([137, 80, 78, 71]), annotations: { ...doc, shapes: [], images: undefined }, exportPng: new Uint8Array([1]) });
    expect((await s.open("old")).images).toEqual([]);
  });
});
