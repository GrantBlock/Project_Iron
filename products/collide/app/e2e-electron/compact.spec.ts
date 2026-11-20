// T48 (Grant 2026-11-20), written before the code (Lydia, tests first): in the desktop app the collapse button shrinks the
// window to the compact view: 276 px of page wide, exactly as tall as the compact block (data-testid="compact-block", measured
// by the page), docked at the right edge of the work area of its screen, y kept; with or without a tab open. A maximized
// window is unmaximized first; Expand restores the exact earlier bounds and maximizes again if it was maximized.
// Real sizes, DPI and a second monitor on Windows stay manual (TESTER-NOTES Run 4 item 7).
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
const blockHeight = (page: Page) => page.evaluate(() => document.querySelector('[data-testid="compact-block"]')!.getBoundingClientRect().height);

async function expectCompact(app: ElectronApplication, page: Page, y?: number) {
  await expect.poll(async () => (await win(app)).content.width).toBe(276);
  const h = Math.round(await blockHeight(page));
  await expect.poll(async () => Math.abs((await win(app)).content.height - h)).toBeLessThanOrEqual(1);
  const w = await win(app);
  expect(w.maximized).toBe(false);
  expect(w.bounds.x + w.bounds.width).toBe(w.area.x + w.area.width);
  expect(w.bounds.y).toBeGreaterThanOrEqual(w.area.y);
  expect(w.bounds.y + w.bounds.height).toBeLessThanOrEqual(w.area.y + w.area.height);
  if (y !== undefined) expect(w.bounds.y).toBe(y);
  await expect(page.getByRole("region", { name: "Workspace" })).toBeHidden();
}

async function windowed(app: ElectronApplication, place: Rect) {
  await app.evaluate(({ BrowserWindow }, b) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w.isMaximized()) w.unmaximize();
    w.setBounds(b);
  }, place);
  await expect.poll(async () => (await win(app)).bounds).toEqual(place);
}

test("windowed, no tab: compact size at the right edge, y kept; Expand restores the exact bounds", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    const side = page.getByTestId("sidebar");
    await side.waitFor();
    const place = { x: 100, y: 80, width: 1100, height: 700 };
    await windowed(app, place);
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page, 80);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);
    await expect(page.getByRole("region", { name: "Workspace" })).toBeVisible();
  } finally {
    await close();
  }
});

test("windowed, a tab open: still compact (was: the window kept its size); the tab comes back on Expand", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    const side = page.getByTestId("sidebar");
    await side.waitFor();
    const place = { x: 120, y: 60, width: 1000, height: 650 };
    await windowed(app, place);
    await side.getByRole("button", { name: "New file" }).click();
    await expect(page.getByRole("tab")).toHaveCount(1);
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page, 60);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);
    await expect(page.getByRole("tab")).toHaveCount(1);
  } finally {
    await close();
  }
});

test("a window low on the screen is moved up so the compact view stays inside the work area", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    const side = page.getByTestId("sidebar");
    await side.waitFor();
    const area = (await win(app)).area;
    const place = { x: area.x + 50, y: area.y + area.height - 420, width: 900, height: 400 };
    await windowed(app, place);
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);
  } finally {
    await close();
  }
});

test("maximized: collapse unmaximizes into the compact view; Expand re-maximizes", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    const side = page.getByTestId("sidebar");
    await side.waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    // Under xvfb there may be no window manager, so maximize() can never take effect: skip there (manual on Windows).
    const took = await expect.poll(async () => (await win(app)).maximized, { timeout: 3000 }).toBe(true).then(() => true, () => false);
    test.skip(!took, "no window manager: the window cannot be maximized here; manual on Windows (TESTER-NOTES Run 4 item 7)");
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).maximized).toBe(true);
    await expect(page.getByRole("region", { name: "Workspace" })).toBeVisible();
  } finally {
    await close();
  }
});

test("the window's minimum size does not block the compact size and comes back on Expand", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    const side = page.getByTestId("sidebar");
    await side.waitFor();
    const place = { x: 100, y: 80, width: 1100, height: 700 };
    await windowed(app, place);
    const minBefore = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize());
    await side.getByRole("button", { name: "Collapse window" }).click();
    await expectCompact(app, page);
    await side.getByRole("button", { name: "Expand window" }).click();
    await expect.poll(async () => (await win(app)).bounds).toEqual(place);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize())).toEqual(minBefore);
  } finally {
    await close();
  }
});
