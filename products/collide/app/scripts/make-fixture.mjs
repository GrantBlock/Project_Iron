// Generates tests/fixtures/sample-400x300.png (no dependencies): a dark panel with a
// grid and a few coloured blocks, so zoom/pan is visible in screenshots.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 400;
const H = 300;
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    let c = [38, 40, 46];
    if (x % 50 === 0 || y % 50 === 0) c = [70, 74, 84];
    if (x >= 40 && x < 160 && y >= 40 && y < 110) c = [196, 80, 60];
    if (x >= 220 && x < 360 && y >= 140 && y < 250) c = [76, 135, 196];
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) c = [243, 242, 239];
    const o = y * (W * 3 + 1) + 1 + x * 3;
    raw[o] = c[0];
    raw[o + 1] = c[1];
    raw[o + 2] = c[2];
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
mkdirSync(new URL("../tests/fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("../tests/fixtures/sample-400x300.png", import.meta.url), png);
console.log("wrote", png.length, "bytes");
