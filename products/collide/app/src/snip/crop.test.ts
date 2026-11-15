// T14: the 9 tests of src-tauri/src/crop.rs, ported one for one (same names, same
// numbers), then more cases for scaling, negative monitor origins and zero-size boxes.
import { describe, expect, it } from "vitest";
import { CropError, cropRect, type CropErrorKind, type LogicalRect, type PhysicalRect } from "./crop";
import { captureInto, CaptureState, cropFromState, type Capturer, type MonitorInfo } from "../native/capture";
import { errorText } from "../native/ipc";
import { decodeDataUrl, decodePng, TestImage } from "../native/testImage";

const lr = (x: number, y: number, w: number, h: number): LogicalRect => ({ x, y, w, h });
const pr = (x: number, y: number, w: number, h: number): PhysicalRect => ({ x, y, w, h });

/** Run `fn`, which must throw a CropError of `kind`; returns it. */
function cropError(kind: CropErrorKind, fn: () => unknown): CropError {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(CropError);
  expect((caught as CropError).kind).toBe(kind);
  return caught as CropError;
}

/** A state holding a marked frame (r = x, g = y, b = 7) from `monitor`. */
function held(width: number, height: number, monitor: Partial<MonitorInfo> = {}): CaptureState {
  const state = new CaptureState();
  state.frame = {
    png: TestImage.marked(width, height).toPNG(),
    monitor: { x: 0, y: 0, width, height, scaleFactor: 1, ...monitor },
  };
  return state;
}

const SCALES = [1, 1.25, 1.5, 2];
const ORIGINS = [
  [0, 0],
  [-1920, 0],
  [0, -1080],
  [-2560, -1440],
];

