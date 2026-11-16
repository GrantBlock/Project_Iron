import { expect, test } from "@playwright/test";

test("New snip in a plain browser shows a clear toast and the editor keeps working", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("new-snip").click();
  const notice = page.getByTestId("notice");
  await expect(notice).toContainText("New snip needs the Collide desktop app");
  await expect(notice).toContainText("desktop app");
  await page.evaluate(() => window.__collide!.openImage("/tests/fixtures/sample-400x300.png"));
  await expect(page.getByTestId("canvas").locator("canvas").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a finished snip opens in the editor and is copied to the clipboard straight away", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.evaluate(() => window.__collide!.openSnip("/tests/fixtures/sample-400x300.png", "snip-2026-11-14-1200"));
  await expect(page.getByTestId("file-name")).toHaveText("snip-2026-11-14-1200");
  await expect(page.getByTestId("notice")).toContainText("Snip copied to clipboard");
  const size = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bmp = await createImageBitmap(await item.getType("image/png"));
    return [bmp.width, bmp.height];
  });
  expect(size).toEqual([400, 300]);
});

test("if the clipboard refuses, the snip still opens and the toast says why", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { write: () => Promise.reject(new Error("Clipboard is busy — try Copy again.")) } });
  });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.evaluate(() => window.__collide!.openSnip("/tests/fixtures/sample-400x300.png", "snip-x"));
  await expect(page.getByTestId("file-name")).toHaveText("snip-x");
  await expect(page.getByTestId("notice")).toContainText("Copy failed");
  await expect(page.getByTestId("notice")).toContainText("Clipboard is busy");
});

test("Canvas snip: drag a box over image + markups; it is copied and opened as a new markup", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.evaluate(() => window.__collide!.openImage("/tests/fixtures/sample-400x300.png"));
  // A markup sticking out past the left edge, so the snip area can include canvas background.
  await page.evaluate(() => window.__collide!.seedShape({ x: -40, y: 20, w: 100, h: 60 }));
  await page.getByTestId("canvas-snip").click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-tool", "canvas-snip");

  const box = (await page.getByTestId("canvas").boundingBox())!;
  const s = (await page.evaluate(() => window.__collide!.getState().stage))!;
  const at = (x: number, y: number) => ({ x: box.x + s.x + x * s.scale, y: box.y + s.y + y * s.scale });
  const a = at(-60, 0);
  const b = at(140, 100);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByTestId("notice")).toContainText("Snip copied to clipboard");
  await expect(page.getByTestId("file-name")).toHaveText(/^canvas-snip-\d{4}-\d{2}-\d{2}-\d{4}$/);
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-tool", "select");
  const st = (await page.evaluate(() => window.__collide!.getState())) as { image: { width: number; height: number } };
  expect([st.image.width, st.image.height]).toEqual([200, 100]);
  // The new markup starts empty: the old rectangle is now part of the picture.
  expect(((await page.evaluate(() => window.__collide!.getDoc())) as { shapes: unknown[] }).shapes).toHaveLength(0);
  const size = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bmp = await createImageBitmap(await item.getType("image/png"));
    return [bmp.width, bmp.height];
  });
  expect(size).toEqual([200, 100]);
});

test("Canvas snip: Esc leaves the mode without snipping", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  // T31: with no image open there is no Snip tab, so no Canvas snip button at all (it was there, disabled).
  await expect(page.getByTestId("canvas-snip")).toHaveCount(0);
  await page.evaluate(() => window.__collide!.openImage("/tests/fixtures/sample-400x300.png"));
  await page.getByTestId("canvas-snip").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-tool", "select");
  await expect(page.getByTestId("file-name")).toHaveText("sample-400x300.png");
});

test("snip delay: choices match Snipping Tool and the choice is remembered", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  // T31 (Grant 2026-11-15): the delay is a toggle in the sidebar, 0s / 3s / 5s / 10s (was a drop-down in the toolbar).
  const delay = page.getByTestId("snip-delay");
  const words = () => page.evaluate(() => window.__collide!.state().sidebar.delay);
  await expect(delay).toHaveAttribute("data-value", "0");
  await expect(delay.getByRole("radio", { checked: true })).toHaveText("0s");
  await expect(delay.getByRole("radio")).toHaveText(["0s", "3s", "5s", "10s"]);
  // The same four choices in words: No delay, 3 s, 5 s, 10 s.
  const said: (string | null)[] = [await words()];
  for (const c of ["3s", "10s", "5s"]) {
    await delay.getByRole("radio", { name: c, exact: true }).click();
    said.push(await words());
  }
  expect(said).toEqual(["No delay", "3 s", "10 s", "5 s"]);
  await page.reload();
  await page.waitForFunction(() => !!window.__collide);
  await expect(page.getByTestId("snip-delay")).toHaveAttribute("data-value", "5");
  await expect(page.getByTestId("snip-delay").getByRole("radio", { checked: true })).toHaveText("5s");
});
