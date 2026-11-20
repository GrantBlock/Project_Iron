import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { compareDirs, decodePng, diffImages, diffReport, type Image } from "./screenshot-diff";

// A minimal PNG encoder for the tests: one filter type per row, so every unfilter path is exercised.
function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
function crc(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Uint8Array) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(body).copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}
function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
/** Encodes `pixels` (channels per pixel = 3 or 4) with filters cycling 0..4 per row. */
function encodePng(width: number, height: number, channels: 3 | 4, pixels: number[]) {
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const filter = y % 5;
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) {
      const v = pixels[y * stride + x];
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      raw[y * (stride + 1) + 1 + x] = (v - pred) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}
const pseudo = (n: number) => Array.from({ length: n }, (_, i) => (i * 97 + ((i * i) % 31)) & 0xff);
const solid = (w: number, h: number, rgba: number[]): Image => ({
  width: w,
  height: h,
  data: Uint8Array.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]),
});

describe("decodePng", () => {
  it("decodes RGBA with every filter type", () => {
    const px = pseudo(7 * 6 * 4);
    const img = decodePng(encodePng(7, 6, 4, px));
    expect(img.width).toBe(7);
    expect(img.height).toBe(6);
    expect([...img.data]).toEqual(px);
  });

  it("decodes RGB and adds opaque alpha", () => {
    const px = pseudo(5 * 5 * 3);
    const img = decodePng(encodePng(5, 5, 3, px));
    const want: number[] = [];
    for (let i = 0; i < 25; i++) want.push(px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255);
    expect([...img.data]).toEqual(want);
  });

  it("rejects files that are not PNG", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow("Not a PNG");
  });
});

describe("diffImages", () => {
  it("identical images differ by 0%", () => {
    const a = solid(10, 10, [30, 30, 32, 255]);
    expect(diffImages(a, solid(10, 10, [30, 30, 32, 255]))).toEqual({ differing: 0, total: 100, percent: 0, sameSize: true });
  });

  it("counts pixels beyond the tolerance only", () => {
    const a = solid(10, 10, [30, 30, 32, 255]);
    const b = solid(10, 10, [30, 30, 32, 255]);
    b.data[0] = 32; // within tolerance
    b.data[4] = 200; // pixel 2 differs
    b.data[8 * 4 + 2] = 0; // pixel 9 differs
    expect(diffImages(a, b).differing).toBe(2);
    expect(diffImages(a, b).percent).toBe(2);
  });

  it("counts the area outside the overlap when sizes differ", () => {
    const d = diffImages(solid(10, 10, [0, 0, 0, 255]), solid(10, 5, [0, 0, 0, 255]));
    expect(d).toEqual({ differing: 50, total: 100, percent: 50, sameSize: false });
  });
});

describe("compareDirs and diffReport", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("pairs screenshots by name and lists missing ones", () => {
    dir = mkdtempSync(path.join(tmpdir(), "lite-diff-"));
    const p = path.join(dir, "prototype");
    const a = path.join(dir, "app");
    mkdirSync(p);
    mkdirSync(a);
    const black = encodePng(4, 4, 3, new Array(48).fill(0));
    const half = encodePng(4, 4, 3, [...new Array(24).fill(0), ...new Array(24).fill(255)]);
    writeFileSync(path.join(p, "same-1440x860.png"), black);
    writeFileSync(path.join(a, "same-1440x860.png"), black);
    writeFileSync(path.join(p, "half-1440x860.png"), black);
    writeFileSync(path.join(a, "half-1440x860.png"), half);
    writeFileSync(path.join(p, "missing-400x800.png"), black);
    const results = compareDirs(p, a);
    expect(results).toEqual([
      { name: "half-1440x860.png", percent: 50, note: "" },
      { name: "missing-400x800.png", percent: null, note: "no app screenshot (spec failed before it)" },
      { name: "same-1440x860.png", percent: 0, note: "" },
    ]);
    const md = diffReport(results, { threshold: 2, date: "2026-11-17" });
    expect(md).toContain("| half-1440x860.png | 50.00% | yes |  |");
    expect(md).toContain("| same-1440x860.png | 0.00% | no |  |");
    expect(md).toContain("| missing-400x800.png | — | yes |");
    expect(md).toContain("3 pairs; 2 above 2% or missing.");
  });
});
