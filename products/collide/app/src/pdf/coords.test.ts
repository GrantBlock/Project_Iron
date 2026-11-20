import { describe, expect, it } from "vitest";
import { fitPdfPage, fromPdf, normalTurn, pageFrame, pointsToScreen, screenToPoints, shownSize, toPdf, type PdfBox, type Turn } from "./coords";
import { zoomAt, type View } from "../editor/viewport";

const box: PdfBox = { x: 0, y: 0, width: 500, height: 360 };
const shifted: PdfBox = { x: 20, y: 30, width: 400, height: 300 };
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe("PDF points ↔ canvas (RUN3 T38)", () => {
  it("a point stored in PDF points lands on the same screen spot as the page under it, at any zoom", () => {
    const stored = { x: 120.5, y: 84.25 };
    for (const scale of [0.25, 0.5, 1, 1.5, 2, 4]) {
      const view: View = { scale, x: 37, y: -12 };
      const s = pointsToScreen(view, stored);
      // The page is drawn at the same transform (translate, then scale), so the page's own pixel is there.
      expect(s).toEqual({ x: 37 + stored.x * scale, y: -12 + stored.y * scale });
      close(screenToPoints(view, s), stored);
    }
  });

  it("zooming around the cursor keeps the PDF point under it, so markup stays aligned", () => {
    let view: View = { scale: 1, x: 40, y: 20 };
    const cursor = { x: 300, y: 200 };
    const under = screenToPoints(view, cursor);
    for (const next of [0.5, 2, 3.3, 1]) {
      view = zoomAt(view, cursor, next);
      close(pointsToScreen(view, under), cursor);
    }
  });

  it("a drag on the screen is stored the same in points whatever the zoom", () => {
    // The same page area dragged at 50% and at 200% gives the same box in points.
    const a = { x: 100, y: 50 };
    const b = { x: 300, y: 170 };
    const at = (scale: number) => {
      const view: View = { scale, x: 10, y: 10 };
      return [screenToPoints(view, pointsToScreen(view, a)), screenToPoints(view, pointsToScreen(view, b))];
    };
    const [a1, b1] = at(0.5);
    const [a2, b2] = at(2);
    close(a1, a2);
    close(b1, b2);
    close(a1, a);
    close(b1, b);
  });
});

describe("shown points ↔ PDF user space (RUN3 T38)", () => {
  it("unrotated: the top-left corner is (x, y + height) and y runs up", () => {
    const f = pageFrame(box, 0);
    close(toPdf(f, { x: 0, y: 0 }), { x: 0, y: 360 });
    close(toPdf(f, { x: 500, y: 360 }), { x: 500, y: 0 });
    close(toPdf(f, { x: 100, y: 60 }), { x: 100, y: 300 });
  });

  it("an offset CropBox moves every point by its corner", () => {
    const f = pageFrame(shifted, 0);
    close(toPdf(f, { x: 0, y: 0 }), { x: 20, y: 330 });
    close(toPdf(f, { x: 10, y: 10 }), { x: 30, y: 320 });
  });

  it("each quarter turn: the shown corners map to the right page corners", () => {
    const corners = (turn: Turn) => {
      const f = pageFrame(shifted, turn);
      const s = shownSize(shifted, turn);
      return [toPdf(f, { x: 0, y: 0 }), toPdf(f, { x: s.width, y: 0 }), toPdf(f, { x: s.width, y: s.height }), toPdf(f, { x: 0, y: s.height })];
    };
    const [x0, y0, x1, y1] = [20, 30, 420, 330];
    // Shown top-left, top-right, bottom-right, bottom-left. A page turned 90° clockwise shows its bottom-left at the top-left.
    const want: Record<Turn, [number, number][]> = {
      0: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]],
      90: [[x0, y0], [x0, y1], [x1, y1], [x1, y0]],
      180: [[x1, y0], [x0, y0], [x0, y1], [x1, y1]],
      270: [[x1, y1], [x1, y0], [x0, y0], [x0, y1]],
    };
    for (const turn of [0, 90, 180, 270] as Turn[]) corners(turn).forEach((p, i) => close(p, { x: want[turn][i][0], y: want[turn][i][1] }));
  });

  it("fromPdf undoes toPdf for every turn", () => {
    for (const turn of [0, 90, 180, 270] as Turn[]) {
      const f = pageFrame(shifted, turn);
      for (const p of [{ x: 0, y: 0 }, { x: 12.5, y: 230 }, { x: 299, y: 1 }]) close(fromPdf(f, toPdf(f, p)), p);
    }
  });

  it("a quarter turn swaps the shown width and height; odd /Rotate values become a turn", () => {
    expect(shownSize(box, 90)).toEqual({ width: 360, height: 500 });
    expect(shownSize(box, 180)).toEqual({ width: 500, height: 360 });
    expect([normalTurn(0), normalTurn(-90), normalTurn(450), normalTurn(45), normalTurn(Number.NaN)]).toEqual([0, 270, 90, 0, 0]);
  });
});

describe("Fit for a PDF page (RUN3 T38)", () => {
  it("shows the whole page with room for bubbles beside it, centred, at most 100%", () => {
    const pane = { width: 1000, height: 700 };
    const page = { width: 612, height: 792 };
    const v = fitPdfPage(pane, page);
    expect(v.scale).toBeLessThanOrEqual(1);
    const tl = pointsToScreen(v, { x: 0, y: 0 });
    const br = pointsToScreen(v, { x: page.width, y: page.height });
    expect(tl.x).toBeGreaterThan(0);
    expect(tl.y).toBeGreaterThan(0);
    expect(br.x).toBeLessThan(pane.width);
    expect(br.y).toBeLessThan(pane.height);
    expect(tl.x + br.x).toBeCloseTo(pane.width, 6);
    expect(fitPdfPage({ width: 4000, height: 3000 }, { width: 500, height: 360 }).scale).toBe(1);
  });
});
