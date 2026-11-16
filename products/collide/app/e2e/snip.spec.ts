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

test("Copy takes the image + markups past its edge (Canvas snip is removed, Grant 2026-11-15): copied as the print area", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.evaluate(() => window.__collide!.openImage("/tests/fixtures/sample-400x300.png"));
  // A markup sticking out past the left edge, so the copied area includes canvas background.
  await page.evaluate(() => window.__collide!.seedShape({ x: -40, y: 20, w: 100, h: 60 }));
  await expect(page.getByTestId("canvas-snip")).toHaveCount(0);
  const frame = await page.getByTestId("canvas").getByText(/^Print area · \d+ × \d+$/).textContent();
  const [w, h] = frame!.replace("Print area · ", "").split(" × ").map(Number);
  expect(w).toBeGreaterThan(400 + 40);

  await page.getByTestId("copy-btn").click();
  await expect(page.getByTestId("notice")).toContainText(`Copied the print area · ${w} × ${h} with note boxes`);
  // Copy stays in the same markup: the tab and its shapes are as they were.
  await expect(page.getByTestId("file-name")).toHaveText("sample-400x300.png");
  expect(((await page.evaluate(() => window.__collide!.getDoc())) as { shapes: unknown[] }).shapes).toHaveLength(1);
  const size = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bmp = await createImageBitmap(await item.getType("image/png"));
    return [bmp.width, bmp.height];
  });
  expect(size).toEqual([w, h]);
});

test("Esc leaves a drawing tool without drawing (Canvas snip mode is gone)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await expect(page.getByTestId("canvas-snip")).toHaveCount(0);
  await page.evaluate(() => window.__collide!.openImage("/tests/fixtures/sample-400x300.png"));
  await expect(page.getByTestId("canvas-snip")).toHaveCount(0);
  await page.keyboard.press("r");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-tool", "rect");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-tool", "select");
  await expect(page.getByTestId("file-name")).toHaveText("sample-400x300.png");
  expect(((await page.evaluate(() => window.__collide!.getDoc())) as { shapes: unknown[] }).shapes).toHaveLength(0);
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
