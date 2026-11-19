// T45 acceptance (Run 4, Grant 2026-11-18 to 2026-11-19, scope items 6.1 to 6.6) in the browser build:
// the toolbar follows the window and scrolls only when too narrow; Markdown's double row; Copy, Save source and
// Save as in the header on every tab type; one callout toolbar; Add border on the main image only.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const SNIP = "/tests/fixtures/sample-400x300.png";
const PDF = fileURLToPath(new URL("../tests/fixtures/two-pages.pdf", import.meta.url));
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
const head = (page: Page) => ws(page).locator(".wshead");
const toolbar = (page: Page) => ws(page).getByRole("toolbar");
const state = (page: Page) => page.evaluate(() => window.__collide!.state());

async function openSnip(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), SNIP);
  await ws(page).getByRole("toolbar", { name: "Markup tools" }).waitFor();
}
async function openPdf(page: Page) {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles(PDF);
  await expect(page.locator('[data-testid="pdf-page"][data-drawn="yes"]')).toBeVisible();
}
async function openMarkdown(page: Page) {
  await page.goto("/?sample");
  await page.getByRole("complementary", { name: "Recents" }).getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
  await ws(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
}

/** The toolbar's box against the workspace, and whether it overflows (a scroll bar) across or down. */
const measure = (page: Page) =>
  toolbar(page).evaluate((el) => {
    const w = el.closest("section")!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      width: r.width,
      wsWidth: w.width,
      across: el.scrollWidth > el.clientWidth,
      down: el.scrollHeight > el.clientHeight + 1,
      overflowX: cs.overflowX,
      pageScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

test.describe("6.1 the toolbar follows the window", () => {
  for (const [kind, open] of [["snip", openSnip], ["pdf", openPdf], ["markdown", openMarkdown]] as const) {
    test(`${kind}: it grows and shrinks with the window; a scroll bar only when too narrow`, async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await open(page);
      const wide = await measure(page);
      expect(Math.abs(wide.width - wide.wsWidth)).toBeLessThanOrEqual(1);
      expect(wide.across).toBe(false);
      expect(wide.down).toBe(false);
      await page.setViewportSize({ width: 1200, height: 900 });
      await expect.poll(async () => (await measure(page)).width).toBeLessThan(wide.width);
      const mid = await measure(page);
      expect(Math.abs(mid.width - mid.wsWidth)).toBeLessThanOrEqual(1);
      expect(mid.across).toBe(false);
      await page.setViewportSize({ width: 560, height: 900 });
      await expect.poll(async () => (await measure(page)).across).toBe(true);
      const narrow = await measure(page);
      expect(narrow.overflowX).toBe("auto");
      expect(narrow.down).toBe(false);
      expect(narrow.pageScroll).toBe(false);
      expect(narrow.width).toBeLessThanOrEqual(560);
      await page.setViewportSize({ width: 1600, height: 900 });
      await expect.poll(async () => (await measure(page)).across).toBe(false);
    });
  }
});

test.describe("6.2 and 6.5: one callout toolbar; Markdown adds a second row of text tools", () => {
  const rowOne = (page: Page) => toolbar(page).locator(":scope > .tbrow").first().getByRole("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") ?? b.textContent));

  test("the same callout tools on a snip, a PDF and a Markdown page; text tools only on Markdown, on row 2", async ({ page }) => {
    await openSnip(page);
    const snip = await rowOne(page);
    expect(snip).toContain("Add border");
    await expect(ws(page).getByRole("group", { name: "Text tools" })).toHaveCount(0);
    await expect(ws(page).getByRole("button", { name: "Bold" })).toHaveCount(0);

    await openPdf(page);
    expect(await rowOne(page)).toEqual(snip);
    await expect(ws(page).getByRole("group", { name: "Text tools" })).toHaveCount(0);
    await expect(ws(page).getByRole("combobox", { name: "Heading" })).toHaveCount(0);

    await openMarkdown(page);
    expect(await rowOne(page)).toEqual(snip);
    const rows = toolbar(page).locator(":scope > .tbrow");
    await expect(rows).toHaveCount(2);
    const one = (await rows.nth(0).boundingBox())!;
    const two = (await rows.nth(1).boundingBox())!;
    expect(two.y).toBeGreaterThanOrEqual(one.y + one.height - 1);
    await expect(rows.nth(1).getByRole("button", { name: "Bold" })).toBeVisible();
    await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
    await expect(toolbar(page).locator(":scope > .tbrow")).toHaveCount(2);
    await expect(ws(page).getByRole("group", { name: "Text tools" }).getByRole("button", { name: "Bold" })).toBeEnabled();
  });

  test("the callout toolbar has no save tools", async ({ page }) => {
    for (const open of [openSnip, openPdf, openMarkdown]) {
      await open(page);
      for (const n of ["Export", "Copy PNG", "Copy to clipboard", "Save as .collide"]) await expect(toolbar(page).getByRole("button", { name: n, exact: true })).toHaveCount(0);
    }
  });
});

