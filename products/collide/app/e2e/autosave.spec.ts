// T43 (Run 4, items 4.1, 4.2, 8.2): autosave and Recents in the browser build (the store is the memory store,
// kept in localStorage under collide.markups.v1). The real folder, Documents/Collide/Markups, is checked in
// e2e-electron/autosave.spec.ts.
// 4.1: the first snip saves itself, with no name prompt. Autosave writes only into the markups store; an image, a
//      PDF or a .collide file opened from elsewhere is never autosaved: it needs Save or Save as.
// 4.2: "Close without saving" is offered for a marked-up image, not for an autosaved original (which closes at once).
// 8.2: a file that was opened and then saved is in Recents.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const IMAGE = "/tests/fixtures/sample-400x300.png";
const IMAGE_FILE = fileURLToPath(new URL("../tests/fixtures/sample-400x300.png", import.meta.url));
const PDF_FILE = fileURLToPath(new URL("../tests/fixtures/two-pages.pdf", import.meta.url));

const state = (page: Page) => page.evaluate(() => window.__collide!.state());
const recents = (page: Page) => page.getByRole("complementary", { name: "Recents" });
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
/** The saved markups in the browser's store: folder name → number of shapes in its annotations.json. */
const stored = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("collide.markups.v1");
    const map = raw ? (JSON.parse(raw) as Record<string, { annotations: string }>) : {};
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, (JSON.parse(v.annotations) as { shapes: unknown[] }).shapes.length]));
  });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function start(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
}

test("4.1 / 4.2: a finished snip is saved at once with no prompt; its unchanged original closes without asking", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await start(page);
  await page.evaluate((u) => window.__collide!.openSnip(u, "snip-autosave"), IMAGE);
  const folder = `${today()}_snip-autosave`;

  // Saved: in the store, no unsaved dot, the header names the folder, and it is in Recents.
  await expect.poll(() => stored(page)).toEqual({ [folder]: 0 });
  expect((await state(page)).tabs).toEqual([expect.objectContaining({ title: "snip-autosave", kind: "snip", dirty: false, active: true })]);
  await expect(ws(page).getByText(`Documents/Collide/Markups/${folder}`)).toBeVisible();
  await expect(recents(page).getByRole("button", { name: new RegExp(`^${folder}`) })).toBeVisible();
  // No name prompt, no splash; the snip still went to the clipboard.
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByTestId("notice")).toContainText("Snip copied to clipboard");

  // The autosaved original closes without asking.
  await page.getByRole("button", { name: "Close snip-autosave", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect((await state(page)).tabs).toEqual([]);
});

test("4.1: two snips with the same name each get their own folder (the second never replaces the first)", async ({ page }) => {
  await start(page);
  await page.evaluate((u) => window.__collide!.openSnip(u, "snip-same"), IMAGE);
  await expect.poll(async () => Object.keys(await stored(page)).length).toBe(1);
  await page.evaluate((u) => window.__collide!.openSnip(u, "snip-same"), IMAGE);
  await expect.poll(async () => Object.keys(await stored(page)).sort()).toEqual([`${today()}_snip-same`, `${today()}_snip-same-2`]);
  expect((await state(page)).tabs.map((t) => [t.title, t.dirty])).toEqual([
    ["snip-same", false],
    ["snip-same", false],
  ]);
});

test("4.2: a marked-up snip asks first and offers Close without saving; its changes are not written until Save", async ({ page }) => {
  await start(page);
  await page.evaluate((u) => window.__collide!.openSnip(u, "snip-marked"), IMAGE);
  const folder = `${today()}_snip-marked`;
  await expect.poll(() => stored(page)).toEqual({ [folder]: 0 });

  await page.evaluate(() => window.__collide!.seedShape({ x: 20, y: 20, w: 80, h: 40 }));
  expect((await state(page)).tabs[0].dirty).toBe(true);
  await page.waitForTimeout(500);
  expect(await stored(page)).toEqual({ [folder]: 0 });

  await page.getByRole("button", { name: "Close snip-marked", exact: true }).click();
  const splash = page.getByRole("alertdialog", { name: "Save changes to snip-marked?" });
  await expect(splash).toBeVisible();
  await expect(splash.getByRole("button", { name: "Close without saving" })).toBeVisible();
  await splash.getByRole("button", { name: "Close without saving" }).click();
  expect((await state(page)).tabs).toEqual([]);
  // The autosaved original is still there, unchanged.
  expect(await stored(page)).toEqual({ [folder]: 0 });
});

