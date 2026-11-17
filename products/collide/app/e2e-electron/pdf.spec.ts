// RUN3 T38: a PDF in the real Electron shell, from its own build under collide:// (pdf.js and its worker come from
// the build, nothing from the internet). Open picks the fixture from a folder outside Markups (only that file can be
// read), pdf.js draws page 2, a box drawn there is saved as .collide beside the markups, and Export writes
// two-pages-markup.pdf into Documents/Collide/Markups with 2 pages and more content on page 2.
import { expect, test, type ElectronApplication } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFArray, PDFDocument } from "pdf-lib";
import { launch } from "./launch";

const FIXTURE = fileURLToPath(new URL("../tests/fixtures/two-pages.pdf", import.meta.url));

function answerDialog(app: ElectronApplication, filePaths: string[]) {
  return app.evaluate(({ dialog }, paths) => {
    (dialog as unknown as { showOpenDialog: (...args: unknown[]) => Promise<unknown> }).showOpenDialog = async () => ({ canceled: paths.length === 0, filePaths: paths });
  }, filePaths);
}

test("open a PDF from the Desktop, mark up page 2, save as .collide and Export a PDF into Markups", async () => {
  const { app, documents, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    expect(page.url()).toMatch(/^collide:/);
    const desk = join(dirname(documents), "Desktop");
    mkdirSync(desk);
    const pdf = join(desk, "two-pages.pdf");
    copyFileSync(FIXTURE, pdf);
    const other = join(desk, "other.pdf");
    copyFileSync(FIXTURE, other);

    await answerDialog(app, [pdf]);
    await page.getByTestId("open-markup").click();
    await expect(page.getByTestId("notice")).toContainText("PDF opened");
    await expect(page.locator('[data-testid="pdf-page"][data-page="1"][data-drawn="yes"]')).toBeVisible();
    // Only the picked file is readable from the page.
    const refused = await page.evaluate((p) => window.collide!.collideFiles.openPdf(p).then(() => "resolved", (e: Error) => e.message), other);
    expect(refused).toContain("is outside Documents/Collide/Markups");

    await page.keyboard.press("PageDown");
    const drawn = page.locator('[data-testid="pdf-page"][data-page="2"][data-drawn="yes"]');
    await expect(drawn).toBeVisible();
    const box = (await drawn.boundingBox())!;
    const k = box.width / 500;
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();
    await page.mouse.move(box.x + 290 * k, box.y + 100 * k);
    await page.mouse.down();
    await page.mouse.move(box.x + 440 * k, box.y + 200 * k, { steps: 6 });
    await page.mouse.up();
    const before = await page.evaluate(() => window.__collide!.state());
    expect(before.pdf).toEqual({ pageIndex: 1, pageCount: 2 });
    expect(before.items.map((i) => i.type)).toEqual(["rect"]);

    await page.getByRole("toolbar", { name: "PDF tools" }).getByRole("button", { name: "Save as .collide", exact: true }).click();
    await expect(page.getByTestId("toast")).toHaveText("Saved two-pages.collide · the PDF (2 pages) with 1 item · Documents/Collide/Markups/");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByTestId("toast")).toHaveText("Exported two-pages-markup.pdf · 2 pages, markup on 1 · Documents/Collide/Markups/");

    const root = join(documents, "Collide", "Markups");
    expect(readdirSync(root).sort()).toEqual(["two-pages-markup.pdf", "two-pages.collide"]);
    const original = await PDFDocument.load(readFileSync(FIXTURE));
    const out = await PDFDocument.load(readFileSync(join(root, "two-pages-markup.pdf")));
    expect(out.getPages().map((p) => p.getSize())).toEqual(original.getPages().map((p) => p.getSize()));
    const streams = (d: PDFDocument, i: number) => {
      const c = d.getPage(i).node.Contents();
      return c instanceof PDFArray ? c.size() : c ? 1 : 0;
    };
    expect(streams(out, 0)).toBe(streams(original, 0));
    expect(streams(out, 1)).toBeGreaterThan(streams(original, 1));
    // The Desktop PDF is untouched.
    expect(readFileSync(pdf).equals(readFileSync(FIXTURE))).toBe(true);
  } finally {
    await close();
  }
});
