// T14: capture the display under the cursor and hold the frozen frame, ported from
// the Rust shell's capture.rs (plus `crop_from_state` from crop.rs). Runs in the
// Electron main process, but imports nothing from Electron: the capturer and the
// PNG decoder are passed in, so the tests run headless with fakes.

import type { CaptureInfo, CropInfo } from "../snip/flow";
import { CropError, cropRect, type LogicalRect } from "../snip/crop";

/** Geometry of a monitor in virtual-desktop physical pixels (origin may be negative). */
export interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

/** The part of an image the capture and the crop use. Electron's `NativeImage` fits as is. */
export interface FrameImage {
  getSize(): { width: number; height: number };
  crop(rect: { x: number; y: number; width: number; height: number }): FrameImage;
  toPNG(): Uint8Array;
}

/** The captured display in Electron's own units (DIP), for placing the overlay on it (T15). */
export interface CapturedDisplay {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}

/** What a capturer returns: the frame plus the monitor it came from. */
export interface Capture {
  image: FrameImage;
  monitor: MonitorInfo;
  display?: CapturedDisplay;
}

/** The frozen frame as held between capture and crop: the PNG that was sent to the page. */
export interface Frame {
  png: Uint8Array;
  monitor: MonitorInfo;
  display?: CapturedDisplay;
}

/** Held state: `null` until a capture succeeds; a failed capture leaves it untouched. */
export class CaptureState {
  frame: Frame | null = null;
}

export type CaptureErrorKind = "CursorUnavailable" | "NoMonitor" | "CaptureFailed" | "EncodeFailed" | "StateUnavailable";

function captureMessage(kind: CaptureErrorKind, detail: string): string {
  switch (kind) {
    case "CursorUnavailable":
      return "Could not read the cursor position — move the mouse and try again.";
    case "NoMonitor":
      return "No monitor found under the cursor — check your display setup and try again.";
    case "CaptureFailed":
      return `Screen capture failed — check screen recording permission and try again. (${detail})`;
    case "EncodeFailed":
      return `Could not encode the captured frame as PNG — try again; if it repeats, restart Collide. (${detail})`;
    case "StateUnavailable":
      // Kept for parity with the Rust type (a poisoned mutex); nothing in the Node port raises it.
      return "Capture state is locked by a failed earlier capture — restart Collide.";
  }
}

/** Typed capture failure. `message` is the cause plus the fix, the same text the Rust shell sent. */
export class CaptureError extends Error {
  readonly kind: CaptureErrorKind;
  readonly detail: string;

  constructor(kind: CaptureErrorKind, detail = "") {
    super(captureMessage(kind, detail));
    this.name = "CaptureError";
    this.kind = kind;
    this.detail = detail;
  }
}

/** Source of frames. Real: `electronCapturer` (electronCapturer.ts). Tests use fakes. */
export interface Capturer {
  /** Capture the display containing (or nearest to) the screen point `(x, y)`. Rejects with a `CaptureError`. */
  captureAt(x: number, y: number): Promise<Capture>;
}

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `data:image/png;base64,...`, the form the page gets (A: fine for now; a 4K frame is a few MB of base64). */
export function pngDataUrl(png: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(png.buffer, png.byteOffset, png.byteLength).toString("base64")}`;
}

export function encodePng(image: FrameImage): Uint8Array {
  let png: Uint8Array;
  try {
    png = image.toPNG();
  } catch (e) {
    throw new CaptureError("EncodeFailed", detailOf(e));
  }
  if (!png || png.length === 0) throw new CaptureError("EncodeFailed", "the frame is empty");
  return png;
}

/** Capture, store in state, and build the result. State changes only on full success. */
export async function captureInto(capturer: Capturer, state: CaptureState, cursor: { x: number; y: number }): Promise<CaptureInfo> {
  let shot: Capture;
  try {
    shot = await capturer.captureAt(cursor.x, cursor.y);
  } catch (e) {
    throw e instanceof CaptureError ? e : new CaptureError("CaptureFailed", detailOf(e));
  }
  const png = encodePng(shot.image);
  const m = shot.monitor;
  const result: CaptureInfo = {
    width: m.width,
    height: m.height,
    x: m.x,
    y: m.y,
    scaleFactor: m.scaleFactor,
    png: pngDataUrl(png),
  };
  state.frame = { png, monitor: m, display: shot.display };
  return result;
}

/**
 * Crop the held frame to a box in logical px relative to the overlay. The frame
 * stays held, so the user can crop again. `decode` turns the held PNG back into
 * an image (main process: `nativeImage.createFromBuffer`). Throws a `CropError`.
 */
export function cropFromState(
  state: CaptureState,
  logical: LogicalRect,
  scale: number,
  decode: (png: Uint8Array) => FrameImage,
): CropInfo {
  const frame = state.frame;
  if (!frame) throw new CropError("NoCapture");
  let image: FrameImage;
  let size: { width: number; height: number };
  try {
    image = decode(frame.png);
    size = image.getSize();
  } catch {
    // A held frame that cannot be read back is as good as none; the fix is the same.
    throw new CropError("NoCapture");
  }
  const r = cropRect(logical, scale, size.width, size.height);
  let png: Uint8Array;
  try {
    png = image.crop({ x: r.x, y: r.y, width: r.w, height: r.h }).toPNG();
  } catch (e) {
    throw new CropError("Encode", detailOf(e));
  }
  if (!png || png.length === 0) throw new CropError("Encode", "the cropped image is empty");
  return { width: r.w, height: r.h, png: pngDataUrl(png) };
}
