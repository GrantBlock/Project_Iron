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