describe("crop.rs tests, ported", () => {
  it("integer_boxes_at_each_scale", () => {
    // 1920x1080 physical frame at each Windows scale.
    expect(cropRect(lr(10, 20, 100, 50), 1, 1920, 1080)).toEqual(pr(10, 20, 100, 50));
    expect(cropRect(lr(8, 8, 80, 40), 1.25, 1920, 1080)).toEqual(pr(10, 10, 100, 50));
    expect(cropRect(lr(10, 20, 100, 50), 1.5, 1920, 1080)).toEqual(pr(15, 30, 150, 75));
    expect(cropRect(lr(10, 20, 100, 50), 2, 1920, 1080)).toEqual(pr(20, 40, 200, 100));
  });

  it("fractional_logical_coords_round_outward", () => {
    // x 10.3..20.7 at 1.25 -> 12.875..25.875 -> 12..26
    expect(cropRect(lr(10.3, 10.3, 10.4, 10.4), 1.25, 1920, 1080)).toEqual(pr(12, 12, 14, 14));
    // 100% : 0.5..2.5 -> 0..3
    expect(cropRect(lr(0.5, 0.5, 2, 2), 1, 100, 100)).toEqual(pr(0, 0, 3, 3));
    // 150%: 3.3..6.7 -> 4.95..10.05 -> 4..11
    expect(cropRect(lr(3.3, 3.3, 3.4, 3.4), 1.5, 100, 100)).toEqual(pr(4, 4, 7, 7));
    // 200%: 0.25..0.75 -> 0.5..1.5 -> 0..2
    expect(cropRect(lr(0.25, 0.25, 0.5, 0.5), 2, 100, 100)).toEqual(pr(0, 0, 2, 2));
    // Float noise must not widen an exact box: 0.8*1.25 is 1.0000000000000002.
    expect(cropRect(lr(0.8, 0.8, 0.8, 0.8), 1.25, 100, 100)).toEqual(pr(1, 1, 1, 1));
    // A sub-pixel sliver still yields at least one pixel.
    expect(cropRect(lr(5.1, 5.1, 0.01, 0.01), 1, 100, 100)).toEqual(pr(5, 5, 1, 1));
  });

  it("zero_or_negative_size_is_an_error", () => {
    for (const [w, h] of [
      [0, 10],
      [10, 0],
      [0, 0],
      [-5, 10],
      [10, -5],
    ]) {
      cropError("EmptyBox", () => cropRect(lr(1, 1, w, h), 1, 100, 100));
    }
  });

  it("invalid_numbers_are_errors", () => {
    cropError("InvalidInput", () => cropRect(lr(NaN, 0, 1, 1), 1, 10, 10));
    cropError("InvalidInput", () => cropRect(lr(0, 0, Infinity, 1), 1, 10, 10));
    cropError("InvalidInput", () => cropRect(lr(0, 0, 1, 1), 0, 10, 10));
    cropError("InvalidInput", () => cropRect(lr(0, 0, 1, 1), -1, 10, 10));
  });

  it("partially_outside_box_clamps", () => {
    expect(cropRect(lr(-10, -10, 30, 30), 1, 100, 100)).toEqual(pr(0, 0, 20, 20));
    expect(cropRect(lr(90, 95, 30, 30), 1, 100, 100)).toEqual(pr(90, 95, 10, 5));
    expect(cropRect(lr(-1000, -1000, 5000, 5000), 2, 100, 80)).toEqual(pr(0, 0, 100, 80));
  });

  it("fully_outside_box_errors", () => {
    for (const r of [lr(-30, 0, 30, 10), lr(100, 0, 10, 10), lr(0, 100, 10, 10), lr(0, -10, 10, 10), lr(500, 500, 10, 10)]) {
      cropError("OutsideFrame", () => cropRect(r, 1, 100, 100));
    }
  });

  it("monitor_origin_does_not_affect_local_coordinates", () => {
    // Same overlay-relative box on monitors at (0,0), left of and above the primary:
    // the crop is identical because coordinates are monitor-local.
    const results = ORIGINS.map(([x, y]) => {
      const r = cropFromState(held(40, 30, { x, y }), lr(5, 6, 10, 8), 1, decodePng);
      return decodeDataUrl(r.png);
    });
    for (const img of results) expect(img).toEqual(results[0]);
    expect(results[0].getSize()).toEqual({ width: 10, height: 8 });
  });

  it("no_capture_held_errors_with_fix", () => {
    const state = new CaptureState();
    const err = cropError("NoCapture", () => cropFromState(state, lr(0, 0, 10, 10), 1, decodePng));
    expect(err.message).toBe("No capture to crop — start a new snip.");
    expect(errorText(err)).toContain("start a new snip");
  });

  it("end_to_end_capture_then_crop_takes_pixels_from_the_right_region", async () => {
    // 150% monitor, left of and above the primary; frame is 90x60 physical (60x40 logical).
    const monitor: MonitorInfo = { x: -90, y: -60, width: 90, height: 60, scaleFactor: 1.5 };
    const fakeCap: Capturer = { captureAt: async () => ({ image: TestImage.marked(90, 60), monitor }) };
    const state = new CaptureState();
    await captureInto(fakeCap, state, { x: -10, y: -10 });

    // Logical 10,8 size 20x10 -> physical 15..45 x 12..27 -> 30x15 at (15,12).
    let r = cropFromState(state, lr(10, 8, 20, 10), 1.5, decodePng);
    expect([r.width, r.height]).toEqual([30, 15]);
    let img = decodeDataUrl(r.png);
    expect(img.getSize()).toEqual({ width: 30, height: 15 });
    for (let py = 0; py < 15; py++) {
      for (let px = 0; px < 30; px++) {
        expect(img.pixel(px, py), `pixel ${px},${py}`).toEqual([15 + px, 12 + py, 7, 255]);
      }
    }

    // Partly outside: clamped, still from the right region; frame stays held for a re-crop.
    r = cropFromState(state, lr(50, 30, 40, 40), 1.5, decodePng);
    expect([r.width, r.height]).toEqual([15, 15]);
    img = decodeDataUrl(r.png);
    expect(img.pixel(0, 0)).toEqual([75, 45, 7, 255]);
    expect(img.pixel(14, 14)).toEqual([89, 59, 7, 255]);
  });
});

