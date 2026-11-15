// T15: `copyImage(png)`, the desktop fallback for Copy and auto-copy when the web
// clipboard refuses (e.g. the editor is not focused yet right after a snip).
// Electron's `clipboard` and `nativeImage` are passed in.

export const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

export interface ClipboardDeps<Image extends { isEmpty(): boolean }> {
  /** Main process: `nativeImage.createFromBuffer`. */
  imageFromPng: (png: Uint8Array) => Image;
  /** Main process: `clipboard.writeImage`. */
  writeImage: (image: Image) => void;
}

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NOT_A_PNG = "The image to copy is not a PNG — try Copy again, or use Export instead.";

/** Put a PNG data URL (`data:image/png;base64,...`, what the editor's Copy produces) on the clipboard as an image. */
export function copyImage<Image extends { isEmpty(): boolean }>(png: unknown, deps: ClipboardDeps<Image>): void {
  if (typeof png !== "string" || !png.startsWith(PNG_DATA_URL_PREFIX)) throw new Error(NOT_A_PNG);
  const bytes = Buffer.from(png.slice(PNG_DATA_URL_PREFIX.length), "base64");
  let image: Image;
  try {
    image = deps.imageFromPng(bytes);
  } catch {
    throw new Error(NOT_A_PNG);
  }
  if (bytes.length === 0 || image.isEmpty()) throw new Error(NOT_A_PNG);
  try {
    deps.writeImage(image);
  } catch (e) {
    throw new Error(`Could not write to the clipboard (${detailOf(e)}) — try Copy again, or use Export instead.`);
  }
}
