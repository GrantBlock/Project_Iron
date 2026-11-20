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
  // T31: home is the blank canvas; the Konva canvas comes with the Snip tab an image opens in.
  await page.getByTestId("canvas").waitFor();
});

test("shell has the design-system layout and an empty AI pane", async ({ page }) => {
  const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  // T31: the sidebar is the prototype's Recents panel, 276 wide (was 232); it is there on the blank canvas too.
  expect((await box("sidebar")).width).toBe(276);
  // T31: the toolbar and the inspector belong to a Snip tab, so an image is opened first.
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  expect((await box("toolbar")).height).toBe(52);
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

test("right-drag pans the view in any tool, over shapes too, without selecting, drawing or a context menu", async ({ page }) => {
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  await page.evaluate(() => window.__collide!.seedShape({ x: 100, y: 80, w: 120, h: 60 }));
  const doc0 = (await page.evaluate(() => window.__collide!.getDoc())) as { shapes: unknown[] };
  let menus = 0;
  await page.exposeFunction("__menu", () => void menus++);
  await page.evaluate(() => document.addEventListener("contextmenu", (e) => !e.defaultPrevented && (window as unknown as { __menu: () => void }).__menu()));

  for (const tool of ["v", "r"]) {
    await page.keyboard.press(tool);
    const before = (await state(page)).stage!;
    const area = (await page.getByTestId("canvas").boundingBox())!;
    // Start on the shape (image px 160,110) to prove it is not grabbed or selected.
    const sx = area.x + before.x + 160 * before.scale;
    const sy = area.y + before.y + 110 * before.scale;
    await page.mouse.move(sx, sy);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(sx + 90, sy + 40, { steps: 6 });
    await page.mouse.up({ button: "right" });
    const after = (await state(page)).stage!;
    expect(after.x).toBeCloseTo(before.x + 90, 0);
    expect(after.y).toBeCloseTo(before.y + 40, 0);
    expect(after.scale).toBe(before.scale);
  }
  const doc1 = (await page.evaluate(() => window.__collide!.getDoc())) as { shapes: { x: number; y: number }[] };
  expect(doc1.shapes).toHaveLength(doc0.shapes.length); // nothing drawn
  expect([doc1.shapes[0].x, doc1.shapes[0].y]).toEqual([100, 80]); // not moved
  expect(menus).toBe(0);
});
