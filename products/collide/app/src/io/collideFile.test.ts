// RUN3 T35: the .collide package: encode and decode, the round trip, and every way a bad package is refused.
import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import type { AnnotationsDoc, Shape } from "../model";
import {
  collideFileName,
  dataUrlBytes,
  decodeCollide,
  encodeCollide,
  isSafeEntryName,
  markdownSummary,
  MAX_UNPACKED,
  OPEN_FAILED,
  pictureDataUrl,
  pictureLinks,
  picturePath,
  snipSummary,
  isPdf,
  pdfSummary,
  type MarkdownPackage,
  type PdfPackage,
  type SnipPackage,
} from "./collideFile";
import { MarkupError } from "./markupStore";

const png = (tag: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, tag + 1, tag + 2]);

// Every kind of item with every setting a card, a bubble and the order can have.
const SHAPES: Shape[] = [
  { id: "a1", type: "rect", x: 10, y: 20, w: 120, h: 60, stroke: "red", strokeWidth: 3, callout: 1, note: "Guard gap", label: { x: 400, y: 30, w: 180 }, fillPct: 30, hideOutline: true },
  { id: "a2", type: "image", src: "image-1.png", x: 664, y: 0, w: 640, h: 360, stroke: "gray", strokeWidth: 0 },
  { id: "a3", type: "ellipse", x: 700, y: 40, w: 90, h: 50, stroke: "blue", strokeWidth: 2, callout: 2, note: "Valve", hideText: true, hideBubble: false },
  { id: "a4", type: "pen", x: 5, y: 5, w: 40, h: 30, stroke: "#FF00AA", strokeWidth: 4, pts: [0, 0, 0.5, 1, 1, 0.25] },
  { id: "a5", type: "line", x: 50, y: 50, w: 100, h: 10, stroke: "green", strokeWidth: 2, pts: [0, 0, 1, 1], callout: 3, note: "", hideNumber: true },
  { id: "a6", type: "point", x: 300, y: 200, w: 0, h: 0, stroke: "red", strokeWidth: 3, callout: 4, note: "Here" },
];

const DOC: AnnotationsDoc = { version: 1, source: { kind: "image", width: 640, height: 360 }, shapes: SHAPES, images: [{ file: "image-1.png", width: 1280, height: 720 }] };

const snip = (): SnipPackage => ({ kind: "snip", title: "Line 3 conveyor guard", doc: DOC, source: png(1), images: [{ name: "image-1.png", png: png(2) }], preview: png(3) });

const md = (): MarkdownPackage => ({
  kind: "markdown",
  title: "P06-Project-Workspace-Spec.md",
  file: "P06-Project-Workspace-Spec.md",
  text: "# P06\n\n![Guard](images/line-3-conveyor-guard.png)\n\nUnicode: ×, —, “quotes”\n",
  shapes: [SHAPES[0], SHAPES[2]],
  pictures: [{ path: "images/line-3-conveyor-guard.png", bytes: png(4) }],
  preview: png(5),
});

/** A zip with exactly these entries (to build bad packages by hand). Bytes are copied into this realm for fflate. */
const zip = (entries: Record<string, Uint8Array | string>) =>
  zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, new Uint8Array(typeof v === "string" ? strToU8(v) : v)])) as Zippable);

/** A real package's files and manifest, so a test can change one of them. */
const manifestOf = (bytes: Uint8Array) => {
  const files = unzipSync(bytes);
  return { files, manifest: JSON.parse(new TextDecoder().decode(files["manifest.json"])) as Record<string, unknown> };
};

const refusal = (bytes: Uint8Array) => {
  try {
    decodeCollide(bytes);
  } catch (e) {
    expect(e).toBeInstanceOf(MarkupError);
    expect((e as MarkupError).title).toBe(OPEN_FAILED);
    return (e as Error).message;
  }
  throw new Error("the package was not refused");
};

