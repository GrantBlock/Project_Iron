import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { degrees, PDFArray, PDFDocument, PDFRawStream, PDFRef, StandardFonts, decodePDFRawStream, type PDFPage } from "pdf-lib";
import type { Shape } from "../model";
import { colorOf, drawable, exportPdf, ontoPage, pdfExportName, wrapText, type PdfPaint } from "./exportPdf";

const fixture = () => new Uint8Array(readFileSync(join(__dirname, "../../tests/fixtures/two-pages.pdf")));
const paint: PdfPaint = { box: "#F3F2EF", boxLine: "#98989F", text: "#09090B", badge: "#4C87C4", badgeText: "#F3F2EF", ring: "#09090B" };

const rect: Shape = { id: "s1", type: "rect", x: 40, y: 50, w: 120, h: 60, stroke: "red", strokeWidth: 3, note: "Check the guard" };
const pen: Shape = { id: "s2", type: "pen", x: 200, y: 200, w: 80, h: 40, pts: [0, 0, 0.5, 1, 1, 0], stroke: "blue", strokeWidth: 2 };

/** The page's content streams, decoded, in order. */
function streams(page: PDFPage): string[] {
  const contents = page.node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  return refs.map((r) => {
    const s = page.doc.context.lookup(r as PDFRef);
    if (!(s instanceof PDFRawStream)) return "";
    return new TextDecoder("latin1").decode(decodePDFRawStream(s).decode());
  });
}

describe("PDF export with the markup drawn on each page (RUN3 T38)", () => {
  it("keeps the page count and every page's size, and draws only on the marked page", async () => {
    const original = fixture();
    const before = await PDFDocument.load(original);
    const out = await exportPdf(original, [[], [rect, pen]], paint);
    const after = await PDFDocument.load(out);
    expect(after.getPageCount()).toBe(2);
    expect(after.getPages().map((p) => p.getSize())).toEqual([
      { width: 612, height: 792 },
      { width: 500, height: 360 },
    ]);
    // Page 1 is untouched; page 2's original content is wrapped in q … Q and the markup follows it.
    expect(streams(after.getPage(0))).toEqual(streams(before.getPage(0)));
    const s2 = streams(after.getPage(1));
    const s2Before = streams(before.getPage(1));
    expect(s2.length).toBe(s2Before.length + 3);
    expect(s2[0].trim()).toBe("q");
    expect(s2[s2.length - 2].trim()).toBe("Q");
    const markup = s2[s2.length - 1];
    // Drawn in the page's frame: origin at the top-left (0, 360), y flipped.
    expect(markup).toContain("1 0 0 1 0 360 cm");
    expect(markup).toContain("1 0 0 -1 0 0 cm");
    // The red stroke (#E53935), the pen's blue (#1E88E5), the bubble's text font and the number "1".
    expect(markup).toMatch(/0\.89\d* 0\.22\d* 0\.2\d* RG/);
    expect(markup).toMatch(/0\.11\d* 0\.53\d* 0\.89\d* RG/);
    // One font resource for every label on the page.
    expect(new Set(markup.match(/\/\S+ \d+(?:\.\d+)? Tf/g)?.map((t) => t.split(" ")[0])).size).toBe(1);
    expect(markup).toMatch(/<31> Tj/);
    expect(markup).toContain(`<${Buffer.from("Check").toString("hex").toUpperCase()}`);
  });

  it("draws through the page's rotation and CropBox", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 300]);
    page.setRotation(degrees(90));
    page.setCropBox(20, 30, 360, 250);
    const out = await exportPdf(await doc.save(), [[rect]], paint);
    const p = (await PDFDocument.load(out)).getPage(0);
    const markup = streams(p).pop()!;
    // A 90° page: the shown top-left is the CropBox's bottom-left (20, 30), turned a quarter.
    expect(markup).toContain("1 0 0 1 20 30 cm");
    expect(markup).toMatch(/(?:^|\n)0\.0+612\d* 1 -1 0\.0+612\d* 0 0 cm/);
  });

  it("refuses markup for a different number of pages", async () => {
    await expect(exportPdf(fixture(), [[rect]], paint)).rejects.toThrow("The markup has 1 pages but the PDF has 2");
  });

  it("moves a bubble that lies beside the page onto it, at the nearest edge", () => {
    const page = { width: 500, height: 360 };
    expect(ontoPage({ x: -190, y: 20, w: 150, h: 30, side: "left" }, page)).toEqual({ x: 0, y: 20, w: 150, h: 30 });
    expect(ontoPage({ x: 540, y: 350, w: 150, h: 30, side: "right" }, page)).toEqual({ x: 350, y: 330, w: 150, h: 30 });
    const inside = { x: 10, y: 10, w: 50, h: 20 };
    expect(ontoPage(inside, page)).toBe(inside);
  });

  it("wraps notes to the bubble, cuts long words, and keeps only characters the font has", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const measure = (s: string, size: number) => font.widthOfTextAtSize(s, size);
    const lines = wrapText("one two three four five six", 60, 11, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => measure(l, 11) <= 60)).toBe(true);
    expect(lines.join(" ")).toBe("one two three four five six");
    expect(wrapText("a\nb", 100, 11, measure)).toEqual(["a", "b"]);
    expect(wrapText("x".repeat(80), 50, 11, measure).every((l) => measure(l, 11) <= 50)).toBe(true);
    expect(drawable(font, "Ø 5 °C → ok")).toBe("Ø 5 °C ? ok");
  });

  it("reads token colours and names the file", () => {
    expect(colorOf("#4C87C4")).toEqual({ type: "RGB", red: 0x4c / 255, green: 0x87 / 255, blue: 0xc4 / 255 });
    expect(colorOf("rgb(255, 0, 0)")).toEqual({ type: "RGB", red: 1, green: 0, blue: 0 });
    expect(colorOf("nonsense")).toEqual({ type: "RGB", red: 0, green: 0, blue: 0 });
    expect(pdfExportName("Pump skid.pdf")).toBe("Pump skid-markup.pdf");
    expect(pdfExportName("../x?.PDF")).toBe("x-markup.pdf");
  });
});
