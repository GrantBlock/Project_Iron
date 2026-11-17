// RUN3 T38: generates tests/fixtures/two-pages.pdf with pdf-lib: a tiny 2-page PDF for the PDF tests (no copyrighted
// content). Page 1 is US Letter portrait (612 × 792 pt), page 2 a smaller landscape page (500 × 360 pt), so a test
// can tell the pages apart by size. Each page has a light ground, a title and two coloured blocks. Fixed dates and
// no metadata update, so the file is the same every time the script runs.
//   node scripts/make-pdf-fixture.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "two-pages.pdf");
const doc = await PDFDocument.create({ updateMetadata: false });
const font = await doc.embedFont(StandardFonts.Helvetica);
const pages = [
  { size: [612, 792], title: "Collide PDF fixture - page 1", blocks: [[72, 520, 200, 120, rgb(0.77, 0.31, 0.24)], [340, 300, 180, 160, rgb(0.3, 0.53, 0.77)]] },
  { size: [500, 360], title: "Collide PDF fixture - page 2", blocks: [[40, 60, 160, 110, rgb(0.2, 0.6, 0.35)], [280, 150, 170, 120, rgb(0.85, 0.7, 0.15)]] },
];
for (const p of pages) {
  const [w, h] = p.size;
  const page = doc.addPage([w, h]);
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.97, 0.97, 0.95) });
  page.drawText(p.title, { x: 36, y: h - 54, size: 20, font, color: rgb(0.1, 0.1, 0.12) });
  for (const [x, y, bw, bh, color] of p.blocks) page.drawRectangle({ x, y, width: bw, height: bh, color });
}
doc.setTitle("Collide PDF fixture", { showInWindowTitleBar: false });
doc.setProducer("Collide test fixture");
doc.setCreator("scripts/make-pdf-fixture.mjs");
doc.setCreationDate(new Date(Date.UTC(2026, 10, 15)));
doc.setModificationDate(new Date(Date.UTC(2026, 10, 15)));
const bytes = await doc.save({ useObjectStreams: false });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bytes`);
