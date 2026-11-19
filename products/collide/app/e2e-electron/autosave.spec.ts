// T43 (Run 4, items 4.1, 4.2, 8.2) in the real Electron shell, on the real file system (a temp Documents folder).
// 4.1: the first snip is saved to Documents/Collide/Markups with no name prompt (no dialog); autosave writes only
//      there; a PDF opened from another folder is never written back, and nothing is autosaved for it.
// 4.2: the autosaved original closes without asking; a marked-up snip offers "Close without saving".
// 8.2: a PDF that was opened and saved (as .collide) is in Recents, and opens from there.
// Windows-only parts (the real Documents folder, Explorer) are manual: TESTER-NOTES Run 4 items 3 to 5.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./launch";

const FIXTURE = fileURLToPath(new URL("../tests/fixtures/two-pages.pdf", import.meta.url));

/** Replace the Open dialog with one that answers `filePaths`, and count every dialog the app shows. */
function fakeDialogs(app: ElectronApplication, filePaths: string[]) {
  return app.evaluate(({ dialog }, paths) => {
    const g = globalThis as unknown as { __dialogs: number };
    g.__dialogs = 0;
    const d = dialog as unknown as Record<string, (...args: unknown[]) => unknown>;
    d.showOpenDialog = async () => {
      g.__dialogs++;
      return { canceled: paths.length === 0, filePaths: paths };
    };
    d.showSaveDialog = async () => {
      g.__dialogs++;
      return { canceled: true };
    };
    d.showMessageBox = async () => {
      g.__dialogs++;
      return { response: 0 };
    };
  }, filePaths);
}
const dialogsShown = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { __dialogs: number }).__dialogs);

async function snip(app: ElectronApplication, page: Page) {
  const opened = app.waitForEvent("window").catch(() => null);
  const before = await page.evaluate(() => window.__collide!.state().tabs.length);
  await page.getByTestId("new-snip").click();
  // The overlay window is made once; a later snip reuses it.
  const overlay = (await Promise.race([opened, new Promise<null>((r) => setTimeout(() => r(null), 3000))])) ?? app.windows().find((w) => w.url().includes("overlay"))!;
  await expect(overlay.getByTestId("overlay")).toBeVisible();
  const view = await overlay.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  await overlay.mouse.move(view.w / 2 - 50, view.h / 2 - 40);
  await overlay.mouse.down();
  await overlay.mouse.move(view.w / 2 + 50, view.h / 2 + 40, { steps: 4 });
  await overlay.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__collide!.state().tabs.length)).toBe(before + 1);
}

const markupsOf = (documents: string) => {
  const root = join(documents, "Collide", "Markups");
  return existsSync(root) ? readdirSync(root).sort() : [];
};

