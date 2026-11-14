import { expect, test, type Page } from "@playwright/test";

const URL = (scale: number) => `/overlay.html?fixture=/tests/fixtures/sample-400x300.png&scale=${scale}`;

test.use({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });

async function open(page: Page, scale = 1.25) {
  await page.goto(URL(scale));
  await expect(page.getByTestId("overlay-frame")).toBeVisible();
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>("[data-testid=overlay-frame]");
    return !!img && img.complete && img.naturalWidth > 0;
  });
}

const lastResult = (page: Page) => page.evaluate(() => window.__collideOverlay.lastResult);

async function sample(page: Page, x: number, y: number) {
  const shot = await page.screenshot();
  return page.evaluate(
    async ({ b64, x, y }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      return Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
    },
    { b64: shot.toString("base64"), x, y },
  );
}

const dirs = [
  { name: "down-right", from: [120, 100], to: [260, 210], box: { x: 120, y: 100, w: 140, h: 110 } },
  { name: "down-left", from: [260, 100], to: [120, 210], box: { x: 120, y: 100, w: 140, h: 110 } },
  { name: "up-right", from: [120, 210], to: [260, 100], box: { x: 120, y: 100, w: 140, h: 110 } },
  { name: "up-left", from: [260, 210], to: [120, 100], box: { x: 120, y: 100, w: 140, h: 110 } },
] as const;

for (const d of dirs) {
  test(`drag ${d.name} emits a normalized box`, async ({ page }) => {
    await open(page);
    await page.mouse.move(d.from[0], d.from[1]);
    await page.mouse.down();
    await page.mouse.move(d.to[0], d.to[1], { steps: 8 });
    // Readout updates live, in physical px (origin-aware crop rect, as crop.rs).
    await expect(page.getByTestId("overlay-readout")).toHaveText("175 × 138");
    await page.mouse.up();
    const r = await lastResult(page);
    expect(r?.kind).toBe("crop");
    if (r?.kind !== "crop") return;
    expect(r.scale).toBe(1.25);
    for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(r.box[k] - d.box[k])).toBeLessThanOrEqual(1);
    expect(r.box.w).toBeGreaterThan(0);
    expect(r.box.h).toBeGreaterThan(0);
  });
}

test("Esc emits cancel", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Escape");
  expect(await lastResult(page)).toEqual({ kind: "cancel" });
});

test("zero-size release is a no-op", async ({ page }) => {
  await open(page);
  await page.mouse.click(150, 150);
  expect(await lastResult(page)).toBeNull();
  await expect(page.getByTestId("overlay-selection")).toHaveCount(0);
});

test("HUD copy", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("overlay-hud")).toContainText("Esc to cancel · Release to crop");
});

test("dim outside, full brightness inside, mid-drag screenshot", async ({ page }, info) => {
  await open(page, 1);
  const before = await sample(page, 100, 70); // red block, fully dimmed (no selection)
  await page.mouse.move(200, 120);
  await page.mouse.down();
  await page.mouse.move(380, 260, { steps: 6 });
  const inside = await sample(page, 340, 200); // blue block (76,135,196) inside the box
  const outside = await sample(page, 100, 70); // red block (196,80,60) outside the box
  const near = (a: number[], b: number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  expect(near(inside, [76, 135, 196], 3)).toBe(true);
  // ~50% toward ink-975 (6,6,7): 196→~101, 80→~43, 60→~33
  expect(near(outside, [101, 43, 33], 8)).toBe(true);
  expect(near(before, outside, 2)).toBe(true);
  if (process.env.T10_SHOT) await page.screenshot({ path: process.env.T10_SHOT });
  await page.mouse.up();
  void info;
});
