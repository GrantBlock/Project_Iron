// RUN3 T38: a PDF in the browser build. Open the 2-page fixture (tests/fixtures/two-pages.pdf, made by
// scripts/make-pdf-fixture.mjs) → mark up page 2 → Save as .collide → reopen gives the same items, order and page;
// Export gives a PDF with the same 2 pages at their own sizes and the markup drawn on page 2 (checked with pdf-lib,
// and by opening the exported PDF and reading pdf.js's pixels in the marked area); Copy PNG gives page 2 with its
// markup. Items are in PDF points and do not move when the zoom changes.
import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFArray, PDFDocument } from "pdf-lib";

const FIXTURE = fileURLToPath(new URL("../tests/fixtures/two-pages.pdf", import.meta.url));
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
const state = (page: Page) => page.evaluate(() => window.__collide!.state());
const drawnPage = (page: Page, n: number) => page.locator(`[data-testid="pdf-page"][data-page="${n}"][data-drawn="yes"]`);

/** A shown PDF point (y down from the page's top-left) on the screen, from where the page is drawn now. */
async function screenOf(page: Page, pageWidth: number, x: number, y: number) {
  const box = (await page.getByTestId("pdf-page").boundingBox())!;
  const k = box.width / pageWidth;
  return [box.x + x * k, box.y + y * k] as const;
}

async function openFixture(page: Page) {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  await expect(page.getByTestId("notice")).toContainText("PDF opened");
  await expect(drawnPage(page, 1)).toBeVisible();
}

/** Mark up page 2: a rectangle over the yellow block (its note typed in the card) and a pen stroke over the green one. */
async function markPage2(page: Page) {
  await ws(page).getByRole("button", { name: "Next page" }).click();
  await expect(drawnPage(page, 2)).toBeVisible();
  await ws(page).getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.mouse.move(...(await screenOf(page, 500, 290, 100)));
  await page.mouse.down();
  await page.mouse.move(...(await screenOf(page, 500, 440, 200)), { steps: 6 });
  await page.mouse.up();
  await page.getByTestId("callout-note").first().fill("Yellow block: check the label");
  await page.getByTestId("callout-note").first().blur();
  await ws(page).getByRole("button", { name: "Pen", exact: true }).click();
  await page.mouse.move(...(await screenOf(page, 500, 60, 250)));
  await page.mouse.down();
  await page.mouse.move(...(await screenOf(page, 500, 120, 280)), { steps: 5 });
  await page.mouse.move(...(await screenOf(page, 500, 180, 250)), { steps: 5 });
  await page.mouse.up();
}

test("open the 2-page PDF: pages are drawn by pdf.js, the arrows and Page Up/Down move between them", async ({ page }) => {
  await openFixture(page);
  let s = await state(page);
  expect(s).toMatchObject({ view: "pdf", editor: "pdf", pdf: { pageIndex: 0, pageCount: 2 }, items: [], activeTool: "select" });
  expect(s.tabs).toEqual([expect.objectContaining({ title: "two-pages.pdf", kind: "pdf", dirty: false, active: true })]);
  // Page 1 is US Letter, drawn at its size in points (the canvas holds the pixels).
  const p1 = await page.getByTestId("pdf-page").evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
  expect(p1).toEqual({ w: 612, h: 792 });
  await expect(ws(page).getByRole("button", { name: "Previous page" })).toBeDisabled();
  await expect(ws(page).getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.keyboard.press("PageDown");
  await expect(drawnPage(page, 2)).toBeVisible();
  s = await state(page);
  expect(s.pdf).toEqual({ pageIndex: 1, pageCount: 2 });
  expect(await page.getByTestId("pdf-page").evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight }))).toEqual({ w: 500, h: 360 });
  await expect(ws(page).getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.keyboard.press("PageUp");
  await expect(drawnPage(page, 1)).toBeVisible();
  // The page really is drawn: the title's dark ink and the first block's colour are in the canvas.
  const ink = await page.getByTestId("pdf-page").locator("canvas").evaluate((c: HTMLCanvasElement) => {
    const k = c.width / 612;
    const px = (x: number, y: number) => [...c.getContext("2d")!.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)];
    // The red block: x 72–272, y 520–640 from the bottom = 152–272 from the top.
    return { block: px(170, 210), ground: px(560, 760) };
  });
  expect(ink.block[0]).toBeGreaterThan(170);
  expect(ink.block[1]).toBeLessThan(110);
  expect(ink.ground.every((v) => v > 230)).toBe(true);
});