test("4.1 / 4.2: a snip saves itself into Documents/Collide/Markups with no prompt; edits wait for Save; closing asks only when marked up", async () => {
  const { app, documents, close } = await launch({ fakeCapture: true });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await fakeDialogs(app, []);
    const root = join(documents, "Collide", "Markups");

    await snip(app, page);
    await expect.poll(() => markupsOf(documents)).toHaveLength(1);
    const [folder] = markupsOf(documents);
    expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}_snip-\d{4}-\d{2}-\d{2}-\d{4}$/);
    await expect.poll(() => (existsSync(join(root, folder)) ? readdirSync(join(root, folder)).sort() : [])).toEqual(["annotations.json", "export.png", "source.png"]);
    expect(await dialogsShown(app)).toBe(0);
    let s = await page.evaluate(() => window.__collide!.state());
    expect(s.tabs).toEqual([expect.objectContaining({ kind: "snip", dirty: false, active: true })]);
    await expect(page.getByRole("complementary", { name: "Recents" }).getByRole("button", { name: new RegExp(`^${folder}`) })).toBeVisible();

    // Marked up: the tab has unsaved changes and nothing is written until Save.
    const saved = readFileSync(join(root, folder, "annotations.json"), "utf8");
    await page.evaluate(() => window.__collide!.seedShape({ x: 10, y: 10, w: 40, h: 30 }));
    expect((await page.evaluate(() => window.__collide!.state())).tabs[0].dirty).toBe(true);
    await page.waitForTimeout(800);
    expect(readFileSync(join(root, folder, "annotations.json"), "utf8")).toBe(saved);

    // Closing the marked-up snip offers Close without saving; Cancel keeps it; Save writes the same folder.
    const title = s.tabs[0].title;
    await page.getByRole("button", { name: `Close ${title}`, exact: true }).click();
    const splash = page.getByRole("alertdialog", { name: `Save changes to ${title}?` });
    await expect(splash.getByRole("button", { name: "Close without saving" })).toBeVisible();
    await splash.getByRole("button", { name: "Cancel" }).click();
    await page.getByTestId("save-markup").click();
    await expect(page.getByTestId("notice")).toContainText("Markup saved");
    expect(markupsOf(documents)).toEqual([folder]);
    expect(readFileSync(join(root, folder, "annotations.json"), "utf8")).not.toBe(saved);

    // A second snip (same minute or not) gets its own folder; its unchanged original closes without asking.
    await snip(app, page);
    await expect.poll(() => markupsOf(documents)).toHaveLength(2);
    s = await page.evaluate(() => window.__collide!.state());
    const second = s.tabs.find((t) => t.active)!;
    expect(second.dirty).toBe(false);
    // Both snips may share a title (same minute): the new tab is the last one.
    await page.getByRole("button", { name: `Close ${second.title}`, exact: true }).last().click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect((await page.evaluate(() => window.__collide!.state())).tabs).toHaveLength(1);
    expect(await dialogsShown(app)).toBe(0);
  } finally {
    await close();
  }
});

test("4.1 / 8.2: a PDF from the Desktop is never autosaved or written back; saved as .collide it is in Recents and opens from there", async () => {
  const { app, documents, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    const desk = join(dirname(documents), "Desktop");
    mkdirSync(desk);
    const pdf = join(desk, "two-pages.pdf");
    copyFileSync(FIXTURE, pdf);
    await fakeDialogs(app, [pdf]);

    await page.getByTestId("open-markup").click();
    await expect(page.getByTestId("notice")).toContainText("PDF opened");
    const drawn = page.locator('[data-testid="pdf-page"][data-page="1"][data-drawn="yes"]');
    await expect(drawn).toBeVisible();
    const box = (await drawn.boundingBox())!;
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 160, { steps: 6 });
    await page.mouse.up();
    expect((await page.evaluate(() => window.__collide!.state())).tabs[0]).toMatchObject({ kind: "pdf", dirty: true });
    await page.waitForTimeout(800);
    // Nothing autosaved, the Desktop PDF untouched, no row in Recents yet.
    expect(markupsOf(documents)).toEqual([]);
    expect(readdirSync(desk)).toEqual(["two-pages.pdf"]);
    expect(readFileSync(pdf).equals(readFileSync(FIXTURE))).toBe(true);
    const recents = page.getByRole("complementary", { name: "Recents" });
    await expect(recents.getByRole("button", { name: /^two-pages\.collide/ })).toHaveCount(0);

    await page.getByRole("toolbar", { name: "PDF tools" }).getByRole("button", { name: "Save as .collide", exact: true }).click();
    await expect(page.getByTestId("toast")).toContainText("Saved two-pages.collide");
    expect(markupsOf(documents)).toEqual(["two-pages.collide"]);
    expect(readFileSync(pdf).equals(readFileSync(FIXTURE))).toBe(true);
    const row = recents.getByRole("button", { name: /^two-pages\.collide/ });
    await expect(row).toBeVisible();

    // Closed (it was saved: no splash), it opens again from its Recents row with its markup.
    await page.getByRole("button", { name: "Close two-pages.pdf", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await row.click();
    await expect(page.locator('[data-testid="pdf-page"][data-drawn="yes"]')).toBeVisible();
    const s = await page.evaluate(() => window.__collide!.state());
    expect(s.tabs).toEqual([expect.objectContaining({ kind: "pdf", dirty: false, active: true })]);
    expect(s.items.map((i) => i.type)).toEqual(["rect"]);
  } finally {
    await close();
  }
});
