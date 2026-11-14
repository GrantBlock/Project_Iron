import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";

interface DocShape {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  callout?: number;
  text?: string;
  fontSize?: number;
  points?: number[];
  stroke: string;
  strokeWidth: number;
}
interface Doc {
  version: number;
  source: { kind: string; width: number; height: number };
  shapes: DocShape[];
}

const getDoc = (page: Page) => page.evaluate(() => window.__collide!.getDoc()) as Promise<Doc>;

/** Convert image pixel coordinates to page coordinates using the live stage transform. */
async function toPage(page: Page, ix: number, iy: number) {
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const { stage } = (await page.evaluate(() => window.__collide!.getState())) as { stage: { scale: number; x: number; y: number } };
  return { x: box.x + stage.x + ix * stage.scale, y: box.y + stage.y + iy * stage.scale };
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await toPage(page, ...from);
  const b = await toPage(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

const near = (actual: number, expected: number, msg: string) => expect(Math.abs(actual - expected), `${msg}: ${actual} vs ${expected}`).toBeLessThanOrEqual(2);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
});

test("draws one of each tool; the doc has the expected types and bounds (100% and zoomed)", async ({ page }) => {
  // Rectangle at 100%, dragged down-right.
  await page.keyboard.press("r");
  await drag(page, [40, 30], [140, 90]);

  // Ellipse at 100%, dragged up-left (bounds must still be normalised).
  await page.keyboard.press("o");
  await drag(page, [300, 200], [220, 150]);

  // Zoom in around the canvas centre, then draw the rest at a non-100% zoom.
  const area = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => ((await page.evaluate(() => window.__collide!.getState())) as { stage: { scale: number } }).stage.scale).toBeGreaterThan(1.3);

  await page.keyboard.press("a");
  await drag(page, [60, 200], [160, 250]);

  await page.keyboard.press("t");
  const at = await toPage(page, 200, 40);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("text-editor").fill("Check this");
  await page.keyboard.press("Enter");

  await page.keyboard.press("c");
  const c = await toPage(page, 330, 60);
  await page.mouse.click(c.x, c.y);

  const doc = await getDoc(page);
  expect(doc.version).toBe(1);
  expect(doc.source).toEqual({ kind: "image", width: 400, height: 300 });
  expect(doc.shapes.map((s) => s.type)).toEqual(["rect", "ellipse", "arrow", "text", "callout"]);
  const [rect, ellipse, arrow, text, callout] = doc.shapes;

  for (const [k, v] of Object.entries({ x: 40, y: 30, w: 100, h: 60 })) near(rect[k as "x"], v, `rect.${k}`);
  for (const [k, v] of Object.entries({ x: 220, y: 150, w: 80, h: 50 })) near(ellipse[k as "x"], v, `ellipse.${k}`);
  for (const [k, v] of Object.entries({ x: 60, y: 200, w: 100, h: 50 })) near(arrow[k as "x"], v, `arrow.${k}`);
  arrow.points!.forEach((p, i) => near(p, [0, 0, 100, 50][i], `arrow.points[${i}]`));
  near(text.x, 200, "text.x");
  near(text.y, 40, "text.y");
  expect(text.text).toBe("Check this");
  expect(text.w).toBeGreaterThan(20);
  expect(text.h).toBeGreaterThan(8);
  near(callout.x + callout.w / 2, 330, "callout centre x");
  near(callout.y + callout.h / 2, 60, "callout centre y");

  // Numbering: rect/ellipse/arrow/callout are numbered in order; text is not.
  expect(doc.shapes.map((s) => s.callout)).toEqual([1, 2, 3, undefined, 4]);
  expect(new Set(doc.shapes.map((s) => s.id)).size).toBe(5);
  for (const s of doc.shapes) expect(s.stroke).toMatch(/^#[0-9a-f]{6}$/i);
});

test("select, move, resize with a Transformer handle, and delete", async ({ page }) => {
  await page.keyboard.press("r");
  await drag(page, [100, 80], [220, 140]);
  await page.keyboard.press("v");

  // Move: grab the interior and drag by (+60, +30).
  const mid = await toPage(page, 160, 110);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x + 30, mid.y + 15, { steps: 4 });
  await page.mouse.move(mid.x + 60, mid.y + 30, { steps: 4 });
  await page.mouse.up();
  let [r] = (await getDoc(page)).shapes;
  near(r.x, 160, "moved x");
  near(r.y, 110, "moved y");
  near(r.w, 120, "w unchanged");
  near(r.h, 60, "h unchanged");

  // Resize: drag the bottom-right anchor (just outside the corner) by (+40, +20).
  const corner = await toPage(page, r.x + r.w, r.y + r.h);
  await page.mouse.move(corner.x + 2, corner.y + 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + 22, corner.y + 12, { steps: 4 });
  await page.mouse.move(corner.x + 42, corner.y + 22, { steps: 4 });
  await page.mouse.up();
  [r] = (await getDoc(page)).shapes;
  near(r.x, 160, "x fixed while resizing from bottom-right");
  near(r.y, 110, "y fixed while resizing from bottom-right");
  near(r.w, 160, "resized w");
  near(r.h, 80, "resized h");

  // Delete removes the selection; a second Delete is harmless.
  await page.keyboard.press("Delete");
  expect((await getDoc(page)).shapes).toHaveLength(0);
  await page.keyboard.press("Delete");
  expect((await getDoc(page)).shapes).toHaveLength(0);
});

test("clicking empty canvas deselects; Backspace deletes a selected shape", async ({ page }) => {
  await page.keyboard.press("c");
  const p = await toPage(page, 100, 100);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press("v");
  const empty = await toPage(page, 300, 250);
  await page.mouse.click(empty.x, empty.y);
  await page.keyboard.press("Backspace");
  expect((await getDoc(page)).shapes).toHaveLength(1);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press("Backspace");
  expect((await getDoc(page)).shapes).toHaveLength(0);
});

test("toolbar buttons select tools and the stroke width applies to new shapes", async ({ page }) => {
  await page.getByRole("button", { name: "Rectangle" }).click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-tool", "rect");
  await page.getByRole("button", { name: "Stroke 5" }).click();
  await page.getByTestId("swatch").nth(1).click();
  await drag(page, [20, 20], [120, 90]);
  const [s] = (await getDoc(page)).shapes;
  expect(s.strokeWidth).toBe(5);
  expect(s.stroke.toLowerCase()).toBe("#4c87c4");
});

test("Space does not preventDefault when a toolbar button has focus", async ({ page }) => {
  const prevented = await page.evaluate(async () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="toolbar"] button[aria-label="Rectangle"]')!;
    btn.focus();
    let result: boolean | null = null;
    window.addEventListener("keydown", (e) => (result = e.defaultPrevented), { once: true });
    btn.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true }));
    return result;
  });
  expect(prevented).toBe(false);
});
