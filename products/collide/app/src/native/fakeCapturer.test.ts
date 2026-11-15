// T15: the fake capturer behind the Electron e2e (COLLIDE_FAKE_CAPTURE=1, never in a packaged app).
import { describe, expect, it } from "vitest";
import { CaptureState, cropFromState } from "./capture";
import { captureMonitor } from "./electronCapturer";
import { FAKE_QUADRANTS, fakeBitmap, fakeCapturer, fakeColorAt } from "./fakeCapturer";
import { decodeDataUrl, decodePng, TestImage } from "./testImage";

/** BGRA bytes -> the RGBA test image, as `nativeImage.createFromBitmap` reads them. */
const createBitmap = (bgra: Uint8Array, size: { width: number; height: number }) =>
  TestImage.fromFn(size.width, size.height, (x, y) => {
    const i = (y * size.width + x) * 4;
    return [bgra[i + 2], bgra[i + 1], bgra[i], bgra[i + 3]];
  });

const display = { id: 7, bounds: { x: -80, y: 0, width: 80, height: 40 }, size: { width: 80, height: 40 }, scaleFactor: 1.5 };
const screen = { getCursorScreenPoint: () => ({ x: -10, y: 10 }), getDisplayNearestPoint: () => display };

describe("fakeCapturer", () => {
  it("reports the real display under the cursor at its physical size, with the display held for the overlay", async () => {
    const state = new CaptureState();
    const cap = await captureMonitor({ screen, desktopCapturer: { getSources: async () => [] } }, state, fakeCapturer({ screen, createBitmap }));
    expect([cap.x, cap.y, cap.width, cap.height, cap.scaleFactor]).toEqual([-120, 0, 120, 60, 1.5]);
    expect(decodeDataUrl(cap.png).getSize()).toEqual({ width: 120, height: 60 });
    expect(state.frame?.display).toEqual({ id: 7, bounds: display.bounds });
  });

  it("the frame is four opaque quadrants, so a crop across the centre shows all four colours", async () => {
    const state = new CaptureState();
    const cap = await captureMonitor({ screen, desktopCapturer: { getSources: async () => [] } }, state, fakeCapturer({ screen, createBitmap }));
    const frame = decodeDataUrl(cap.png);
    expect(frame.pixel(0, 0)).toEqual([...FAKE_QUADRANTS.topLeft, 255]);
    expect(frame.pixel(59, 29)).toEqual([...FAKE_QUADRANTS.topLeft, 255]);
    expect(frame.pixel(60, 29)).toEqual([...FAKE_QUADRANTS.topRight, 255]);
    expect(frame.pixel(59, 30)).toEqual([...FAKE_QUADRANTS.bottomLeft, 255]);
    expect(frame.pixel(119, 59)).toEqual([...FAKE_QUADRANTS.bottomRight, 255]);

    // Logical 20x10 box centred on the display centre (40, 20) at 150% -> 30x16 physical px from (45, 22), rounded outward.
    const crop = cropFromState(state, { x: 30, y: 15, w: 20, h: 10 }, 1.5, decodePng);
    expect([crop.width, crop.height]).toEqual([30, 16]);
    const img = decodeDataUrl(crop.png);
    for (const [x, y] of [[0, 0], [29, 0], [0, 15], [29, 15], [14, 7], [15, 8]]) {
      expect(img.pixel(x, y), `${x},${y}`).toEqual([...fakeColorAt(45 + x, 22 + y, 120, 60), 255]);
    }
  });

  it("fakeBitmap is BGRA and matches fakeColorAt", () => {
    const data = fakeBitmap(4, 2);
    expect(data).toHaveLength(32);
    const [r, g, b] = FAKE_QUADRANTS.topLeft;
    expect([...data.subarray(0, 4)]).toEqual([b, g, r, 255]);
    const [r2, g2, b2] = fakeColorAt(3, 1, 4, 2);
    expect([...data.subarray(28, 32)]).toEqual([b2, g2, r2, 255]);
    expect(fakeColorAt(3, 1, 4, 2)).toBe(FAKE_QUADRANTS.bottomRight);
  });
});
