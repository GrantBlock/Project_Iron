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
