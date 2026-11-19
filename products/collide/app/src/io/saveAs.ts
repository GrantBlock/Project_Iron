// T45 (Run 4, Grant 2026-11-19, scope 6.3 and 6.4): the header's Save as and the PDF tab's Copy page.
// Save as gives PNG, JPEG and PDF on every tab, and TXT and MD on Markdown tabs only (ISSUES 46). A picture's PDF
// is one page the picture's size; the PDF tab's own PDF is the smallest export (exportPdf.ts, ISSUES 43 stays open).
// No new dependency: JPEG through the canvas, PDF through pdf-lib (already used by the PDF export).
import { PDFDocument } from "pdf-lib";
import { dataUrlToBlob } from "./flatten";

export type SaveFormat = "png" | "jpeg" | "pdf" | "txt" | "md";

export const SAVE_FORMATS: Record<SaveFormat, { label: string; ext: string; mime: string }> = {
  png: { label: "PNG", ext: "png", mime: "image/png" },
  jpeg: { label: "JPEG", ext: "jpg", mime: "image/jpeg" },
  pdf: { label: "PDF", ext: "pdf", mime: "application/pdf" },
  txt: { label: "TXT", ext: "txt", mime: "text/plain" },
  md: { label: "MD", ext: "md", mime: "text/markdown" },
};

/** What Save as offers on a tab: TXT and MD only for Markdown. */
export function saveAsFormats(kind: string): SaveFormat[] {
  return kind === "markdown" ? ["png", "jpeg", "pdf", "txt", "md"] : ["png", "jpeg", "pdf"];
}

/** `<name>-markup.<ext>` for a picture or a PDF (as Export named it); the file's own name for its text. */
export function saveAsName(source: string, f: SaveFormat): string {
  const stem = source.replace(/\.[^./\\]+$/, "") || (f === "txt" || f === "md" ? "Untitled" : "image");
  const ext = SAVE_FORMATS[f].ext;
  return f === "txt" || f === "md" ? `${stem}.${ext}` : `${stem}-markup.${ext}`;
}

/** Screen pixels at 96 per inch to PDF points (72 per inch). */
const PT_PER_PX = 0.75;

/** A one-page PDF of a PNG, the page the picture's size. */
export async function pngToPdf(png: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(new Uint8Array(png));
  const width = img.width * PT_PER_PX;
  const height = img.height * PT_PER_PX;
  doc.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
  return doc.save();
}

/** A PNG data URL as JPEG bytes (browser canvas). JPEG has no transparency: clear parts take the canvas colour token. */
export async function pngToJpeg(dataUrl: string, quality = 0.92): Promise<Uint8Array> {
  const bmp = await createImageBitmap(dataUrlToBlob(dataUrl));
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext("2d");
  if (!g) throw new Error("JPEG encoding failed: no canvas.");
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-canvas").trim() || "Canvas";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0);
  const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", quality));
  if (!out) throw new Error("JPEG encoding failed");
  return new Uint8Array(await out.arrayBuffer());
}

/** Hand bytes to the browser's download (in the desktop app this asks where to save). */
export function downloadFile(bytes: Uint8Array | string, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Save a picture (a PNG data URL) as PNG, JPEG or PDF under `name`. Resolves with what the toast says about where
 * it went. A PDF goes into Markups in the desktop app (as the PDF export does); everything else is a download.
 */
export async function savePicture(dataUrl: string, f: "png" | "jpeg" | "pdf", name: string): Promise<string> {
  const png = new Uint8Array(await dataUrlToBlob(dataUrl).arrayBuffer());
  if (f === "png") return deliver(png, name, f);
  if (f === "jpeg") return deliver(await pngToJpeg(dataUrl), name, f);
  return deliver(await pngToPdf(png), name, f);
}

/** Write `bytes`: a PDF into Markups in the desktop app, anything else (or a browser) as a download. */
export async function deliver(bytes: Uint8Array | string, name: string, f: SaveFormat): Promise<string> {
  const files = typeof window === "undefined" ? undefined : window.collide?.collideFiles;
  if (f === "pdf" && files && typeof bytes !== "string") {
    const saved = await files.exportPdf(name, bytes);
    return `${saved.split(/[\\/]/).pop()} · Documents/Collide/Markups/`;
  }
  downloadFile(bytes, name, SAVE_FORMATS[f].mime);
  return `${name} · downloaded`;
}

/**
 * Copy on a PDF tab (6.3, A, ISSUES 46): the page with the largest area in view; a tie goes to the upper page;
 * with no page in view, the nearest one. `pages` and `view` are tops and heights on one vertical axis.
 */
export function pageInView(pages: readonly { top: number; height: number }[], view: { top: number; height: number }): number {
  let best = 0;
  let bestArea = -1;
  let bestGap = Infinity;
  const v0 = view.top;
  const v1 = view.top + view.height;
  pages.forEach((p, i) => {
    const area = Math.max(0, Math.min(v1, p.top + p.height) - Math.max(v0, p.top));
    const gap = area > 0 ? 0 : Math.min(Math.abs(p.top - v1), Math.abs(p.top + p.height - v0));
    if (area > bestArea || (area === 0 && bestArea === 0 && gap < bestGap)) {
      best = i;
      bestArea = area;
      bestGap = gap;
    }
  });
  return best;
}
