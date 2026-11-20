// Test helper (imported by *.test.ts only): a small RGBA image that stands in for
// Electron's NativeImage, with a real PNG encoder and decoder so tests can check
// the pixels that come out of capture and crop.
import { deflateSync, inflateSync } from "node:zlib";
import type { FrameImage } from "./capture";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

export type Rgba = [number, number, number, number];

export class TestImage implements FrameImage {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly data: Uint8Array,
  ) {
    if (data.length !== width * height * 4) throw new Error("TestImage: data does not match its size");
  }

  static fromFn(width: number, height: number, px: (x: number, y: number) => Rgba): TestImage {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(px(x, y), (y * width + x) * 4);
    return new TestImage(width, height, data);
  }

  /** Transparent black, like `RgbaImage::new`. */
  static blank(width: number, height: number): TestImage {
    return new TestImage(width, height, new Uint8Array(width * height * 4));
  }

  /** Each pixel encodes its own coordinates: r = x, g = y, b = 7. */
  static marked(width: number, height: number): TestImage {
    return TestImage.fromFn(width, height, (x, y) => [x & 0xff, y & 0xff, 7, 255]);
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  pixel(x: number, y: number): Rgba {
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Strict: a rect that is not whole pixels inside the image is a bug in the caller. */
  crop(rect: { x: number; y: number; width: number; height: number }): TestImage {
    const { x, y, width, height } = rect;
    const whole = [x, y, width, height].every((v) => Number.isInteger(v));
    if (!whole || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > this.width || y + height > this.height) {
      throw new Error(`TestImage.crop: ${JSON.stringify(rect)} is not inside ${this.width}x${this.height}`);
    }
    return TestImage.fromFn(width, height, (px, py) => this.pixel(x + px, y + py));
  }

  toPNG(): Uint8Array {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
    const row = this.width * 4;
    const raw = Buffer.alloc((row + 1) * this.height); // each scanline: filter byte 0 + pixels
    for (let y = 0; y < this.height; y++) raw.set(this.data.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
    return Buffer.concat([Buffer.from(SIGNATURE), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))]);
  }
}

/** Decode a PNG written by `TestImage.toPNG` (8-bit RGBA, filter 0). Throws on anything else, bad CRCs included. */
export function decodePng(bytes: Uint8Array): TestImage {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!SIGNATURE.every((v, i) => buf[i] === v)) throw new Error("not a PNG");
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + length);
    if (crc32(buf.subarray(at + 4, at + 8 + length)) !== buf.readUInt32BE(at + 8 + length)) throw new Error(`bad CRC in ${type}`);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("only 8-bit RGBA, non-interlaced PNGs are supported");
    } else if (type === "IDAT") {
      idat.push(data);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const row = width * 4;
  if (raw.length !== (row + 1) * height) throw new Error("PNG data does not match its size");
  const out = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) {
    if (raw[y * (row + 1)] !== 0) throw new Error("only filter 0 is supported");
    out.set(raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)), y * row);
  }
  return new TestImage(width, height, out);
}

/** Decode a `data:image/png;base64,...` URL. */
export function decodeDataUrl(dataUrl: string): TestImage {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("not a PNG data URL");
  return decodePng(Buffer.from(dataUrl.slice(prefix.length), "base64"));
}
