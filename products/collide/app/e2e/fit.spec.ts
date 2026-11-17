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
  // T31: home is the blank canvas; the Konva canvas comes with the Snip tab an image opens in.
  await page.getByTestId("canvas").waitFor();
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
  // T32: Copy takes the print area (here just the image) and says its size.
  await expect(page.getByTestId("notice")).toContainText("Copied the print area · 400 × 300 with note boxes");
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

async function toPage(page: import("@playwright/test").Page, ix: number, iy: number) {
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const s = await stage(page);
  return { x: box.x + s.x + ix * s.scale, y: box.y + s.y + iy * s.scale };
}
const doc = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__collide!.getDoc()) as Promise<{ shapes: { note?: string; label?: { x: number; y: number; w: number } }[] }>;

test("an empty note still shows its number and arrow in Copy; hiding the bubble leaves them out", async ({ page }) => {
  const copyW = async () => ((await page.evaluate(() => window.__collide!.copyFit())) as { width: number }).width;
  await page.keyboard.press("p");
  const pt = await toPage(page, 380, 150);
  await page.mouse.click(pt.x, pt.y);
  // Empty note: a number chip right of the image, included in Copy.
  const chip = await copyW();
  expect(chip).toBeGreaterThan(400 + 40);
  expect(chip).toBeLessThan(400 + 40 + 100);
  // With text, the box grows.
  await page.getByTestId("callout-note").first().fill("background needs blending");
  await page.keyboard.press("Tab");
  expect(await copyW()).toBeGreaterThan(chip + 100);
  // T32: the card's "Hide the bubble" (was Hide #) drops the box and arrow from Copy and is saved in the doc.
  await page.getByRole("button", { name: "Hide the bubble and arrow (Copy and Export too)" }).click();
  await expect(page.getByRole("button", { name: "Bubble hidden: click to show" })).toHaveAttribute("aria-pressed", "true");
  expect(await copyW()).toBe(400);
  expect(((await doc(page)).shapes[0] as { hideBubble?: boolean }).hideBubble).toBe(true);
  await page.getByRole("button", { name: "Bubble hidden: click to show" }).click();
  expect(await copyW()).toBeGreaterThan(chip + 100);
});

test("double-click edits a note on the canvas; drag moves the box and its right edge resizes it", async ({ page }) => {
  await page.keyboard.press("r");
  const a = await toPage(page, 10, 120);
  const b = await toPage(page, 60, 160);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  // T32: the new note has the cursor; Esc leaves it and goes back to Select.
  await page.keyboard.press("Escape");
  // Empty: a number chip left of the image (x = -40 - 28 .. -40), set 14 px above the centre line (y = 112 .. 140).
  const chip = await toPage(page, -54, 126);
  await page.mouse.dblclick(chip.x, chip.y);
  await page.getByTestId("note-editor").fill("Check the header colour against the brand palette");
  await page.keyboard.press("Enter");
  expect((await doc(page)).shapes[0].note).toBe("Check the header colour against the brand palette");
  // Now a full box: x = -40 - 150 .. -40, still above the centre line.
  const inBox = await toPage(page, -140, 120);

  // Move the box up by 60.
  await page.mouse.move(inBox.x, inBox.y);
  await page.mouse.down();
  await page.mouse.move(inBox.x, inBox.y - 30, { steps: 4 });
  await page.mouse.move(inBox.x, inBox.y - 60, { steps: 4 });
  await page.mouse.up();
  const moved = (await doc(page)).shapes[0].label!;
  expect(Math.abs(moved.x - -190)).toBeLessThanOrEqual(2);
  expect(moved.w).toBe(150);

  // Resize: drag the right edge 40 px left; the box gets narrower (height re-fits).
  const s = await stage(page);
  const edge = await toPage(page, moved.x + moved.w - 1, moved.y + 10);
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(edge.x - 20 * s.scale, edge.y, { steps: 4 });
  await page.mouse.move(edge.x - 40 * s.scale, edge.y, { steps: 4 });
  await page.mouse.up();
  const resized = (await doc(page)).shapes[0].label!;
  expect(Math.abs(resized.w - 110)).toBeLessThanOrEqual(3);
  expect(resized.x).toBe(moved.x);
});
