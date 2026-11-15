import type Konva from "konva";
import { Rect as KonvaRect } from "konva/lib/shapes/Rect";

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
/** Editor-only nodes left out of every export: the Transformer and note boxes (with arrows) set to "Hide #". */
const editorOnly = (stage: Konva.Stage) => [...stage.find("Transformer"), ...stage.find(".note-hidden")];

export function flatten(stage: Konva.Stage, size: { width: number; height: number }): Flattened {
  const { width, height } = size;
  if (!(width > 0 && height > 0)) throw new Error("Nothing to export: no image is open.");
  const saved = { x: stage.x(), y: stage.y(), sx: stage.scaleX(), sy: stage.scaleY() };
  const transformers = editorOnly(stage);
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

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Margin around the auto-crop, in image pixels (A). */
export const FIT_PADDING = 24;

/**
 * The smallest whole-pixel box holding the image and every annotation, plus padding.
 * Shapes outside the image (e.g. a circle half off the top-left) are included, never cut.
 */
export function contentBounds(image: { width: number; height: number }, rects: Box[], padding = FIT_PADDING): Box {
  let x0 = 0, y0 = 0, x1 = image.width, y1 = image.height;
  let outside = false;
  for (const r of rects) {
    if (!(r.width >= 0 && r.height >= 0)) continue;
    if (r.x < x0 || r.y < y0 || r.x + r.width > x1 || r.y + r.height > y1) outside = true;
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  // Pad only when something spills over the image; otherwise the copy is the plain image size.
  const p = outside ? padding : 0;
  x0 = Math.floor(x0 - p);
  y0 = Math.floor(y0 - p);
  x1 = Math.ceil(x1 + p);
  y1 = Math.ceil(y1 + p);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Render any area of the canvas (image pixels, may extend past the image) at source
 * resolution, with `background` behind the image. Same exclusions as Export.
 */
export function flattenArea(stage: Konva.Stage, area: Box, background: string): Flattened {
  const box = { x: Math.floor(area.x), y: Math.floor(area.y), width: 0, height: 0 };
  box.width = Math.ceil(area.x + area.width) - box.x;
  box.height = Math.ceil(area.y + area.height) - box.y;
  if (!(box.width > 0 && box.height > 0)) throw new Error("The snip area is empty — drag a box over the canvas.");
  const saved = { x: stage.x(), y: stage.y(), sx: stage.scaleX(), sy: stage.scaleY() };
  const hidden = [...editorOnly(stage), ...stage.find(".snip-selection")];
  const wasVisible = hidden.map((t) => t.visible());
  const layer = stage.getLayers()[0];
  let bg: Konva.Rect | null = null;
  try {
    hidden.forEach((t) => t.visible(false));
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    if (layer) {
      bg = new KonvaRect({ ...box, fill: background, listening: false });
      layer.add(bg);
      bg.moveToBottom();
    }
    const dataUrl = stage.toDataURL({ ...box, pixelRatio: 1, mimeType: "image/png" });
    return { dataUrl, width: box.width, height: box.height };
  } finally {
    bg?.destroy();
    stage.position({ x: saved.x, y: saved.y });
    stage.scale({ x: saved.sx, y: saved.sy });
    hidden.forEach((t, i) => t.visible(wasVisible[i]));
    stage.batchDraw();
  }
}

/**
 * Like {@link flatten}, but auto-cropped to the image plus all annotations (see
 * {@link contentBounds}), with `background` behind anything outside the image.
 */
export function flattenFit(stage: Konva.Stage, size: { width: number; height: number }, background: string): Flattened & { box: Box } {
  if (!(size.width > 0 && size.height > 0)) throw new Error("Nothing to copy: no image is open.");
  const saved = { x: stage.x(), y: stage.y(), sx: stage.scaleX(), sy: stage.scaleY() };
  const transformers = editorOnly(stage);
  const wasVisible = transformers.map((t) => t.visible());
  const layer = stage.getLayers()[0];
  let bg: Konva.Rect | null = null;
  try {
    transformers.forEach((t) => t.visible(false));
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    // At view scale 1 and no pan, client rects are in image pixels.
    const rects = [...stage.find(".shape"), ...stage.find(".note-box"), ...stage.find(".note-leader")]
      .filter((n) => n.isVisible())
      .map((n) => n.getClientRect());
    const box = contentBounds(size, rects);
    if (layer) {
      bg = new KonvaRect({ x: box.x, y: box.y, width: box.width, height: box.height, fill: background, listening: false });
      layer.add(bg);
      bg.moveToBottom();
    }
    const dataUrl = stage.toDataURL({ ...box, pixelRatio: 1, mimeType: "image/png" });
    return { dataUrl, width: box.width, height: box.height, box };
  } finally {
    bg?.destroy();
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

/** The desktop shell's own clipboard write (`window.collide.copyImage`), when the page runs in the Collide app. */
type NativeCopy = (dataUrl: string) => Promise<void>;
const nativeCopy = (): NativeCopy | undefined => {
  const bridge = typeof window === "undefined" ? undefined : window.collide;
  return bridge ? (png) => bridge.copyImage(png) : undefined;
};

/**
 * Put a PNG data URL on the system clipboard as an image (async Clipboard API).
 * In the desktop app, if the web clipboard refuses (e.g. the window is not focused
 * yet right after a snip), the shell writes the image instead.
 */
export async function copyPngToClipboard(
  dataUrl: string,
  clipboard: Clipboard | undefined = globalThis.navigator?.clipboard,
  native: NativeCopy | undefined = nativeCopy(),
): Promise<void> {
  try {
    if (!clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("This window cannot write images to the clipboard — use Export instead.");
    }
    await clipboard.write([new ClipboardItem({ "image/png": dataUrlToBlob(dataUrl) })]);
  } catch (e) {
    if (!native) throw e;
    await native(dataUrl);
  }
}
