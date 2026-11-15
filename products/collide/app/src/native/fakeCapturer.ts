// T15: a capturer for the Electron e2e (no real screen grab in the cloud box).
// electron/main.cjs uses it only when COLLIDE_FAKE_CAPTURE=1 and the app is not
// packaged. It reports the real display under the cursor, so the overlay still
// lands on a real monitor, but the frame is a fixed four-colour pattern.

import { CaptureError, type Capture, type Capturer, type FrameImage } from "./capture";
import { physicalOrigin, physicalSize, type ScreenLike } from "./electronCapturer";

/** [r, g, b] of each quadrant of the fake frame. */
export const FAKE_QUADRANTS = {
  topLeft: [200, 40, 30],
  topRight: [30, 160, 60],
  bottomLeft: [40, 70, 200],
  bottomRight: [230, 190, 40],
} as const;

/** Colour of the fake frame at a physical pixel. A pixel on the centre line belongs to the right / bottom half. */
export function fakeColorAt(x: number, y: number, width: number, height: number): readonly [number, number, number] {
  const right = x >= Math.floor(width / 2);
  const bottom = y >= Math.floor(height / 2);
  if (bottom) return right ? FAKE_QUADRANTS.bottomRight : FAKE_QUADRANTS.bottomLeft;
  return right ? FAKE_QUADRANTS.topRight : FAKE_QUADRANTS.topLeft;
}

/** The pattern as opaque BGRA bytes, the layout `nativeImage.createFromBitmap` takes. */
export function fakeBitmap(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = fakeColorAt(x, y, width, height);
      data[i++] = rgb[2];
      data[i++] = rgb[1];
      data[i++] = rgb[0];
      data[i++] = 255;
    }
  }
  return data;
}

export interface FakeCaptureDeps {
  screen: ScreenLike;
  /** Main process: `nativeImage.createFromBitmap`. */
  createBitmap: (bgra: Uint8Array, size: { width: number; height: number }) => FrameImage;
}

export function fakeCapturer({ screen, createBitmap }: FakeCaptureDeps): Capturer {
  return {
    async captureAt(x: number, y: number): Promise<Capture> {
      const display = screen.getDisplayNearestPoint({ x, y });
      if (!display) throw new CaptureError("NoMonitor");
      const size = physicalSize(display);
      const origin = physicalOrigin(screen, display);
      return {
        image: createBitmap(fakeBitmap(size.width, size.height), size),
        monitor: { x: origin.x, y: origin.y, width: size.width, height: size.height, scaleFactor: display.scaleFactor },
        display: { id: display.id, bounds: { ...display.bounds } },
      };
    },
  };
}
