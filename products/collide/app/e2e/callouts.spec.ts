// T41 (Run 4, items 8.1 and 7.1): a rectangle callout switched to a line stays on the canvas; line end handles.
import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";

interface DocShape {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pts?: number[];
  callout?: number;
  note?: string;
}

const getDoc = (page: Page) => page.evaluate(() => window.__collide!.getDoc()) as Promise<{ shapes: DocShape[] }>;

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

/** The canvas pixel at an image point, RGBA. */
async function pixel(page: Page, ix: number, iy: number) {
  const c = await toPage(page, ix, iy);
  return page.evaluate(
    ([x, y]) => {
      const cv = document.querySelector<HTMLCanvasElement>('[data-testid="canvas"] canvas')!;
      const r = cv.getBoundingClientRect();
      const k = cv.width / r.width;
      return Array.from(cv.getContext("2d")!.getImageData((x - r.left) * k, (y - r.top) * k, 1, 1).data);
    },
    [c.x, c.y],
  );
}
const isRed = (px: number[]) => px[0] > 200 && px[1] < 120 && px[2] < 120;

/** A line's two ends in image pixels. */
const ends = (s: DocShape) => {
  const p = s.pts ?? [];
  return [
    { x: s.x + p[0] * s.w, y: s.y + p[1] * s.h },
    { x: s.x + p[2] * s.w, y: s.y + p[3] * s.h },
  ];
};
const near = (actual: number, expected: number, msg: string) => expect(Math.abs(actual - expected), `${msg}: ${actual} vs ${expected}`).toBeLessThanOrEqual(2);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
});

test("8.1: a rectangle switched to a line stays on the canvas, and back to a rectangle; number, note, position kept", async ({ page }) => {
  await page.keyboard.press("r");
  await drag(page, [40, 30], [140, 90]);
  await page.keyboard.type("Check this");
  await page.keyboard.press("Escape");
  // A quarter of the way along the diagonal (clear of the selection's anchors): inside the outline, the image shows.
  const under = await pixel(page, 65, 45);
  expect(isRed(under)).toBe(false);

  await page.getByRole("combobox", { name: "Type of callout 1" }).selectOption("line");
  let [s] = (await getDoc(page)).shapes;
  expect(s).toMatchObject({ type: "line", callout: 1, note: "Check this" });
  near(s.x, 40, "x");
  near(s.y, 30, "y");
  near(s.w, 100, "w");
  near(s.h, 60, "h");
  expect(s.pts).toHaveLength(4);
  // The line is drawn: its diagonal is painted.
  await expect.poll(async () => isRed(await pixel(page, 65, 45))).toBe(true);

  await page.getByRole("combobox", { name: "Type of callout 1" }).selectOption("rect");
  [s] = (await getDoc(page)).shapes;
  expect(s).toMatchObject({ type: "rect", callout: 1, note: "Check this" });
  near(s.x, 40, "x back");
  near(s.w, 100, "w back");
  await expect.poll(async () => isRed(await pixel(page, 65, 30))).toBe(true); // the top edge
  expect(await pixel(page, 65, 45)).toEqual(under); // no line left inside

  // Undo goes back to the line, then the rectangle; redo again.
  await page.keyboard.press("Control+z");
  expect((await getDoc(page)).shapes[0].type).toBe("line");
  await page.keyboard.press("Control+z");
  expect((await getDoc(page)).shapes[0].type).toBe("rect");
  await page.keyboard.press("Control+y");
  expect((await getDoc(page)).shapes[0].type).toBe("line");
});

test("7.1: a selected line has a handle at each end; dragging one changes the angle; undo puts it back", async ({ page }) => {
  await page.keyboard.press("r");
  await drag(page, [60, 60], [260, 160]);
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Type of callout 1" }).selectOption("line");
  // Select it on its stroke.
  const mid = await toPage(page, 160, 110);
  await page.mouse.click(mid.x, mid.y);

  // Drag the far end from (260, 160) down to (260, 260).
  const end = await toPage(page, 260, 160);
  const to = await toPage(page, 260, 260);
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(end.x, (end.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();

  let [s] = (await getDoc(page)).shapes;
  expect(s.type).toBe("line");
  let [a, b] = ends(s);
  near(a.x, 60, "start x stays");
  near(a.y, 60, "start y stays");
  near(b.x, 260, "end x");
  near(b.y, 260, "end y moved");

  // Drag the start end too.
  const start = await toPage(page, 60, 60);
  const to2 = await toPage(page, 60, 200);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to2.x, to2.y, { steps: 6 });
  await page.mouse.up();
  [s] = (await getDoc(page)).shapes;
  [a, b] = ends(s);
  near(a.y, 200, "start y moved");
  near(b.y, 260, "end y stays");

  await page.keyboard.press("Control+z");
  [s] = (await getDoc(page)).shapes;
  [a, b] = ends(s);
  near(a.y, 60, "undo: start back");
  near(b.y, 260, "undo: end stays");
});
