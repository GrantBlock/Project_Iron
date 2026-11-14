import { expect, test } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";
type Stage = { scale: number; x: number; y: number; width: number; height: number };
const stage = (page: import("@playwright/test").Page) => page.evaluate(() => window.__collide!.getState().stage) as Promise<Stage>;

// The image's centre on screen, relative to the canvas container.
const centre = (s: Stage) => ({ x: s.x + (400 * s.scale) / 2, y: s.y + (300 * s.scale) / 2 });
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
});

test("shrinking the window refits and recentres the image", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await expect.poll(async () => (await stage(page)).scale).toBeLessThan(1);
  const s = await stage(page);
  const c = centre(s);
  near(c.x, s.width / 2);
  near(c.y, s.height / 2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await stage(page)).scale).toBe(1);
  const s2 = await stage(page);
  near(centre(s2).x, s2.width / 2);
  near(centre(s2).y, s2.height / 2);
});

test("after a user zoom, resizing keeps the zoom and the centred point; Ctrl+0 refits", async ({ page }) => {
  const box = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await stage(page)).scale).toBeGreaterThan(1);
  const before = await stage(page);
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect.poll(async () => (await stage(page)).width).not.toBe(before.width);
  const after = await stage(page);
  expect(after.scale).toBe(before.scale);
  near(after.x - before.x, (after.width - before.width) / 2);
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+0");
  await expect.poll(async () => (await stage(page)).scale).toBe(1);
});

test("Copy puts the flattened PNG on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByTestId("copy-btn").click();
  await expect(page.getByTestId("notice")).toContainText("Copied to clipboard");
  const size = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bmp = await createImageBitmap(await item.getType("image/png"));
    return [bmp.width, bmp.height];
  });
  expect(size).toEqual([400, 300]);
});