test("mark up page 2, save as .collide, reopen: the same items, order and page; old pages untouched", async ({ page }) => {
  await openFixture(page);
  await markPage2(page);
  const before = await state(page);
  expect(before.pdf).toEqual({ pageIndex: 1, pageCount: 2 });
  expect(before.items.map((i) => i.type)).toEqual(["pen", "rect"]);
  const rect = before.items.find((i) => i.type === "rect")!;
  // Stored in PDF points, whatever the zoom it was drawn at.
  for (const [got, want] of [[rect.x, 290], [rect.y, 100], [rect.w, 150], [rect.h, 100]] as const) expect(Math.abs(got - want)).toBeLessThan(2);
  expect(rect).toMatchObject({ number: 1, note: "Yellow block: check the label" });
  expect(before.tabs[0].dirty).toBe(true);

  // Zoom in and out: the items stay where they are in points.
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+=");
  expect((await state(page)).zoom!.fit).toBe(false);
  expect((await state(page)).items.map(({ x, y, w, h }) => [x, y, w, h])).toEqual(before.items.map(({ x, y, w, h }) => [x, y, w, h]));
  await page.keyboard.press("Control+0");

  // Page 1 has no markup.
  await ws(page).getByRole("button", { name: "Previous page" }).click();
  expect((await state(page)).items).toEqual([]);
  await ws(page).getByRole("button", { name: "Next page" }).click();

  const download = page.waitForEvent("download");
  await ws(page).getByRole("toolbar", { name: "PDF tools" }).getByRole("button", { name: "Save as .collide", exact: true }).click();
  const file = await (await download).path();
  await expect(page.getByRole("status")).toHaveText("Saved two-pages.collide · the PDF (2 pages) with 2 items · downloaded");
  expect((await state(page)).tabs[0].dirty).toBe(false);

  const entries = unzipSync(new Uint8Array(readFileSync(file)));
  expect(Object.keys(entries).sort()).toEqual(["manifest.json", "preview.png", "sources/source.pdf"]);
  // The PDF goes in byte for byte.
  expect(Buffer.from(entries["sources/source.pdf"]).equals(readFileSync(FIXTURE))).toBe(true);
  const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
  expect(manifest).toMatchObject({ format: "collide", version: 1, kind: "pdf", page: 1, source: { file: "sources/source.pdf", name: "two-pages.pdf" } });
  expect(manifest.pages.map((p: { width: number; height: number; items: unknown[] }) => [p.width, p.height, p.items.length])).toEqual([
    [612, 792, 0],
    [500, 360, 2],
  ]);
  expect(manifest.pages[1].items.map((s: { id: string }) => s.id)).toEqual([...before.items].reverse().map((i) => i.id));

  // A fresh page (nothing in memory) opens the file: page 2 in front with the same items in the same order.
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({ name: "two-pages.collide", mimeType: "application/zip", buffer: readFileSync(file) });
  await expect(page.getByTestId("notice")).toContainText("Collide file opened");
  await expect(drawnPage(page, 2)).toBeVisible();
  const after = await state(page);
  expect(after.pdf).toEqual({ pageIndex: 1, pageCount: 2 });
  expect(after.items).toEqual(before.items);
  expect(after.tabs[0]).toMatchObject({ kind: "pdf", dirty: false });
  await expect(page.getByTestId("callout-note").first()).toHaveValue("Yellow block: check the label");
  await page.keyboard.press("PageUp");
  expect((await state(page)).items).toEqual([]);
});

