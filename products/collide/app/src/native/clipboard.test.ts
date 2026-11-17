// T15: copyImage, with a fake clipboard and the test PNG decoder standing in for nativeImage.
import { describe, expect, it, vi } from "vitest";
import { copyImage, PNG_DATA_URL_PREFIX } from "./clipboard";
import { pngDataUrl } from "./capture";
import { decodePng, TestImage } from "./testImage";

const NOT_A_PNG = "The image to copy is not a PNG — try Copy again, or use Export instead.";

function setup() {
  const written: TestImage[] = [];
  const deps = {
    imageFromPng: (png: Uint8Array) => Object.assign(decodePng(png), { isEmpty: () => false }),
    writeImage: vi.fn((image: TestImage) => void written.push(image)),
  };
  return { written, deps };
}

describe("copyImage", () => {
  it("puts the PNG of a data URL on the clipboard, pixels intact", () => {
    const { written, deps } = setup();
    copyImage(pngDataUrl(TestImage.marked(40, 30).toPNG()), deps);
    expect(written).toHaveLength(1);
    expect(written[0].getSize()).toEqual({ width: 40, height: 30 });
    expect(written[0].pixel(39, 29)).toEqual([39, 29, 7, 255]);
  });

  it("refuses anything that is not a PNG data URL, and writes nothing", () => {
    const { deps } = setup();
    for (const bad of [undefined, null, 7, "", "hello", "data:image/jpeg;base64,AAAA", PNG_DATA_URL_PREFIX, `${PNG_DATA_URL_PREFIX}AAAA`, new Uint8Array(4)]) {
      expect(() => copyImage(bad, deps), String(bad)).toThrow(NOT_A_PNG);
    }
    expect(deps.writeImage).not.toHaveBeenCalled();
  });

  it("refuses bytes that decode to an empty image (what nativeImage gives for bad data)", () => {
    const writeImage = vi.fn();
    expect(() => copyImage(`${PNG_DATA_URL_PREFIX}AAAA`, { imageFromPng: () => ({ isEmpty: () => true }), writeImage })).toThrow(NOT_A_PNG);
    expect(writeImage).not.toHaveBeenCalled();
  });

  it("a clipboard that cannot be written is reported with its cause and the fix", () => {
    const { deps } = setup();
    deps.writeImage.mockImplementation(() => {
      throw new Error("clipboard is locked");
    });
    expect(() => copyImage(pngDataUrl(TestImage.marked(2, 2).toPNG()), deps)).toThrow(
      "Could not write to the clipboard (clipboard is locked) — try Copy again, or use Export instead.",
    );
  });
});
