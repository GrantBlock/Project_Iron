// T50 (Grant 2026-11-20), written before the code (Lydia, tests first): the full view has a minimum window content size
// (MIN_WIDTH x MIN_HEIGHT from src/native/minSize.ts); collapsing to the compact view (T48) lifts it so the window can be
// 276 wide; expanding puts it back. The minimum is the window's content size (BrowserWindow `useContentSize` with
// minWidth / minHeight), so it is checked by what a too-small request gives: the page area clamps to the minimum.
// Real sizes, DPI and a second monitor on Windows stay manual (TESTER-NOTES Run 4).
import { expect, test, type ElectronApplication } from "@playwright/test";
import { MIN_HEIGHT, MIN_WIDTH } from "../src/native/minSize";
import { launch } from "./launch";

type Size = { width: number; height: number };
const content = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const c = BrowserWindow.getAllWindows()[0].getContentBounds();
    return { width: c.width, height: c.height };
  }) as Promise<Size>;
const squeeze = (app: ElectronApplication, width: number, height: number) =>
  app.evaluate(({ BrowserWindow, screen }, [w, h]) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isMaximized()) win.unmaximize();
    const a = screen.getDisplayMatching(win.getBounds()).workArea;
    win.setBounds({ x: a.x + 20, y: a.y + 20, width: w, height: h });
  }, [width, height]);

test("the full view: a window asked to be smaller than the minimum stays at the minimum content size", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await page.getByTestId("sidebar").waitFor();
    await squeeze(app, 300, 300);
    await expect.poll(() => content(app)).toEqual({ width: MIN_WIDTH, height: MIN_HEIGHT });
    // The minimum is set at window creation, not only after a resize.
    const [mw, mh] = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize());
    expect(mw).toBeGreaterThanOrEqual(MIN_WIDTH - 1);
    expect(mh).toBeGreaterThanOrEqual(MIN_HEIGHT - 1);
  } finally {
    await close();
  }
});

test("a window larger than the minimum keeps its size", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await page.getByTestId("sidebar").waitFor();
    await squeeze(app, MIN_WIDTH + 200, MIN_HEIGHT + 150);
    await expect.poll(() => content(app)).toEqual({ width: MIN_WIDTH + 200, height: MIN_HEIGHT + 150 });
  } finally {
    await close();
  }
});

test("collapse lifts the minimum (the window is 276 wide); Expand brings it back", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    const side = page.getByTestId("sidebar");
    await side.waitFor();
    await squeeze(app, MIN_WIDTH + 100, MIN_HEIGHT + 100);
    await expect.poll(() => content(app)).toEqual({ width: MIN_WIDTH + 100, height: MIN_HEIGHT + 100 });

    await side.getByRole("button", { name: "Collapse window" }).click();
    await expect.poll(async () => (await content(app)).width).toBe(276);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize())).toEqual([0, 0]);
    // Even a request below the old minimum is not raised while compact.
    await squeeze(app, 300, 400);
    await expect.poll(async () => (await content(app)).width).toBeLessThan(MIN_WIDTH);

    await side.getByRole("button", { name: "Expand window" }).click();
    await expect(page.getByRole("region", { name: "Workspace" })).toBeVisible();
    await expect.poll(async () => (await content(app)).width).toBeGreaterThanOrEqual(MIN_WIDTH);
    await squeeze(app, 300, 300);
    await expect.poll(() => content(app)).toEqual({ width: MIN_WIDTH, height: MIN_HEIGHT });
  } finally {
    await close();
  }
});
