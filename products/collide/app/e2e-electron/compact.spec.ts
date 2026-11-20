// T48 (Grant 2026-11-20): in the desktop app the collapse button shrinks the window to the compact view: 276 px of page
// wide, exactly as tall as the compact block, docked at the right edge of its screen; with or without a tab open, windowed
// or maximized (maximized: see the note at the end). Expand restores the exact earlier bounds and maximizes again if it was. Real sizes, DPI and a second
// monitor on Windows stay manual (TESTER-NOTES Run 4 item 7).
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { launch } from "./launch";

type Rect = { x: number; y: number; width: number; height: number };
type Win = { bounds: Rect; content: Rect; area: Rect; maximized: boolean };

const win = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { bounds: w.getBounds(), content: w.getContentBounds(), area: screen.getDisplayMatching(w.getBounds()).workArea, maximized: w.isMaximized() };
  }) as Promise<Win>;

/** The compact block's height in CSS px, as the page measures it. */
const blockHeight = (page: Page) => page.evaluate(() => document.querySelector('[data-testid="sidebar"]')!.getBoundingClientRect().height);

async function expectCompact(app: ElectronApplication, page: Page) {
  await expect.poll(async () => (await win(app)).content.width).toBe(276);
  const w = await win(app);
  expect(w.maximized).toBe(false);
  expect(Math.abs(w.content.height - Math.round(await blockHeight(page)))).toBeLessThanOrEqual(1);
  expect(w.bounds.x + w.bounds.width).toBe(w.area.x + w.area.width);
  expect(w.bounds.y).toBeGreaterThanOrEqual(w.area.y);
  expect(w.bounds.y + w.bounds.height).toBeLessThanOrEqual(w.area.y + w.area.height);
  await expect(page.getByRole("region", { name: "Workspace" })).toBeHidden();
}

test("windowed, with and without a tab: compact size at the right edge; Expand restores the exact bounds", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await page.getByTestId("sidebar").waitFor();
    const place = { x: 100, y: 80, width: 1100, height: 700 };
    await app.evaluate(({ BrowserWindow }, b) => BrowserWindow.getAllWindows()[0].setBounds(b), place);
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);

    const side = page.getByTestId("sidebar");
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page);
    expect((await win(app)).bounds.y).toBe(80);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);

    // With a tab open: still compact (the tab is kept and comes back).
    await side.getByRole("button", { name: "New file" }).click();
    await expect(page.getByRole("tab")).toHaveCount(1);
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);
    await expect(page.getByRole("tab")).toHaveCount(1);
  } finally {
    await close();
  }
});

// Maximized (unmaximize, then compact; Expand maximizes again) is unit-tested in src/native/collapse.test.ts: under xvfb
// there is no window manager, so maximize() never takes effect here. Manual on Windows: TESTER-NOTES Run 4 item 7.