describe(".collide round trip", () => {
  it("a snip with two sources: the same items in the same order, the same source bytes, every setting kept", () => {
    const bytes = encodeCollide(snip());
    const back = decodeCollide(bytes);
    expect(back).toEqual(snip());
    if (back.kind !== "snip") throw new Error("kind");
    expect(back.doc.shapes.map((s) => s.id)).toEqual(["a1", "a2", "a3", "a4", "a5", "a6"]);
    // Encoding the decoded package again gives the same files.
    expect(decodeCollide(encodeCollide(back))).toEqual(back);
  });

  it("the package layout: manifest.json, sources/ in their own formats, preview.png", () => {
    const { files, manifest } = manifestOf(encodeCollide(snip()));
    expect(Object.keys(files).sort()).toEqual(["manifest.json", "preview.png", "sources/image-1.png", "sources/source.png"]);
    expect(manifest).toMatchObject({ format: "collide", version: 1, kind: "snip", title: "Line 3 conveyor guard", order: "back-to-front", preview: "preview.png" });
    expect(manifest.source).toEqual({ file: "sources/source.png", width: 640, height: 360 });
    expect(manifest.images).toEqual([{ file: "sources/image-1.png", width: 1280, height: 720 }]);
    expect(manifest.items).toEqual(SHAPES);
    expect([...files["sources/source.png"]]).toEqual([...png(1)]);
  });

  it("a snip without added images has no images list in its doc", () => {
    const p: SnipPackage = { ...snip(), doc: { version: 1, source: DOC.source, shapes: [SHAPES[0]] }, images: [] };
    expect(decodeCollide(encodeCollide(p))).toEqual(p);
  });

  it("Markdown: the .md text byte for byte, its pictures and the page items", () => {
    const bytes = encodeCollide(md());
    expect(decodeCollide(bytes)).toEqual(md());
    const { files, manifest } = manifestOf(bytes);
    expect(Object.keys(files).sort()).toEqual(["manifest.json", "preview.png", "sources/P06-Project-Workspace-Spec.md", "sources/images/line-3-conveyor-guard.png"]);
    expect(manifest).toMatchObject({ kind: "markdown", source: { file: "sources/P06-Project-Workspace-Spec.md" }, pictures: [{ file: "sources/images/line-3-conveyor-guard.png" }] });
  });

  it("a picture path that cannot go in a package is left out, not written", () => {
    const p = { ...md(), pictures: [...md().pictures, { path: "../evil.png", bytes: png(9) }, { path: "notes.txt", bytes: png(9) }] };
    const back = decodeCollide(encodeCollide(p));
    expect(back.kind === "markdown" && back.pictures.map((x) => x.path)).toEqual(["images/line-3-conveyor-guard.png"]);
  });

  it("a .md name that is not a plain file name is refused on save", () => {
    expect(() => encodeCollide({ ...md(), file: "../x.md" })).toThrow(/cannot be used as the \.md file's name/);
  });
});

describe(".collide refuses bad packages", () => {
  it("not a zip", () => {
    expect(refusal(strToU8("hello, this is not a zip file at all"))).toMatch(/not a Collide file/);
  });

  it.each(["../evil.txt", "sources/../../evil.png", "/etc/passwd", "C:/Windows/evil.dll", "sources\\..\\evil.png", "sources//x.png", ".hidden", "sources/x.png. "])(
    "zip-slip: the entry %j is refused before anything is unpacked",
    (name) => {
      const good = manifestOf(encodeCollide(snip())).files;
      expect(refusal(zip({ ...good, [name]: "x" }))).toMatch(/points outside the package/);
    },
  );

  it("isSafeEntryName", () => {
    for (const ok of ["manifest.json", "sources/source.png", "sources/images/pasted-120000.png", "sources/P06 Spec (v2).md", "sources/"]) expect(isSafeEntryName(ok), ok).toBe(true);
    for (const bad of ["", "..", "a/../b", "/a", "\\a", "a\\b", "C:x", "a//b", "a/./b", "a\u0000b", ".git/config", "a. ", "a."]) expect(isSafeEntryName(bad), bad).toBe(false);
  });

  it("an entry the manifest does not list", () => {
    const good = manifestOf(encodeCollide(snip())).files;
    expect(refusal(zip({ ...good, "sources/extra.png": png(7) }))).toMatch(/file the manifest does not list \(sources\/extra\.png\)/);
  });

  it("a listed source that is missing", () => {
    const { files } = manifestOf(encodeCollide(snip()));
    delete files["sources/image-1.png"];
    expect(refusal(zip(files))).toMatch(/An added image \(sources\/image-1\.png\) is missing/);
  });

  it("no manifest, or a manifest that is not JSON", () => {
    const { files } = manifestOf(encodeCollide(snip()));
    const { "manifest.json": _m, ...rest } = files;
    void _m;
    expect(refusal(zip(rest))).toMatch(/manifest \(manifest\.json\) is missing/);
    expect(refusal(zip({ ...rest, "manifest.json": "{ not json" }))).toMatch(/manifest\.json is not valid JSON/);
  });

  it("a manifest zod refuses names the field", () => {
    const { files, manifest } = manifestOf(encodeCollide(snip()));
    const bad = (m: Record<string, unknown>) => refusal(zip({ ...files, "manifest.json": JSON.stringify(m) }));
    expect(bad({ ...manifest, version: 2 })).toMatch(/^manifest\.json: version /);
    expect(bad({ ...manifest, format: "other" })).toMatch(/^manifest\.json: format /);
    expect(bad({ ...manifest, items: [{ ...SHAPES[0], w: -1 }] })).toMatch(/^manifest\.json: items\[0\]\.w /);
    expect(bad({ ...manifest, kind: "video" })).toMatch(/^manifest\.json: kind /);
    // An added image's path in the manifest is checked too: it must be sources/image-<n>.png.
    expect(bad({ ...manifest, images: [{ file: "sources/../x.png", width: 1, height: 1 }] })).toMatch(/^manifest\.json: images\[0\]\.file /);
    expect(bad({ ...manifest, items: [SHAPES[0], SHAPES[0]] })).toMatch(/two items have the id "a1"/);
  });

  it("an image item whose file is not in the package", () => {
    const { files, manifest } = manifestOf(encodeCollide(snip()));
    const { "sources/image-1.png": _i, ...rest } = files;
    void _i;
    expect(refusal(zip({ ...rest, "manifest.json": JSON.stringify({ ...manifest, images: [] }) }))).toMatch(/item "a2" shows image-1\.png, which the package does not have/);
  });

  it("a source that is not a PNG", () => {
    const { files } = manifestOf(encodeCollide(snip()));
    expect(refusal(zip({ ...files, "sources/source.png": "GIF89a" }))).toMatch(/sources\/source\.png is not a PNG/);
  });

  it("a Markdown package with an image item or a picture of another type", () => {
    const { files, manifest } = manifestOf(encodeCollide(md()));
    expect(refusal(zip({ ...files, "manifest.json": JSON.stringify({ ...manifest, items: [SHAPES[1]] }) }))).toMatch(/item "a2" is an image/);
    expect(refusal(zip({ ...files, "sources/a.svg": "<svg/>", "manifest.json": JSON.stringify({ ...manifest, pictures: [...(manifest.pictures as object[]), { file: "sources/a.svg" }] }) }))).toMatch(/sources\/a\.svg is not a picture/);
  });

  it("a package that unpacks too big is refused from the sizes it declares", () => {
    const { files } = manifestOf(encodeCollide(snip()));
    const bytes = zip(files);
    // Patch the declared (unpacked) size of the first central directory entry to more than the cap.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let first = -1;
    for (let i = 0; i < bytes.length - 4 && first < 0; i++) if (view.getUint32(i, true) === 0x02014b50) first = i;
    view.setUint32(first + 24, MAX_UNPACKED + 1, true);
    expect(refusal(bytes)).toMatch(/unpacks to more than 256 MB/);
  });
});

describe(".collide words and names", () => {
  it("the toast's summary, as the prototype words it", () => {
    expect(snipSummary(SHAPES)).toBe("2 sources and 6 items");
    expect(snipSummary([SHAPES[0]])).toBe("1 source and 1 item");
    expect(markdownSummary("# x\n![a](images/pasted-120000.png)\n", [SHAPES[0], SHAPES[2]])).toBe("the .md file and 1 pasted image with 2 items");
    expect(markdownSummary(md().text, [])).toBe("the .md file with 0 items");
  });

  it("file names", () => {
    expect(collideFileName({ kind: "snip", title: "Line 3 conveyor guard" })).toBe("line-3-conveyor-guard.collide");
    expect(collideFileName({ kind: "markdown", title: "x", file: "P06-Project-Workspace-Spec.md" })).toBe("P06-Project-Workspace-Spec.collide");
    expect(collideFileName({ kind: "snip", title: "///" })).toBe("snip.collide");
    expect(collideFileName({ kind: "markdown", title: "x", file: "../../a b.md" })).toBe("a-b.collide");
  });

  it("picture links, paths and data URLs", () => {
    expect(pictureLinks('![a](images/a.png) ![b](./images/b.jpg "t") ![a2](images/a.png) [link](x.md)')).toEqual(["images/a.png", "./images/b.jpg"]);
    expect(picturePath("./images/b.jpg")).toBe("images/b.jpg");
    expect(picturePath("images/a.svg")).toBeNull();
    expect(picturePath("../a.png")).toBeNull();
    const url = pictureDataUrl("images/a.png", png(1))!;
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect([...dataUrlBytes(url)!]).toEqual([...png(1)]);
    expect(pictureDataUrl("a.bmp", png(1))).toBeNull();
    expect(dataUrlBytes("nope")).toBeNull();
  });
});

// RUN3 T38: a PDF package: the original PDF in sources/, the pages with their own items, the page in front.
describe(".collide with a PDF", () => {
  const pdfBytes = () => new Uint8Array([...strToU8("%PDF-1.7\n%âã\n1 0 obj\n<<>>\nendobj\n%%EOF\n")]);
  const PAGE2: Shape[] = [
    { id: "s1", type: "rect", x: 40, y: 50, w: 120, h: 60, stroke: "red", strokeWidth: 3, note: "Check the guard", label: { x: 300, y: 20, w: 150 } },
    { id: "s2", type: "pen", x: 200, y: 200, w: 80, h: 40, stroke: "blue", strokeWidth: 2, pts: [0, 0, 0.5, 1, 1, 0] },
  ];
  const pdf = (): PdfPackage => ({
    kind: "pdf",
    title: "two-pages.pdf",
    name: "two-pages.pdf",
    pdf: pdfBytes(),
    page: 1,
    pages: [
      { width: 612, height: 792, shapes: [] },
      { width: 500, height: 360, shapes: PAGE2 },
    ],
    preview: png(6),
  });

  it("round trip: the PDF byte for byte, each page's items in order, sizes and the page in front", () => {
    const bytes = encodeCollide(pdf());
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual(["manifest.json", "preview.png", "sources/source.pdf"]);
    const m = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
    expect(m).toMatchObject({ format: "collide", version: 1, kind: "pdf", page: 1, source: { file: "sources/source.pdf", name: "two-pages.pdf" } });
    expect(m.pages.map((p: { width: number; height: number; items: Shape[] }) => [p.width, p.height, p.items.length])).toEqual([
      [612, 792, 0],
      [500, 360, 2],
    ]);
    expect(decodeCollide(bytes)).toEqual(pdf());
  });

  it("refuses a source that is not a PDF, a page in front past the end, an image item, and two items with one id", () => {
    const m = JSON.parse(new TextDecoder().decode(unzipSync(encodeCollide(pdf()))["manifest.json"]));
    const open = (manifest: unknown, source: Uint8Array = pdfBytes()) => () => decodeCollide(zip({ "manifest.json": JSON.stringify(manifest), "preview.png": png(6), "sources/source.pdf": source }));
    expect(open(m, png(1))).toThrow("sources/source.pdf is not a PDF.");
    expect(open({ ...m, page: 2 })).toThrow("page 3 is in front, but the PDF has 2 pages");
    expect(open({ ...m, pages: [{ width: 10, height: 10, items: [{ id: "i", type: "image", src: "image-1.png", x: 0, y: 0, w: 1, h: 1, stroke: "gray", strokeWidth: 0 }] }], page: 0 })).toThrow("which a PDF page cannot hold");
    expect(open({ ...m, pages: [{ width: 10, height: 10, items: [PAGE2[0], PAGE2[0]] }], page: 0 })).toThrow('two items have the id "s1"');
    expect(open({ ...m, pages: [] })).toThrow("manifest.json: pages");
    // The same id on two pages is fine: each page is its own markup.
    expect(() => open({ ...m, pages: [{ width: 10, height: 10, items: [PAGE2[0]] }, { width: 10, height: 10, items: [PAGE2[0]] }] })()).not.toThrow();
    expect(() => encodeCollide({ ...pdf(), pdf: png(1) })).toThrow("The PDF to save is not a PDF");
  });

  it("an older package (snip, Markdown) still opens, the words and the file name", () => {
    expect(decodeCollide(encodeCollide(snip())).kind).toBe("snip");
    expect(decodeCollide(encodeCollide(md())).kind).toBe("markdown");
    expect(pdfSummary(pdf().pages)).toBe("the PDF (2 pages) with 2 items");
    expect(collideFileName({ kind: "pdf", title: "Pump skid P&ID.pdf", file: "Pump skid P&ID.pdf" })).toBe("Pump-skid-P-ID.collide");
    expect(isPdf(pdfBytes())).toBe(true);
    expect(isPdf(new Uint8Array([1, 2, ...pdfBytes()]))).toBe(true);
    expect(isPdf(png(1))).toBe(false);
  });
});