test("4.1: an image opened from elsewhere is never autosaved; marked up, closing offers Close without saving", async ({ page }) => {
  await start(page);
  await page.getByTestId("file-input").setInputFiles(IMAGE_FILE);
  await expect(page.getByTestId("file-name")).toHaveText("sample-400x300.png");
  await page.evaluate(() => window.__collide!.seedShape({ x: 20, y: 20, w: 80, h: 40 }));
  await page.waitForTimeout(500);
  expect(await stored(page)).toEqual({});
  expect((await state(page)).tabs[0]).toMatchObject({ kind: "snip", dirty: true });

  await page.getByRole("button", { name: "Close sample-400x300.png", exact: true }).click();
  const splash = page.getByRole("alertdialog", { name: "Save changes to sample-400x300.png?" });
  await expect(splash.getByRole("button", { name: "Close without saving" })).toBeVisible();
  await splash.getByRole("button", { name: "Close without saving" }).click();
  expect(await stored(page)).toEqual({});
});

test("8.2: an opened image, once saved, is in Recents", async ({ page }) => {
  await start(page);
  await page.getByTestId("file-input").setInputFiles(IMAGE_FILE);
  await expect(page.getByTestId("file-name")).toHaveText("sample-400x300.png");
  await page.getByTestId("save-markup").click();
  await expect(page.getByTestId("notice")).toContainText("Markup saved");
  await expect(recents(page).getByRole("button", { name: new RegExp(`^${today()}_sample-400x300`) })).toBeVisible();
});

test("4.1 / 8.2: a PDF opened from elsewhere is never autosaved; once saved it is in Recents and opens from there", async ({ page }) => {
  await start(page);
  await page.getByTestId("file-input").setInputFiles(PDF_FILE);
  await expect(page.getByTestId("notice")).toContainText("PDF opened");
  const drawn = page.locator('[data-testid="pdf-page"][data-page="1"][data-drawn="yes"]');
  await expect(drawn).toBeVisible();
  let downloads = 0;
  page.on("download", () => downloads++);
  const box = (await drawn.boundingBox())!;
  await ws(page).getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 160, { steps: 6 });
  await page.mouse.up();
  expect((await state(page)).tabs[0]).toMatchObject({ kind: "pdf", dirty: true });
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  expect(await stored(page)).toEqual({});
  await expect(recents(page).getByRole("button", { name: /^two-pages\.collide/ })).toHaveCount(0);

  // Save as .collide: now it is in Recents.
  const download = page.waitForEvent("download");
  await ws(page).getByRole("toolbar", { name: "PDF tools" }).getByRole("button", { name: "Save as .collide", exact: true }).click();
  await download;
  const row = recents(page).getByRole("button", { name: /^two-pages\.collide/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Collide file");

  // Closed, it opens again from Recents with its markup.
  await page.getByRole("button", { name: "Close two-pages.pdf", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect((await state(page)).tabs).toEqual([]);
  await row.click();
  await expect(page.locator('[data-testid="pdf-page"][data-drawn="yes"]')).toBeVisible();
  const s = await state(page);
  expect(s.tabs).toEqual([expect.objectContaining({ kind: "pdf", dirty: false, active: true })]);
  expect(s.items.map((i) => i.type)).toEqual(["rect"]);
});

test("8.2: a .collide file opened and saved again is in Recents", async ({ page }) => {
  await start(page);
  // Make a .collide file from the PDF, then open it on a fresh page.
  await page.getByTestId("file-input").setInputFiles(PDF_FILE);
  await expect(page.locator('[data-testid="pdf-page"][data-drawn="yes"]')).toBeVisible();
  const first = page.waitForEvent("download");
  await ws(page).getByRole("toolbar", { name: "PDF tools" }).getByRole("button", { name: "Save as .collide", exact: true }).click();
  const bytes = readFileSync(await (await first).path());
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("file-input").setInputFiles({ name: "report.collide", mimeType: "application/zip", buffer: bytes });
  await expect(page.getByTestId("notice")).toContainText("Collide file opened");
  await expect(recents(page).getByRole("button", { name: /^report\.collide/ })).toHaveCount(0);
  const again = page.waitForEvent("download");
  await ws(page).getByRole("toolbar", { name: "PDF tools" }).getByRole("button", { name: "Save as .collide", exact: true }).click();
  await again;
  await expect(recents(page).getByRole("button", { name: /^report\.collide/ })).toBeVisible();
});
