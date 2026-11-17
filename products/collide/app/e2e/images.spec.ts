// RUN3 T33: images on the canvas in the browser build. Paste places the image beside the base image (the canvas grows);
// it is selectable, moves, resizes from a corner with its aspect locked (Shift or not), deletes, undoes; Save and Open keep it.
import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";

/** Paste a 320 x 200 blue PNG into whatever has the focus. Resolves to whether the app took the paste. */
const pasteImage = (page: Page) =>
  page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 200;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1E88E5";
    x.fillRect(0, 0, 320, 200);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob!], "p.png", { type: "image/png" }));
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(ev);
    return ev.defaultPrevented;
  });

const doc = (page: Page) => page.evaluate(() => window.__collide!.getDoc());
const imageShape = async (page: Page) => (await doc(page))!.shapes.find((s) => s.type === "image") as { id: string; x: number; y: number; w: number; h: number; src: string } | undefined;

/** Screen point (page px) of an image-pixel point, once the view has settled. */
async function screen(page: Page, x: number, y: number): Promise<[number, number]> {
  const settled = async () => JSON.stringify((await page.evaluate(() => window.__collide!.getState().stage))!);
  await expect.poll(async () => {
    const a = await settled();
    await page.waitForTimeout(60);
    return a === (await settled());
  }).toBe(true);
  const st = (await page.evaluate(() => window.__collide!.getState().stage))!;
  const box = (await page.getByTestId("canvas").boundingBox())!;
  return [box.x + st.x + x * st.scale, box.y + st.y + y * st.scale];
}

/** The colour the canvas shows at an image-pixel point. */
async function colourAt(page: Page, x: number, y: number) {
  const [sx, sy] = await screen(page, x, y);
  return page.evaluate(
    ([px, py]) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="canvas"] canvas')!;
      const r = c.getBoundingClientRect();
      const k = c.width / r.width;
      return [...c.getContext("2d")!.getImageData(Math.round((px - r.left) * k), Math.round((py - r.top) * k), 1, 1).data].slice(0, 3);
    },
    [sx, sy],
  );
}

async function dragBy(page: Page, from: [number, number], dx: number, dy: number, shift = false) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.move(from[0] + dx / 2, from[1] + dy / 2, { steps: 4 });
  await page.mouse.move(from[0] + dx, from[1] + dy, { steps: 4 });
  await page.mouse.up();
  if (shift) await page.keyboard.up("Shift");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
});

test("paste with nothing open opens a new snip; a text paste is left alone", async ({ page }) => {
  expect(await pasteImage(page)).toBe(true);
  await expect(page.getByTestId("toast")).toHaveText("Pasted image opened as a new snip · 320 × 200");
  const s = await page.evaluate(() => window.__collide!.state());
  expect(s.view).toBe("snip");
  expect(s.tabs[0].title).toMatch(/^Pasted image \d+:\d\d$/);
  expect(s.items).toEqual([]);
  const text = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "hello");
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(text).toBe(false);
});

test("a pasted image goes beside the image, moves, resizes with its aspect locked, deletes and undoes", async ({ page }) => {
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  expect(await pasteImage(page)).toBe(true);
  await expect(page.getByTestId("toast")).toHaveText("Pasted image added beside the image · 320 × 200");

  // Beside the 400 x 300 image, 24 px to the right, as tall as it, aspect kept; selected; in the list without a number.
  const placed = (await imageShape(page))!;
  expect(placed).toMatchObject({ x: 424, y: 0, w: 480, h: 300, src: "image-1.png" });
  let s = await page.evaluate(() => window.__collide!.state());
  expect(s.selection).toEqual([placed.id]);
  expect(s.items[0]).toMatchObject({ type: "image", number: null, bubble: null });
  await expect(page.getByLabel("Callouts").getByText("Image", { exact: true })).toBeVisible();
  // The canvas grew: the fitted view shows both, and the picture is drawn there.
  expect(s.zoom?.fit).toBe(true);
  expect(await colourAt(page, 424 + 240, 150)).toEqual([0x1e, 0x88, 0xe5]);

  // Move it with Select.
  await dragBy(page, await screen(page, 424 + 240, 150), -40, 30);
  await expect.poll(async () => (await imageShape(page))!.x).not.toBe(424);
  const moved = (await imageShape(page))!;
  expect(moved.w).toBe(480);

  // Resize from the bottom-right corner, with Shift held: the aspect stays locked.
  const corner = await screen(page, moved.x + moved.w, moved.y + moved.h);
  await dragBy(page, [corner[0] + 2, corner[1] + 2], -120, -10, true);
  await expect.poll(async () => (await imageShape(page))!.w).toBeLessThan(480);
  const sized = (await imageShape(page))!;
  expect(sized.w / sized.h).toBeCloseTo(480 / 300, 2);
  // The top-left corner stays put (to float precision).
  expect(sized.x).toBeCloseTo(moved.x, 3);
  expect(sized.y).toBeCloseTo(moved.y, 3);

  // Undo the resize, then delete it, then undo the delete.
  await page.keyboard.press("Control+z");
  expect(await imageShape(page)).toMatchObject({ w: 480, h: 300 });
  await page.keyboard.press("Delete");
  expect(await imageShape(page)).toBeUndefined();
  await page.keyboard.press("Control+z");
  expect(await imageShape(page)).toMatchObject({ x: moved.x, y: moved.y, w: 480 });
  s = await page.evaluate(() => window.__collide!.state());
  expect(s.items.filter((i) => i.type === "image")).toHaveLength(1);
});

test("save and open keep the added image (annotations.json lists its file)", async ({ page }) => {
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  expect(await pasteImage(page)).toBe(true);
  await expect.poll(async () => !!(await imageShape(page))).toBe(true);
  await page.getByTestId("save-markup").click();
  await expect(page.getByTestId("notice")).toContainText("Markup saved");
  const saved = await doc(page);

  await page.reload();
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("open-markup").click();
  await expect(page.getByTestId("notice")).toContainText("Markup opened");
  expect(await doc(page)).toEqual({ ...saved, images: [{ file: "image-1.png", width: 320, height: 200 }] });
  await expect.poll(() => colourAt(page, 424 + 240, 150)).toEqual([0x1e, 0x88, 0xe5]);

  // Still an image item: select it from the list and delete it.
  await page.getByLabel("Callouts").getByText("Image", { exact: true }).click();
  await page.getByRole("button", { name: "Delete Image" }).click();
  expect(await imageShape(page)).toBeUndefined();
});
