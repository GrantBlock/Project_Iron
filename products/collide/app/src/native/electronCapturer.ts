// T14: the real capturer, built on Electron's `screen` and `desktopCapturer`.
// Both are passed in (typed by the few members used), so this file imports
// nothing from Electron and its display maths is unit-tested with fakes.

import { CaptureError, captureInto, type Capture, type CaptureState, type Capturer, type FrameImage } from "./capture";
import type { CaptureInfo } from "../snip/flow";

interface Point {
  x: number;
  y: number;
}

export interface DisplayLike {
  id: number;
  /** DIP, virtual-desktop origin (negative left of / above the primary display). */
  bounds: { x: number; y: number; width: number; height: number };
  /** DIP. */
  size: { width: number; height: number };
  scaleFactor: number;
}

export interface ScreenLike {
  getCursorScreenPoint(): Point;
  getDisplayNearestPoint(point: Point): DisplayLike;
  /** DIP -> physical px. Windows and Linux only. */
  dipToScreenPoint?(point: Point): Point;
}

export interface ScreenSourceLike {
  /** Matches `Display.id`; an empty string where the platform cannot tell. */
  display_id: string;
  thumbnail: FrameImage & { isEmpty(): boolean };
}

export interface DesktopCapturerLike {
  getSources(options: { types: string[]; thumbnailSize: { width: number; height: number } }): Promise<ScreenSourceLike[]>;
}

export interface ElectronCaptureDeps {
  screen: ScreenLike;
  desktopCapturer: DesktopCapturerLike;
}

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Full physical size of a display: DIP size x scale factor (1920x1080 at 100%, 125%, 150% or 200%). */
export function physicalSize(display: DisplayLike): { width: number; height: number } {
  return {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor),
  };
}

/** A display's top-left corner in virtual-desktop physical px (the platform's own conversion where there is one). */
export function physicalOrigin(screen: ScreenLike, display: DisplayLike): Point {
  const dip = { x: display.bounds.x, y: display.bounds.y };
  const origin = screen.dipToScreenPoint ? screen.dipToScreenPoint(dip) : { x: dip.x * display.scaleFactor, y: dip.y * display.scaleFactor };
  return { x: Math.round(origin.x), y: Math.round(origin.y) };
}

/**
 * The screen source for a display. Matched by id; a lone source is that display
 * (some platforms give no usable id). (A) With several sources and no id match
 * there is no safe choice, so none is returned rather than freeze the wrong monitor.
 */
export function sourceForDisplay<S extends { display_id: string }>(sources: S[], display: DisplayLike): S | undefined {
  const byId = sources.find((s) => s.display_id === String(display.id));
  if (byId) return byId;
  return sources.length === 1 ? sources[0] : undefined;
}

/** Capture the display nearest a DIP point at its full physical size. */
export function electronCapturer({ screen, desktopCapturer }: ElectronCaptureDeps): Capturer {
  return {
    async captureAt(x: number, y: number): Promise<Capture> {
      let display: DisplayLike;
      try {
        display = screen.getDisplayNearestPoint({ x, y });
      } catch {
        throw new CaptureError("NoMonitor");
      }
      if (!display || !positive(display.scaleFactor) || !positive(display.size?.width) || !positive(display.size?.height)) {
        throw new CaptureError("NoMonitor");
      }

      let sources: ScreenSourceLike[];
      try {
        sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: physicalSize(display) });
      } catch (e) {
        throw new CaptureError("CaptureFailed", detailOf(e));
      }
      const source = sourceForDisplay(sources ?? [], display);
      if (!source) throw new CaptureError("NoMonitor");

      const image = source.thumbnail;
      if (!image || image.isEmpty()) throw new CaptureError("CaptureFailed", "the screen returned an empty frame");
      // The frame's own size is the truth for the overlay and the crop.
      const size = image.getSize();
      if (!positive(size.width) || !positive(size.height)) {
        throw new CaptureError("CaptureFailed", "the screen returned an empty frame");
      }

      const origin = physicalOrigin(screen, display);

      return {
        image,
        monitor: {
          x: origin.x,
          y: origin.y,
          width: size.width,
          height: size.height,
          scaleFactor: display.scaleFactor,
        },
        display: { id: display.id, bounds: { ...display.bounds } },
      };
    },
  };
}

/** `capture_monitor`: read the cursor, capture its display, hold the frame. Rejects with a `CaptureError`. */
export async function captureMonitor(deps: ElectronCaptureDeps, state: CaptureState, capturer: Capturer = electronCapturer(deps)): Promise<CaptureInfo> {
  let cursor: Point;
  try {
    cursor = deps.screen.getCursorScreenPoint();
  } catch {
    throw new CaptureError("CursorUnavailable");
  }
  if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) throw new CaptureError("CursorUnavailable");
  return captureInto(capturer, state, cursor);
}
