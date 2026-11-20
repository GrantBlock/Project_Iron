// RUN3 T38: pdf.js (pdfjs-dist, approved) reads and draws the PDF. The library and its worker are part of the
// build (Vite emits the worker as one of the app's own files, served under collide:// in the desktop app), so
// nothing is fetched from the internet and a PDF opens offline. pdf.js is loaded the first time a PDF opens.
// Scripts in a PDF never run (isEvalSupported off, no scripting); fonts the PDF does not carry use the system's.
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

type PdfJs = typeof import("pdfjs-dist");
let lib: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = workerUrl;
    return m;
  });
  return lib;
}

/** A page's size as shown, in PDF points (its rotation applied), as pdf.js lays it out at scale 1. */
export interface PageSize {
  width: number;
  height: number;
}

export const NOT_A_PDF = "Could not open the PDF";

/** Open a PDF from its bytes (copied: pdf.js hands its buffer to the worker). */
export async function openPdfDoc(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  const task = m.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true, stopAtErrors: false });
  const r = await task.promise.then(
    (doc) => ({ doc, why: "" }),
    (e: unknown) => ({ doc: null, why: e instanceof Error ? e.message : String(e) }),
  );
  if (r.doc) return r.doc;
  if (/password/i.test(r.why)) throw new Error("This PDF needs a password, so Collide cannot open it. Save a copy without a password, then open that copy.");
  throw new Error(`The file is not a PDF Collide can read (${r.why}). Open another file.`);
}

/** Every page's shown size, in points. */
export async function pageSizes(doc: PDFDocumentProxy): Promise<PageSize[]> {
  const out: PageSize[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const v = (await doc.getPage(i)).getViewport({ scale: 1 });
    out.push({ width: v.width, height: v.height });
  }
  return out;
}

/** Draw page `index` (from 0) into `canvas` at `scale` canvas pixels per point. Resolves when it is drawn. */
export async function drawPage(doc: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, scale: number): Promise<void> {
  const page = await doc.getPage(index + 1);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The page cannot be drawn: this window has no 2D canvas.");
  await page.render({ canvasContext: ctx, viewport }).promise;
}