describe("scaling at 100 / 125 / 150 / 200%", () => {
  it.each([
    [1, 1920, 1080],
    [1.25, 1536, 864],
    [1.5, 1280, 720],
    [2, 960, 540],
  ])("at %f a full-screen selection is the whole 1920x1080 frame", (scale, logicalW, logicalH) => {
    expect(cropRect(lr(0, 0, logicalW, logicalH), scale, 1920, 1080)).toEqual(pr(0, 0, 1920, 1080));
  });

  it.each([
    [1, pr(100, 50, 200, 100)],
    [1.25, pr(125, 62, 250, 126)], // y 62.5..187.5 -> 62..188: both half pixels are kept
    [1.5, pr(150, 75, 300, 150)],
    [2, pr(200, 100, 400, 200)],
  ])("at %f the same logical box scales to physical px, rounded outward", (scale, expected) => {
    expect(cropRect(lr(100, 50, 200, 100), scale, 1920, 1080)).toEqual(expected);
  });

  it.each([
    [1, pr(8, 4, 40, 20)],
    [1.25, pr(10, 5, 50, 25)],
    [1.5, pr(12, 6, 60, 30)],
    [2, pr(16, 8, 80, 40)],
  ])("at %f the cropped pixels come from the scaled region of the held frame", (scale, expected) => {
    const r = cropFromState(held(200, 100, { scaleFactor: scale }), lr(8, 4, 40, 20), scale, decodePng);
    expect([r.width, r.height]).toEqual([expected.w, expected.h]);
    const img = decodeDataUrl(r.png);
    expect(img.getSize()).toEqual({ width: expected.w, height: expected.h });
    expect(img.pixel(0, 0)).toEqual([expected.x, expected.y, 7, 255]);
    expect(img.pixel(expected.w - 1, expected.h - 1)).toEqual([expected.x + expected.w - 1, expected.y + expected.h - 1, 7, 255]);
  });

  it.each(SCALES)("at %f a selection on the bottom-right corner clamps to the frame edge", (scale) => {
    // Logical frame is 1920/scale x 1080/scale; the box starts 10 logical px inside the corner and runs 50 past it.
    const r = cropRect(lr(1920 / scale - 10, 1080 / scale - 10, 60, 60), scale, 1920, 1080);
    expect(r.x + r.w).toBe(1920);
    expect(r.y + r.h).toBe(1080);
    expect(r.x).toBe(Math.floor(1920 - 10 * scale));
    expect(r.y).toBe(Math.floor(1080 - 10 * scale));
  });

  it.each(SCALES)("at %f a result is always whole pixels inside the frame", (scale) => {
    for (const box of [lr(0.1, 0.1, 0.1, 0.1), lr(33.3, 21.7, 101.9, 77.7), lr(-3.3, -7.7, 20.2, 20.2), lr(630.6, 350.4, 99.9, 99.9)]) {
      const r = cropRect(box, scale, 1280, 720);
      for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.w).toBeGreaterThanOrEqual(1);
      expect(r.h).toBeGreaterThanOrEqual(1);
      expect(r.x + r.w).toBeLessThanOrEqual(1280);
      expect(r.y + r.h).toBeLessThanOrEqual(720);
      // Outward rounding: the physical box covers every part of the scaled logical box that is on the frame.
      expect(r.x).toBeLessThanOrEqual(Math.max(box.x * scale, 0) + 1e-6);
      expect(r.x + r.w).toBeGreaterThanOrEqual(Math.min((box.x + box.w) * scale, 1280) - 1e-6);
      expect(r.y).toBeLessThanOrEqual(Math.max(box.y * scale, 0) + 1e-6);
      expect(r.y + r.h).toBeGreaterThanOrEqual(Math.min((box.y + box.h) * scale, 720) - 1e-6);
    }
  });
});

