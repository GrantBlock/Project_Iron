import type Konva from "konva";

export interface Flattened {
  /** PNG data URL, exactly `width` x `height` pixels. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Flatten the image + shapes on a Konva stage to a PNG at the source image's
 * resolution, independent of the current zoom/pan. No selection outline, no
 * Transformer, no branding. The stage's view and the Transformer's visibility are
 * restored before returning (the work is synchronous, so nothing repaints in between).
 */
export function flatten(stage: Konva.Stage, size: { width: number; height: number }): Flattened {
  const { width, height } = size;
  if (!(width > 0 && height > 0)) throw new Error("Nothing to export: no image is open.");
  const saved = { x: stage.x(), y: stage.y(), sx: stage.scaleX(), sy: stage.scaleY() };
  const transformers = stage.find("Transformer");
  const wasVisible = transformers.map((t) => t.visible());
  try {
    transformers.forEach((t) => t.visible(false));
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    // pixelRatio 1 at view scale 1: one image pixel is one output pixel.
    const dataUrl = stage.toDataURL({ x: 0, y: 0, width, height, pixelRatio: 1, mimeType: "image/png" });
    return { dataUrl, width, height };
  } finally {
    stage.position({ x: saved.x, y: saved.y });
    stage.scale({ x: saved.sx, y: saved.sy });
    transformers.forEach((t, i) => t.visible(wasVisible[i]));
    stage.batchDraw();
  }
}

/** Convert a PNG data URL to a Blob (for saving; T06 writes it to disk). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Default export file name: source name without extension + "-markup.png". */
export function exportFileName(sourceName: string): string {
  const base = sourceName.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}-markup.png`;
}

/** Browser download of a PNG data URL. */
export function downloadPng(dataUrl: string, fileName: string): void {
  const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
