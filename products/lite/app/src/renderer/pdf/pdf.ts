// PDFs from an opened folder (L08), with pdf.js (pdfjs-dist 4.10.38, as Collide). pdf.js and
// its worker are bundled and loaded on first use from the app itself (no CDN, no network);
// eval is off, and standard fonts come from the system (no font data is fetched).
import type { PDFDocumentProxy } from "pdfjs-dist";

let ready: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjs() {
  ready ??= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return ready;
}

/** Opens a PDF from bytes (copied: pdf.js takes ownership of what it is given). */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  return lib.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true }).promise;
}

/** The text of each page, for search. */
export async function pdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await openPdf(bytes);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
      pages.push(text.replace(/\s+/g, " ").trim());
    }
    return pages;
  } finally {
    void doc.destroy();
  }
}