describe("negative monitor origins", () => {
  it.each(SCALES)("at %f a monitor left of or above the primary crops exactly like one at (0,0)", (scale) => {
    const box = lr(8, 4, 40, 20);
    const results = ORIGINS.map(([x, y]) => cropFromState(held(200, 100, { x, y, scaleFactor: scale }), box, scale, decodePng));
    for (const r of results) expect(r).toEqual(results[0]);
    // The origin is never subtracted: the first pixel is the box's own scaled corner.
    expect(decodeDataUrl(results[0].png).pixel(0, 0)).toEqual([Math.floor(8 * scale), Math.floor(4 * scale), 7, 255]);
  });

  it.each(SCALES)("at %f a box dragged past the top-left edge (negative logical coords) clamps to 0,0", (scale) => {
    expect(cropRect(lr(-10, -10, 30, 30), scale, 1920, 1080)).toEqual(pr(0, 0, Math.ceil(20 * scale), Math.ceil(20 * scale)));
  });

  it("global (virtual-desktop) coordinates on a negative-origin monitor are a caller bug and land outside the frame", () => {
    // A monitor at x = -1920: its global coordinates are negative, its overlay coordinates are not.
    cropError("OutsideFrame", () => cropFromState(held(40, 30, { x: -1920, y: 0 }), lr(-1900, 6, 10, 8), 1, decodePng));
  });
});

describe("zero-size boxes", () => {
  it.each(SCALES)("at %f a click without a drag (0 x 0) is EmptyBox with the fix", (scale) => {
    for (const box of [lr(0, 0, 0, 0), lr(100, 100, 0, 0), lr(100, 100, 0, 40), lr(100, 100, 40, 0), lr(100, 100, -0, -0)]) {
      const err = cropError("EmptyBox", () => cropRect(box, scale, 1920, 1080));
      expect(err.message).toBe("The selection has no width or height — drag a larger box and release again.");
    }
  });

  it("an empty box wins over being outside the frame", () => {
    cropError("EmptyBox", () => cropRect(lr(5000, 5000, 0, 0), 1, 100, 100));
    cropError("EmptyBox", () => cropRect(lr(-50, -50, 0, 0), 1, 100, 100));
  });

  it("a real box on a zero-size frame is OutsideFrame", () => {
    cropError("OutsideFrame", () => cropRect(lr(0, 0, 10, 10), 1, 0, 0));
    cropError("OutsideFrame", () => cropRect(lr(0, 0, 10, 10), 1, 100, 0));
  });

  it("a zero-size crop fails and leaves the held frame ready for the next crop", () => {
    const state = held(40, 30);
    const before = state.frame;
    cropError("EmptyBox", () => cropFromState(state, lr(5, 6, 0, 0), 1, decodePng));
    expect(state.frame).toBe(before);
    expect(cropFromState(state, lr(5, 6, 10, 8), 1, decodePng)).toMatchObject({ width: 10, height: 8 });
  });
});

describe("values that crossed the bridge", () => {
  it("a box or scale that is not numbers is InvalidInput, never a crash", () => {
    const bad: unknown[] = [null, undefined, {}, { x: 0, y: 0, w: 10 }, { x: "0", y: 0, w: 10, h: 10 }, "box", 7];
    for (const box of bad) {
      const err = cropError("InvalidInput", () => cropRect(box as LogicalRect, 1, 100, 100));
      expect(err.message).toBe("The selection or display scale is not a valid number — start a new snip.");
    }
    for (const scale of [undefined, null, "1", NaN, Infinity]) {
      cropError("InvalidInput", () => cropRect(lr(0, 0, 10, 10), scale as number, 100, 100));
    }
  });

  it("every error kind carries the Rust message (cause and fix)", () => {
    const messages: Record<CropErrorKind, string> = {
      NoCapture: "No capture to crop — start a new snip.",
      EmptyBox: "The selection has no width or height — drag a larger box and release again.",
      OutsideFrame: "The selection is outside the captured screen — drag a box over the screen and release again.",
      InvalidInput: "The selection or display scale is not a valid number — start a new snip.",
      Encode: "Could not encode the cropped image as PNG — try again; if it repeats, restart Collide. (boom)",
      StateUnavailable: "Capture state is locked by a failed earlier capture — restart Collide.",
    };
    for (const kind of Object.keys(messages) as CropErrorKind[]) {
      expect(new CropError(kind, "boom").message).toBe(messages[kind]);
    }
  });
});
