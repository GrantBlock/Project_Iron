// Screenshot comparison for `pnpm ref` (scripts/ref.mjs): a small PNG decoder (no new
// dependencies, node:zlib only) and a pixel diff. Node-side tooling, not part of the app.
// scripts/ref.mjs imports this file directly (Node strips the types), so it uses only
// erasable TypeScript and node: imports.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

/** A decoded image: 8-bit RGBA, row by row. */
export interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** Channels per PNG colour type (0 grey, 2 RGB, 4 grey + alpha, 6 RGBA). Palette images are not needed. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Decodes an 8-bit, non-interlaced PNG (what Chromium screenshots are) to RGBA. */
export function decodePng(file: Uint8Array): Image {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (file.length < 8 || SIGNATURE.some((b, i) => file[i] !== b)) throw new Error("Not a PNG file");
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= file.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(file[at + 4], file[at + 5], file[at + 6], file[at + 7]);
    const body = file.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const bitDepth = body[8];
      colorType = body[9];
      const interlace = body[12];
      if (bitDepth !== 8 || !(colorType in CHANNELS) || interlace !== 0) {
        throw new Error(`Unsupported PNG: bit depth ${bitDepth}, colour type ${colorType}, interlace ${interlace}`);
      }
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  if (!width || !height || colorType < 0) throw new Error("PNG has no IHDR chunk");

  const channels = CHANNELS[colorType];
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < height * (stride + 1)) throw new Error("PNG image data is too short");
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[row + x - channels] : 0;
      const b = y > 0 ? px[prev + x] : 0;
      const c = x >= channels && y > 0 ? px[prev + x - channels] : 0;
      let value = raw[src + x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`Bad PNG filter ${filter} on row ${y}`);
      px[row + x] = value & 0xff;
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    const o = i * 4;
    if (channels >= 3) {
      data[o] = px[j];
      data[o + 1] = px[j + 1];
      data[o + 2] = px[j + 2];
      data[o + 3] = channels === 4 ? px[j + 3] : 255;
    } else {
      data[o] = data[o + 1] = data[o + 2] = px[j];
      data[o + 3] = channels === 2 ? px[j + 1] : 255;
    }
  }
  return { width, height, data };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export interface Diff {
  /** Pixels that differ (any channel by more than the tolerance), plus every pixel outside the shared area if the sizes differ. */
  differing: number;
  /** Pixels in the larger of the two images. */
  total: number;
  /** differing / total × 100. */
  percent: number;
  sameSize: boolean;
}

/** Per-channel difference (0–255) below which two pixels count as the same (A): absorbs anti-aliasing noise. */
export const PIXEL_TOLERANCE = 16;

/** Compares two images pixel by pixel. */
export function diffImages(a: Image, b: Image, tolerance = PIXEL_TOLERANCE): Diff {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const total = Math.max(a.width * a.height, b.width * b.height);
  let differing = total - width * height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;
      for (let k = 0; k < 4; k++) {
        if (Math.abs(a.data[i + k] - b.data[j + k]) > tolerance) {
          differing++;
          break;
        }
      }
    }
  }
  return { differing, total, percent: total ? (differing / total) * 100 : 0, sameSize: a.width === b.width && a.height === b.height };
}

export interface PairResult {
  /** Screenshot file name, e.g. `shell-1440x860.png`. */
  name: string;
  /** Percent of differing pixels, or null when one side has no screenshot. */
  percent: number | null;
  /** Why there is no percent, or that the sizes differ. */
  note: string;
}

/** Compares every screenshot in the prototype folder with the app's file of the same name. */
export function compareDirs(prototypeDir: string, appDir: string): PairResult[] {
  const list = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : []);
  const names = [...new Set([...list(prototypeDir), ...list(appDir)])].sort();
  return names.map((name) => {
    const p = path.join(prototypeDir, name);
    const a = path.join(appDir, name);
    if (!existsSync(p)) return { name, percent: null, note: "no prototype screenshot" };
    if (!existsSync(a)) return { name, percent: null, note: "no app screenshot (spec failed before it)" };
    const d = diffImages(decodePng(readFileSync(p)), decodePng(readFileSync(a)));
    return { name, percent: d.percent, note: d.sameSize ? "" : "sizes differ" };
  });
}

/** The Markdown report (`reports/screenshot-diff.md`). Pairs above the threshold are listed for Grant, not failed. */
export function diffReport(results: PairResult[], options: { threshold: number; date: string }): string {
  const over = results.filter((r) => r.percent === null || r.percent > options.threshold);
  const fmt = (r: PairResult) => (r.percent === null ? "—" : `${r.percent.toFixed(2)}%`);
  const lines = [
    "# Lite: screenshot comparison (prototype vs app)",
    "",
    `Generated by \`pnpm ref\` (products/lite/app) on ${options.date}. Each reference spec saves screenshots at 1440 × 860 and 400 × 800 on both targets; this compares each pair pixel by pixel.`,
    "",
    `- A pixel differs when any RGBA channel differs by more than ${PIXEL_TOLERANCE} of 255 (A).`,
    `- Threshold: ${options.threshold}% of pixels (A, RUN.md). Pairs above it are listed for Grant, not failed.`,
    `- ${results.length} pairs; ${over.length} above ${options.threshold}% or missing.`,
    "",
    "| Screenshot | Differing pixels | Over threshold | Note |",
    "| --- | ---: | :---: | --- |",
    ...results.map((r) => `| ${r.name} | ${fmt(r)} | ${r.percent === null || r.percent > options.threshold ? "yes" : "no"} | ${r.note} |`),
    "",
  ];
  return lines.join("\n");
}
