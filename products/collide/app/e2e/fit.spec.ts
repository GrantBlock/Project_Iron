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

test("Copy auto-crops to annotations outside the image, on the canvas background", async ({ page }) => {
  await page.evaluate(() => window.__collide!.seedShape({ x: -60, y: -40, w: 120, h: 80 }));
  const f = (await page.evaluate(() => window.__collide!.copyFit())) as { dataUrl: string; width: number; height: number };
  // -60-24 .. 400 (+ stroke) wide; -40-24 .. 300 tall.
  expect(f.width).toBeGreaterThanOrEqual(400 + 60 + 24);
  expect(f.height).toBeGreaterThanOrEqual(300 + 40 + 24);
  const corner = await page.evaluate(async (u) => {
    const bmp = await createImageBitmap(await (await fetch(u)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!;
    c.drawImage(bmp, 0, 0);
    // bottom-left corner lies outside both the image and the shape
    return Array.from(c.getImageData(1, bmp.height - 2, 1, 1).data);
  }, f.dataUrl);
  expect(corner).toEqual([9, 9, 11, 255]); // --bg-canvas #09090B
  // The editor view is unchanged afterwards.
  const s = (await page.evaluate(() => window.__collide!.getState().stage))!;
  expect(s.scale).toBe(1);
});

test("a callout's note shows as a label on the canvas and widens the copy", async ({ page }) => {
  await page.keyboard.press("c");
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const s = (await page.evaluate(() => window.__collide!.getState().stage))!;
  // Click near the image's right edge so the note label spills past it.
  await page.mouse.click(box.x + s.x + 380, box.y + s.y + 150);
  const before = (await page.evaluate(() => window.__collide!.copyFit())) as { width: number };
  expect(before.width).toBe(400 + 0); // badge alone sits inside the image
  await page.getByTestId("callout-note").first().fill("background needs blending");
  await page.keyboard.press("Tab");
  const f = (await page.evaluate(() => window.__collide!.copyFit())) as { width: number };
  expect(f.width).toBeGreaterThan(400 + 24);
});
