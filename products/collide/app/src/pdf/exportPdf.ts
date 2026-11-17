// RUN3 T38: Export of a marked-up PDF, with pdf-lib. The original PDF is loaded as it is and each page's markup is
// drawn on top of that page (flattened drawing: plain PDF paths and text, no PDF annotations, no forms): the shapes,
// and every callout's bubble with its number and note and the leader to its shape. Pages keep their size, rotation
// and content; nothing is re-rendered.
// Items are stored in shown page points (coords.ts), so each is drawn through the page's frame (CropBox and /Rotate).
// A bubble the editor lays out beside the page would fall outside the page in a PDF, so Export moves it onto the
// page, at the nearest edge (A), and draws its leader from there.
// The four markup colours are the engine's (tools.ts); the bubble's own colours come from design-system tokens
// that the editor reads (`PdfPaint`), so this file stays pure and runs in Vitest.
import { degrees, LineCapStyle, PDFDocument, rgb, StandardFonts, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import type { Shape } from "../model";
import { calloutNumbers, fillPctOf, hiddenOf, highlighterWidth, strokePoints } from "../editor/engine";
import { hasNoteBox, layoutNotes, leader, noteUnit, NOTE_BADGE, NOTE_BADGE_GAP, NOTE_FONT, NOTE_PAD, noteTextWidth, type Box } from "../editor/notes";
import { paintOf } from "../editor/tools";
import { normalTurn, pageFrame, shownSize, type PdfFrame } from "./coords";

/** The bubble's colours, as hex (`#RRGGBB`), read from design-system tokens by the editor. */
export interface PdfPaint {
  /** Bubble ground and its outline. */
  box: string;
  boxLine: string;
  /** Note text. */
  text: string;
  /** The number badge and its digits. */
  badge: string;
  badgeText: string;
  /** The ring round a point marker. */
  ring: string;
}

export const EXPORT_FAILED = "Could not export the PDF";
/** Line height of a note, as on the canvas. */
const LINE = 1.25;
/** The leader's arrowhead, as on the canvas (bubble units). */
const HEAD = 8;

/** `#RRGGBB` (or `#RGB`, or `rgb(r, g, b)`) as a pdf-lib colour; black when it cannot be read. */
export function colorOf(css: string): Color {
  const s = css.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16) / 255);
    return rgb(r, g, b);
  }
  const f = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (f) return rgb(Math.min(255, +f[1]) / 255, Math.min(255, +f[2]) / 255, Math.min(255, +f[3]) / 255);
  return rgb(0, 0, 0);
}