test("Export writes a PDF with the same 2 pages and the markup drawn on page 2", async ({ page }) => {
  await openFixture(page);
  await markPage2(page);
  const download = page.waitForEvent("download");
  await ws(page).getByRole("button", { name: "Export", exact: true }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("two-pages-markup.pdf");
  await expect(page.getByRole("status")).toHaveText("Exported two-pages-markup.pdf · 2 pages, markup on 1 · downloaded");
  const bytes = readFileSync(await dl.path());

  // pdf-lib: 2 pages of the original sizes; page 1 as it was, page 2 has more content (the markup).
  const original = await PDFDocument.load(readFileSync(FIXTURE));
  const out = await PDFDocument.load(bytes);
  expect(out.getPageCount()).toBe(2);
  expect(out.getPages().map((p) => p.getSize())).toEqual(original.getPages().map((p) => p.getSize()));
  const streams = (d: PDFDocument, i: number) => {
    const c = d.getPage(i).node.Contents();
    return c instanceof PDFArray ? c.size() : c ? 1 : 0;
  };
  expect(streams(out, 0)).toBe(streams(original, 0));
  expect(streams(out, 1)).toBeGreaterThan(streams(original, 1));

  // pdf.js: open the exported PDF in Collide and read page 2's pixels. The rectangle's red outline is on the
  // yellow block, and the pen's stroke (red too: the colour carries over) is on the green block; the original has neither.
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({ name: "exported.pdf", mimeType: "application/pdf", buffer: bytes });
  await expect(drawnPage(page, 1)).toBeVisible();
  await page.keyboard.press("PageDown");
  await expect(drawnPage(page, 2)).toBeVisible();
  const px = await page.getByTestId("pdf-page").locator("canvas").evaluate((c: HTMLCanvasElement) => {
    const k = c.width / 500;
    const ctx = c.getContext("2d")!;
    // The darkest-red / bluest pixel along a short run, so a 3 pt line is found whatever the rounding.
    const scan = (x0: number, y0: number, dx: number, dy: number, score: (p: number[]) => number) => {
      let best: number[] = [];
      let top = -Infinity;
      for (let t = -4; t <= 4; t += 0.5) {
        const p = [...ctx.getImageData(Math.round((x0 + dx * t) * k), Math.round((y0 + dy * t) * k), 1, 1).data.slice(0, 3)];
        if (score(p) > top) [top, best] = [score(p), p];
      }
      return best;
    };
    return {
      // The rectangle's left edge (x 290) at mid-height, on the yellow block.
      edge: scan(290, 150, 1, 0, (p) => p[0] - p[1]),
      // The pen stroke passes (120, 280) at its lowest point, over the green block.
      pen: scan(120, 280, 0, 1, (p) => p[0] - p[1]),
      // The yellow block, well inside the rectangle: unchanged.
      inside: [...ctx.getImageData(Math.round(365 * k), Math.round(150 * k), 1, 1).data.slice(0, 3)],
    };
  });
  expect(px.edge[0]).toBeGreaterThan(180);
  expect(px.edge[1]).toBeLessThan(120);
  expect(px.pen[0]).toBeGreaterThan(180);
  expect(px.pen[1]).toBeLessThan(120);
  expect(px.inside[0]).toBeGreaterThan(190);
  expect(px.inside[1]).toBeGreaterThan(150);
  expect(px.inside[2]).toBeLessThan(90);
});

test("Copy PNG gives the page in front with its markup", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFixture(page);
  await markPage2(page);
  await ws(page).getByRole("button", { name: "Copy PNG", exact: true }).click();
  const toast = page.getByRole("status");
  await expect(toast).toHaveText(/^Copied page 2 and its callouts as a PNG · \d+ × \d+$/);
  const pic = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const bmp = await createImageBitmap(await items[0].getType("image/png"));
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const x = c.getContext("2d")!;
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let yellow = 0;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 160 && d[i + 2] < 80) yellow++;
      if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) red++;
    }
    return { width: c.width, height: c.height, yellow, red };
  });
  // At least the whole page at 2 pixels per point (the bubble beside it makes it wider).
  expect(pic.width).toBeGreaterThanOrEqual(1000);
  expect(pic.height).toBeGreaterThanOrEqual(720);
  expect(pic.yellow).toBeGreaterThan(1000);
  expect(pic.red).toBeGreaterThan(200);
});
