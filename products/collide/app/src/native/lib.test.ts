// T15: the lib.rs tests that are not about file scope (that one is T16), ported.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { captureInto, CaptureState, cropFromState, type Capturer } from "./capture";
import { SNIP_REQUEST_CHANNEL } from "./bridge";
import { APP_NAME } from "./shell";
import { decodeDataUrl, decodePng, TestImage } from "./testImage";

describe("lib.rs tests, ported", () => {
  it("app_name_is_collide", () => {
    expect(APP_NAME).toBe("Collide");
    // Electron takes the app's name (and its user-data folder) from package.json.
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { productName: string; build: { productName: string; appId: string } };
    expect(pkg.productName).toBe(APP_NAME);
    expect(pkg.build.productName).toBe(APP_NAME);
    expect(pkg.build.appId).toBe("com.blockconcepts.collide");
  });

  it("command_chain_capture_then_crop_yields_expected_png", async () => {
    const fake: Capturer = {
      captureAt: async () => ({ image: TestImage.blank(200, 100), monitor: { x: -1920, y: 0, width: 200, height: 100, scaleFactor: 2 } }),
    };
    const state = new CaptureState();
    const cap = await captureInto(fake, state, { x: -5, y: 5 });
    // Overlay is placed at the monitor's origin and sized to it; the JS flow passes these on.
    expect([cap.x, cap.y, cap.width, cap.height]).toEqual([-1920, 0, 200, 100]);
    // Logical 40x20 box at (10, 5) on a 2x monitor -> 80x40 physical pixels.
    const crop = cropFromState(state, { x: 10, y: 5, w: 40, h: 20 }, cap.scaleFactor, decodePng);
    expect([crop.width, crop.height]).toEqual([80, 40]);
    expect(crop.png.startsWith("data:image/png;base64,")).toBe(true);
    expect(decodeDataUrl(crop.png).getSize()).toEqual({ width: 80, height: 40 });
    // The frame stays held: a second crop (a new drag) works without a new capture.
    expect(() => cropFromState(state, { x: 0, y: 0, w: 10, h: 10 }, 2, decodePng)).not.toThrow();
  });

  it("the hotkey's event keeps its name", () => {
    expect(SNIP_REQUEST_CHANNEL).toBe("collide:snip-request");
  });
});
