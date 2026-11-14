import { expect, test } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";

interface State {
  image: { name: string; width: number; height: number } | null;
  stage: { scale: number; x: number; y: number } | null;
  shapesOnImage: { id: string; x: number; y: number }[];
}
const state = (page: import("@playwright/test").Page) => page.evaluate(() => window.__collide!.getState()) as Promise<State>;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
});

test("shell has the design-system layout and an empty AI pane", async ({ page }) => {
  const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  expect((await box("toolbar")).height).toBe(52);
  expect((await box("sidebar")).width).toBe(232);
  expect((await box("inspector")).width).toBe(296);
  await expect(page.getByTestId("ai-pane")).toBeEmpty();
});

test("fixture loads and the status bar shows zoom and size", async ({ page }) => {
  const size = await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  expect(size).toEqual({ width: 400, height: 300 });
  await expect(page.getByTestId("status-dims")).toHaveText("400 × 300");
  await expect(page.getByTestId("status-zoom")).toHaveText("100%");
  await expect(page.getByTestId("file-name")).toHaveText("sample-400x300.png");
});

test("open file input loads an image", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles("tests/fixtures/sample-400x300.png");
  await expect(page.getByTestId("status-dims")).toHaveText("400 × 300");
});

test("zoom and pan do not move shapes relative to the image", async ({ page }) => {
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  await page.evaluate(() => window.__collide!.seedShape({ x: 100, y: 80, w: 120, h: 60 }));
  const before = await state(page);
  expect(before.shapesOnImage).toHaveLength(1);
  expect(before.shapesOnImage[0].x).toBeCloseTo(100, 0);
  expect(before.shapesOnImage[0].y).toBeCloseTo(80, 0);

  const area = (await page.getByTestId("canvas").boundingBox())!;
  const cx = area.x + area.width / 2 + 40;
  const cy = area.y + area.height / 2 - 30;

  // Wheel-zoom in around the cursor.
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await state(page)).stage!.scale).toBeGreaterThan(before.stage!.scale * 1.2);
  const zoomedIn = await state(page);
  expect(zoomedIn.stage!.x).not.toBeCloseTo(before.stage!.x, 1);
  expect(zoomedIn.shapesOnImage[0].x).toBeCloseTo(100, 0);
  expect(zoomedIn.shapesOnImage[0].y).toBeCloseTo(80, 0);

  // Space-drag pan.
  await page.keyboard.down("Space");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 70, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const panned = await state(page);
  expect(panned.stage!.x).toBeCloseTo(zoomedIn.stage!.x + 120, 0);
  expect(panned.stage!.y).toBeCloseTo(zoomedIn.stage!.y + 70, 0);
  expect(panned.stage!.scale).toBeCloseTo(zoomedIn.stage!.scale, 6);
  expect(panned.shapesOnImage[0].x).toBeCloseTo(100, 0);
  expect(panned.shapesOnImage[0].y).toBeCloseTo(80, 0);

  // Wheel-zoom out.
  await page.mouse.move(cx - 50, cy + 20);
  await page.mouse.wheel(0, 700);
  await expect.poll(async () => (await state(page)).stage!.scale).toBeLessThan(panned.stage!.scale * 0.8);
  const out = await state(page);
  expect(out.stage!.x).not.toBeCloseTo(panned.stage!.x, 1);
  for (const s of [zoomedIn, panned, out]) {
    expect(Math.abs(s.shapesOnImage[0].x - 100)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(s.shapesOnImage[0].y - 80)).toBeLessThanOrEqual(0.5);
  }
});

test("zoom clamps between 10% and 800%", async ({ page }) => {
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  const area = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -1000);
  await expect.poll(async () => (await state(page)).stage!.scale).toBeCloseTo(8, 6);
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 1000);
  await expect.poll(async () => (await state(page)).stage!.scale).toBeCloseTo(0.1, 6);
});
