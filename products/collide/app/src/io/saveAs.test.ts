// T45 acceptance (Run 4, Grant 2026-11-19, scope items 6.3 and 6.4): the pure parts of Save as and of Copy on a PDF.
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { TestImage } from "../native/testImage";
import { pageInView, pngToPdf, saveAsFormats, saveAsName, SAVE_FORMATS } from "./saveAs";

describe("Save as formats (6.4)", () => {
  it("PNG, JPEG and PDF for every tab; TXT and MD for Markdown tabs only", () => {
    expect(saveAsFormats("snip")).toEqual(["png", "jpeg", "pdf"]);
    expect(saveAsFormats("image")).toEqual(["png", "jpeg", "pdf"]);
    expect(saveAsFormats("pdf")).toEqual(["png", "jpeg", "pdf"]);
    expect(saveAsFormats("markdown")).toEqual(["png", "jpeg", "pdf", "txt", "md"]);
  });

  it("each format has its label and file extension", () => {
    expect(Object.fromEntries(Object.entries(SAVE_FORMATS).map(([k, v]) => [k, [v.label, v.ext]]))).toEqual({
      png: ["PNG", "png"],
      jpeg: ["JPEG", "jpg"],
      pdf: ["PDF", "pdf"],
      txt: ["TXT", "txt"],
      md: ["MD", "md"],
    });
  });

  it("pictures and PDFs are named <name>-markup; the text keeps the file's own name", () => {
    expect(saveAsName("sample-400x300.png", "png")).toBe("sample-400x300-markup.png");
    expect(saveAsName("sample-400x300.png", "jpeg")).toBe("sample-400x300-markup.jpg");
    expect(saveAsName("two-pages.pdf", "pdf")).toBe("two-pages-markup.pdf");
    expect(saveAsName("snip-2026-11-19-1200", "pdf")).toBe("snip-2026-11-19-1200-markup.pdf");
    expect(saveAsName("Notes.md", "txt")).toBe("Notes.txt");
    expect(saveAsName("Notes.md", "md")).toBe("Notes.md");
    expect(saveAsName("", "png")).toBe("image-markup.png");
  });
});

describe("Save as PDF from a picture (6.4)", () => {
  it("gives a one-page PDF the picture's size (96 px to the inch) with the picture on it", async () => {
    const png = TestImage.marked(40, 20).toPNG();
    const bytes = await pngToPdf(png);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 30, height: 15 });
    // The page draws one image XObject.
    const xobjects = doc.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    expect(xobjects?.keys()).toHaveLength(1);
  });
});

describe("Copy on a PDF tab: the page nearest the centre of the view (6.3, A)", () => {
  const pages = [
    { top: 0, height: 1000 },
    { top: 1010, height: 1000 },
    { top: 2020, height: 500 },
  ];
  it("is the page whose visible area is largest", () => {
    expect(pageInView(pages, { top: 0, height: 800 })).toBe(0);
    expect(pageInView(pages, { top: 700, height: 800 })).toBe(1);
    expect(pageInView(pages, { top: 1900, height: 800 })).toBe(2);
  });
  it("a tie goes to the upper page", () => {
    // 490 px of page 1 (510 to 1000) and 490 px of page 2 (1010 to 1500) are in view.
    expect(pageInView(pages, { top: 510, height: 990 })).toBe(0);
  });
  it("with nothing in view it is the nearest page", () => {
    expect(pageInView(pages, { top: 5000, height: 400 })).toBe(2);
    expect(pageInView(pages, { top: -900, height: 400 })).toBe(0);
    expect(pageInView([], { top: 0, height: 400 })).toBe(0);
  });
});