/** Text the standard font can draw: any character it has no glyph for becomes "?". */
export function drawable(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    if (ch === "\n" || ch === "\t") {
      out += ch === "\t" ? " " : ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Word-wrap `text` to `width` at `size` (long words are cut); paragraphs are kept. */
export function wrapText(text: string, width: number, size: number, measure: (s: string, size: number) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, size) <= width || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
      // A single word wider than the box is cut into pieces that fit.
      while (measure(line, size) > width && line.length > 1) {
        let k = line.length - 1;
        while (k > 1 && measure(line.slice(0, k), size) > width) k--;
        lines.push(line.slice(0, k));
        line = line.slice(k);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** A bubble moved onto the page when it lies outside it (it keeps its size; one larger than the page sits at its top-left). */
export function ontoPage(box: Box, page: { width: number; height: number }): Box {
  const x = Math.max(0, Math.min(box.x, page.width - box.w));
  const y = Math.max(0, Math.min(box.y, page.height - box.h));
  if (x === box.x && y === box.y) return box;
  // Moved: the leader leaves from the nearest edge of the box, not from the side it was placed on.
  return { x, y, w: box.w, h: box.h };
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const polyline = (pts: readonly number[]) => pts.reduce((d, v, i) => d + (i % 2 === 0 ? `${i ? " L" : "M"} ${f(v)}` : ` ${f(v)}`), "");
/** An ellipse inside the box, as four Bézier quarters (SVG path, y down). */
function ellipsePath(x: number, y: number, w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  const cx = x + rx;
  const cy = y + ry;
  const k = 0.5522847498;
  const ox = rx * k;
  const oy = ry * k;
  return [
    `M ${f(cx - rx)} ${f(cy)}`,
    `C ${f(cx - rx)} ${f(cy - oy)} ${f(cx - ox)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)}`,
    `C ${f(cx + ox)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - oy)} ${f(cx + rx)} ${f(cy)}`,
    `C ${f(cx + rx)} ${f(cy + oy)} ${f(cx + ox)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)}`,
    `C ${f(cx - ox)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + oy)} ${f(cx - rx)} ${f(cy)} Z`,
  ].join(" ");
}
/** A box with rounded corners (SVG path, y down). */
function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  if (q === 0) return `M ${f(x)} ${f(y)} H ${f(x + w)} V ${f(y + h)} H ${f(x)} Z`;
  const k = q * 0.4477152502;
  return [
    `M ${f(x + q)} ${f(y)} H ${f(x + w - q)}`,
    `C ${f(x + w - k)} ${f(y)} ${f(x + w)} ${f(y + k)} ${f(x + w)} ${f(y + q)}`,
    `V ${f(y + h - q)}`,
    `C ${f(x + w)} ${f(y + h - k)} ${f(x + w - k)} ${f(y + h)} ${f(x + w - q)} ${f(y + h)}`,
    `H ${f(x + q)}`,
    `C ${f(x + k)} ${f(y + h)} ${f(x)} ${f(y + h - k)} ${f(x)} ${f(y + h - q)}`,
    `V ${f(y + q)}`,
    `C ${f(x)} ${f(y + k)} ${f(x + k)} ${f(y)} ${f(x + q)} ${f(y)} Z`,
  ].join(" ");
}

/** Draws on one page in shown points (y down), through the page's frame. */
class Pen {
  constructor(
    private page: PDFPage,
    private frame: PdfFrame,
    private font: PDFFont,
  ) {
    // One font resource for the whole page (drawText with a font would add a new key on every call).
    page.setFont(font);
  }
  private at = () => ({ x: this.frame.origin.x, y: this.frame.origin.y, rotate: degrees(this.frame.angle) });
  stroke(d: string, color: Color, width: number, opacity = 1) {
    if (width <= 0) return;
    this.page.drawSvgPath(d, { ...this.at(), borderColor: color, borderWidth: width, borderOpacity: opacity, borderLineCap: LineCapStyle.Round });
  }
  fill(d: string, color: Color, opacity = 1) {
    this.page.drawSvgPath(d, { ...this.at(), color, opacity });
  }
  fillStroke(d: string, fill: Color, line: Color, width: number) {
    this.page.drawSvgPath(d, { ...this.at(), color: fill, borderColor: line, borderWidth: width });
  }
  /** Text with its baseline's left end at (x, y) in shown points. */
  text(s: string, x: number, y: number, size: number, color: Color) {
    if (!s) return;
    const { origin, angle } = this.frame;
    const rad = (angle * Math.PI) / 180;
    // The same mapping as toPdf: (x, −y) turned by the angle, about the origin.
    const px = origin.x + x * Math.cos(rad) + y * Math.sin(rad);
    const py = origin.y + x * Math.sin(rad) - y * Math.cos(rad);
    this.page.drawText(s, { x: px, y: py, size, color, rotate: degrees(angle) });
  }
  width = (s: string, size: number) => this.font.widthOfTextAtSize(s, size);
}

/** An arrow from (x1, y1) to (x2, y2): a line and a filled head. */
function arrow(pen: Pen, pts: readonly [number, number, number, number], color: Color, width: number, head: number) {
  const [x1, y1, x2, y2] = pts;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1e-6) return;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  pen.stroke(polyline([x1, y1, bx, by]), color, width);
  pen.fill(`M ${f(x2)} ${f(y2)} L ${f(bx - uy * (head / 2))} ${f(by + ux * (head / 2))} L ${f(bx + uy * (head / 2))} ${f(by - ux * (head / 2))} Z`, color);
}

function drawShape(pen: Pen, s: Shape, paint: PdfPaint) {
  const color = colorOf(paintOf(s.stroke));
  const hid = hiddenOf(s);
  const fp = fillPctOf(s) / 100;
  const line = hid.outline ? 0 : s.strokeWidth;
  switch (s.type) {
    case "rect":
    case "highlight": {
      const d = roundRect(s.x, s.y, s.w, s.h, 4);
      if (fp > 0) pen.fill(d, color, fp);
      pen.stroke(d, color, line);
      return;
    }
    case "ellipse": {
      const d = ellipsePath(s.x, s.y, s.w, s.h);
      if (fp > 0) pen.fill(d, color, fp);
      pen.stroke(d, color, line);
      return;
    }
    case "line":
      pen.stroke(polyline(strokePoints(s)), color, s.strokeWidth);
      return;
    case "pen":
      pen.stroke(polyline(strokePoints(s)), color, line);
      return;
    case "hl":
      pen.stroke(polyline(strokePoints(s)), color, hid.outline ? 0 : highlighterWidth(s.strokeWidth), 0.4);
      return;
    case "cross":
      pen.stroke(`M ${f(s.x)} ${f(s.y)} L ${f(s.x + s.w)} ${f(s.y + s.h)} M ${f(s.x + s.w)} ${f(s.y)} L ${f(s.x)} ${f(s.y + s.h)}`, color, s.strokeWidth);
      return;
    case "point": {
      const r = Math.max(4, s.strokeWidth * 1.5);
      pen.fillStroke(ellipsePath(s.x - r, s.y - r, 2 * r, 2 * r), color, colorOf(paint.ring), 1.5);
      return;
    }
    case "arrow": {
      const len = Math.max(12, s.strokeWidth * 4);
      arrow(pen, [s.x + s.points[0], s.y + s.points[1], s.x + s.points[2], s.y + s.points[3]], color, s.strokeWidth, len);
      return;
    }
    case "text":
      s.text.split("\n").forEach((t, i) => pen.text(t, s.x, s.y + s.fontSize * (0.8 + i * LINE), s.fontSize, color));
      return;
    default:
      // A legacy callout marker is drawn with its bubble; an added image never belongs to a PDF page.
      return;
  }
}

/** One callout's bubble: the box, the number badge, the note, in bubble units scaled by `u`. */
function drawBubble(pen: Pen, box: Box, n: number, note: string, u: number, paint: PdfPaint) {
  pen.fillStroke(roundRect(box.x, box.y, box.w, box.h, 4 * u), colorOf(paint.box), colorOf(paint.boxLine), u);
  const r = (NOTE_BADGE / 2) * u;
  const cx = box.x + NOTE_PAD * u + r;
  const cy = box.y + NOTE_PAD * u + r;
  pen.fill(ellipsePath(cx - r, cy - r, 2 * r, 2 * r), colorOf(paint.badge));
  const num = String(n);
  const ns = 10 * u;
  pen.text(num, cx - pen.width(num, ns) / 2, cy + ns * 0.35, ns, colorOf(paint.badgeText));
  if (!note) return;
  const size = NOTE_FONT * u;
  const lines = wrapText(note, noteTextWidth(box.w / u) * u, size, pen.width);
  const x = box.x + (NOTE_PAD + NOTE_BADGE + NOTE_BADGE_GAP) * u;
  const top = box.y + (NOTE_PAD + Math.max(0, (NOTE_BADGE - NOTE_FONT * LINE) / 2)) * u;
  lines.forEach((t, i) => pen.text(t, x, top + size * (i * LINE + (LINE - 1) / 2 + 0.8), size, colorOf(paint.text)));
}

/** Draw one page's markup (shapes back to front, then leaders, then bubbles, as on the canvas). */
function drawPage(page: PDFPage, shapes: readonly Shape[], font: PDFFont, paint: PdfPaint) {
  const crop = page.getCropBox();
  const turn = normalTurn(page.getRotation().angle);
  const size = shownSize(crop, turn);
  const pen = new Pen(page, pageFrame(crop, turn), font);
  for (const s of shapes) drawShape(pen, s, paint);
  const numbers = calloutNumbers(shapes);
  const u = noteUnit(size);
  const lines = (text: string, width: number) => wrapText(drawable(font, text), width, NOTE_FONT, pen.width).length * NOTE_FONT * LINE;
  const boxes = layoutNotes(shapes, size, lines);
  const placed: [Shape, Box][] = [];
  for (const s of shapes) {
    const b = boxes.get(s.id);
    if (!b || hiddenOf(s).bubble) continue;
    placed.push([s, ontoPage(b, size)]);
  }
  for (const [s, b] of placed) {
    const pts = leader(s, b);
    if (pts) arrow(pen, pts, colorOf(paintOf(s.stroke)), 1.5, HEAD);
  }
  for (const [s, b] of placed) drawBubble(pen, b, numbers.get(s.id) ?? 0, hiddenOf(s).text ? "" : drawable(font, s.note?.trim() ?? ""), u, paint);
  // Legacy callout markers (no bubble): the numbered badge where the marker is.
  for (const s of shapes) {
    if (hasNoteBox(s) || s.type !== "callout") continue;
    const r = NOTE_BADGE / 2;
    pen.fill(ellipsePath(s.x, s.y, 2 * r, 2 * r), colorOf(paint.badge));
    const num = String(s.callout);
    pen.text(num, s.x + r - pen.width(num, 10) / 2, s.y + r + 3.5, 10, colorOf(paint.badgeText));
  }
}

/**
 * The original PDF with each page's markup drawn on it. `pages[i]` is page i's items (shown points, back to front);
 * a page with none is left exactly as it was. Throws when the PDF cannot be changed (encrypted, damaged).
 */
export async function exportPdf(original: Uint8Array, pages: readonly (readonly Shape[])[], paint: PdfPaint): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false, ignoreEncryption: true });
  if (doc.isEncrypted) throw new Error("This PDF is encrypted, so Collide cannot draw on it. Export a copy without a password from the program that made it, then open that copy.");
  const all = doc.getPages();
  if (pages.length !== all.length) throw new Error(`The markup has ${pages.length} pages but the PDF has ${all.length}. Open the PDF again.`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  all.forEach((page, i) => {
    const shapes = pages[i];
    if (!shapes.length) return;
    // The page's own content may leave its graphics state changed: pdf-lib wraps it in q … Q (autoNormalizeCTM)
    // before the first drawing, so the markup starts clean.
    drawPage(page, shapes, font, paint);
  });
  return doc.save({ useObjectStreams: false });
}

/** The export's file name: `<name>-markup.pdf`. */
export const pdfExportName = (name: string) => `${name.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._ ()-]+/g, "-").replace(/^[-. ]+|[-. ]+$/g, "") || "document"}-markup.pdf`;