test.describe("6.3 Copy to clipboard in the header", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });
  const clipboardSize = (page: Page) =>
    page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const bmp = await createImageBitmap(await items[0].getType("image/png"));
      return [bmp.width, bmp.height];
    });

  test("snip: the print area", async ({ page }) => {
    await openSnip(page);
    await head(page).getByRole("button", { name: "Copy to clipboard" }).click();
    await expect(page.getByTestId("notice")).toContainText("Copied the print area · 400 × 300 with note boxes");
    expect(await clipboardSize(page)).toEqual([400, 300]);
  });

  test("PDF: the page in view with its callouts", async ({ page }) => {
    await openPdf(page);
    await page.keyboard.press("PageDown");
    await expect(page.locator('[data-testid="pdf-page"][data-page="2"][data-drawn="yes"]')).toBeVisible();
    await head(page).getByRole("button", { name: "Copy to clipboard" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Copied page 2 and its callouts as a PNG · \d+ × \d+$/);
  });

  test("Markdown: Preview and Edit both copy a picture of the page", async ({ page }) => {
    await openMarkdown(page);
    await head(page).getByRole("button", { name: "Copy to clipboard" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Copied the visible page and its callouts as a PNG · \d+ × \d+$/);
    await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
    await head(page).getByRole("button", { name: "Copy to clipboard" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Copied the page as a PNG · \d+ × \d+$/);
    const [w, h] = await clipboardSize(page);
    expect(w).toBeGreaterThan(100);
    expect(h).toBeGreaterThan(100);
  });
});

test.describe("6.4 Save source and Save as in the header", () => {
  const saveAs = async (page: Page, format: string) => {
    const dl = page.waitForEvent("download");
    await head(page).getByRole("button", { name: "Save as" }).click();
    await page.getByRole("menu", { name: "Save as" }).getByRole("menuitem", { name: format, exact: true }).click();
    const d = await dl;
    return { name: d.suggestedFilename(), bytes: readFileSync((await d.path())!) };
  };
  const menu = async (page: Page) => {
    await head(page).getByRole("button", { name: "Save as" }).click();
    const items = await page.getByRole("menu", { name: "Save as" }).getByRole("menuitem").allTextContents();
    await page.keyboard.press("Escape");
    return items;
  };

  test("the buttons follow the Saved / Unsaved indicator", async ({ page }) => {
    await openSnip(page);
    const x = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!.x;
    const indicator = await x(head(page).locator(".savedstate"));
    expect(await x(head(page).getByRole("button", { name: "Save source" }))).toBeGreaterThan(indicator);
    expect(await x(head(page).getByRole("button", { name: "Save as" }))).toBeGreaterThan(await x(head(page).getByRole("button", { name: "Save source" })));
  });

  test("snip: Save source gives a .collide; Save as gives PNG, JPEG and PDF, no TXT or MD", async ({ page }) => {
    await openSnip(page);
    expect(await menu(page)).toEqual(["PNG", "JPEG", "PDF"]);
    const dl = page.waitForEvent("download");
    await head(page).getByRole("button", { name: "Save source" }).click();
    expect((await dl).suggestedFilename()).toMatch(/\.collide$/);
    const png = await saveAs(page, "PNG");
    expect(png.name).toBe("sample-400x300-markup.png");
    expect(png.bytes.subarray(1, 4).toString()).toBe("PNG");
    const jpg = await saveAs(page, "JPEG");
    expect(jpg.name).toBe("sample-400x300-markup.jpg");
    expect([...jpg.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const pdf = await saveAs(page, "PDF");
    expect(pdf.name).toBe("sample-400x300-markup.pdf");
    const doc = await PDFDocument.load(pdf.bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 300, height: 225 });
  });

  test("Markdown: Save as also gives TXT and MD, the file's text", async ({ page }) => {
    await openMarkdown(page);
    expect(await menu(page)).toEqual(["PNG", "JPEG", "PDF", "TXT", "MD"]);
    await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
    const text = await ws(page).getByRole("textbox", { name: "P06-Project-Workspace-Spec.md" }).inputValue();
    const md = await saveAs(page, "MD");
    expect(md.name).toBe("P06-Project-Workspace-Spec.md");
    expect(md.bytes.toString("utf8")).toBe(text);
    const txt = await saveAs(page, "TXT");
    expect(txt.name).toBe("P06-Project-Workspace-Spec.txt");
    expect(txt.bytes.toString("utf8")).toBe(text);
    const pdf = await saveAs(page, "PDF");
    expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBe(1);
  });

  test("PDF: Save as PDF is the smallest export (every page, markup drawn on); PNG is the page in view", async ({ page }) => {
    await openPdf(page);
    expect(await menu(page)).toEqual(["PNG", "JPEG", "PDF"]);
    const pdf = await saveAs(page, "PDF");
    expect(pdf.name).toBe("two-pages-markup.pdf");
    await expect(page.getByRole("status")).toHaveText("Exported two-pages-markup.pdf · 2 pages, markup on 0 · downloaded");
    expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBe(2);
    const png = await saveAs(page, "PNG");
    expect(png.name).toBe("two-pages-markup.png");
    expect(png.bytes.subarray(1, 4).toString()).toBe("PNG");
    const dl = page.waitForEvent("download");
    await head(page).getByRole("button", { name: "Save source" }).click();
    expect((await dl).suggestedFilename()).toBe("two-pages.collide");
  });
});

test.describe("6.6 Add border", () => {
  test("a coloured rectangle callout on the main image's edge; an added image gets none; one undo step", async ({ page }) => {
    await openSnip(page);
    await page.getByRole("button", { name: "Blue", exact: true }).click();
    await toolbar(page).getByRole("button", { name: "Add border" }).click();
    let items = (await state(page)).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "rect", number: 1, color: "blue", x: 0, y: 0, w: 400, h: 300 });

    // An added image beside the first: Add border still borders the main image only.
    // (Pasted, as in e2e/images.spec.ts.)
    const pasted = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 150;
      c.getContext("2d")!.fillRect(0, 0, 200, 150);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob!], "p.png", { type: "image/png" }));
      const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
      (document.activeElement || document.body).dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(pasted).toBe(true);
    await expect.poll(async () => (await state(page)).items.some((i) => i.type === "image")).toBe(true);
    await toolbar(page).getByRole("button", { name: "Add border" }).click();
    items = (await state(page)).items;
    const rects = items.filter((i) => i.type === "rect");
    expect(rects).toHaveLength(2);
    for (const r of rects) expect([r.x, r.y, r.w, r.h]).toEqual([0, 0, 400, 300]);
    const img = items.find((i) => i.type === "image")!;
    expect(rects.some((r) => r.x === img.x && r.y === img.y)).toBe(false);

    await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+z");
    expect((await state(page)).items.filter((i) => i.type === "rect")).toHaveLength(1);
  });

  test("on a PDF it borders the page in view", async ({ page }) => {
    await openPdf(page);
    await toolbar(page).getByRole("button", { name: "Add border" }).click();
    const items = (await state(page)).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "rect", number: 1, x: 0, y: 0, w: 612, h: 792 });
  });
});
