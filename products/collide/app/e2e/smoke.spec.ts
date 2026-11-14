import { expect, test } from "@playwright/test";

test("page loads titled Collide with a dark canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Collide");
  await expect(page.getByTestId("canvas")).toBeVisible();
  const bg = await page.getByTestId("canvas").evaluate((el) => getComputedStyle(el).backgroundColor);
  // Not white/transparent: --bg-canvas resolves to a dark ink colour.
  const [r, g, b] = bg.match(/\d+/g)!.map(Number);
  expect(r + g + b).toBeLessThan(150);
});
