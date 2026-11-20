// T46 (Run 4, items 2.1 and 3.1 to 3.4) in the browser build: an added snip is the same size as the original on screen;
// the list shows the first snip as "image 1" (Crop, no delete) and each added image as its own entry with Crop; every
// callout has a delete that acts at once (no confirmation) and Undo brings it back with its original number.
import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";
const list = (page: Page) => page.getByLabel("Callouts");

/** Paste a w x h blue PNG. Resolves to whether the app took the paste. */
const pasteImage = (page: Page, w: number, h: number) =>
  page.evaluate(
    async ([w, h]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d")!;
      x.fillStyle = "#1E88E5";
      x.fillRect(0, 0, w, h);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob!], "p.png", { type: "image/png" }));
      const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      return ev.defaultPrevented;
    },
    [w, h],
  );

const stage = (page: Page) => page.evaluate(() => window.__collide!.getState().stage!);
async function settled(page: Page) {
  await expect.poll(async () => {
    const a = JSON.stringify(await stage(page));
    await page.waitForTimeout(80);
    return a === JSON.stringify(await stage(page));
  }).toBe(true);
  return stage(page);
}

/** On screen (CSS px): the length of the blue run through the canvas, across at image row `iy` or down at image column `ix`. */
async function blueRun(page: Page, along: "x" | "y", at: number) {
  const st = await settled(page);
  return page.evaluate(
    ([along, at, st]) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="canvas"] canvas')!;
      const r = c.getBoundingClientRect();
      const k = c.width / r.width;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      const blue = (px: number, py: number) => {
        const i = (py * c.width + px) * 4;
        return Math.abs(d[i] - 0x1e) < 6 && Math.abs(d[i + 1] - 0x88) < 6 && Math.abs(d[i + 2] - 0xe5) < 6;
      };
      let n = 0;
      if (along === "x") {
        const py = Math.round((st.y + (at as number) * st.scale) * k);
        for (let px = 0; px < c.width; px++) if (blue(px, py)) n++;
      } else {
        const px = Math.round((st.x + (at as number) * st.scale) * k);
        for (let py = 0; py < c.height; py++) if (blue(px, py)) n++;
      }
      return n / k;
    },
    [along, at, st] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
});

test("2.1: an added snip is the same size as the original, measured on screen", async ({ page }) => {
  // A picture the size of the 400 x 300 original: on screen it is exactly as large as the original.
  expect(await pasteImage(page, 400, 300)).toBe(true);
  const st = await settled(page);
  const original = { w: 400 * st.scale, h: 300 * st.scale };
  expect(await blueRun(page, "x", 150)).toBeCloseTo(original.w, -0.5);
  expect(await blueRun(page, "y", 424 + 200)).toBeCloseTo(original.h, -0.5);
  // A smaller one keeps its own size at the same scale (not stretched to the original's height).
  expect(await pasteImage(page, 160, 100)).toBe(true);
  await expect.poll(async () => (await page.evaluate(() => window.__collide!.getDoc()))!.shapes.length).toBe(2);
  const shapes = (await page.evaluate(() => window.__collide!.getDoc()))!.shapes;
  expect(shapes[1]).toMatchObject({ type: "image", y: 0, w: 160, h: 100 });
  const st2 = await settled(page);
  expect(await blueRun(page, "y", shapes[1].x + 80)).toBeCloseTo(100 * st2.scale, -0.5);
});

test("3.1, 3.2 and 3.4: image 1 has Crop and no delete; each added image is its own entry with Crop", async ({ page }) => {
  const base = list(page).getByTestId("base-image-row");
  await expect(base).toContainText("image 1");
  await expect(base.getByRole("button", { name: "Crop image 1" })).toBeVisible();
  await expect(base.getByRole("button", { name: /delete/i })).toHaveCount(0);

  expect(await pasteImage(page, 320, 200)).toBe(true);
  await expect(list(page).getByTestId("image-row")).toHaveCount(2);
  expect(await pasteImage(page, 320, 200)).toBe(true);
  const rows = list(page).getByTestId("image-row");
  await expect(rows).toHaveCount(3);
  // Front to back: the newest first, the first snip last.
  await expect(rows.nth(0)).toContainText("image 3");
  await expect(rows.nth(1)).toContainText("image 2");
  await expect(rows.nth(2)).toContainText("image 1");
  for (const n of [1, 2, 3]) await expect(list(page).getByRole("button", { name: `Crop image ${n}`, exact: true })).toBeVisible();
  await expect(list(page).getByRole("button", { name: /^Delete image/ })).toHaveCount(2);

  // Crop on an added image's entry opens Crop for it.
  await list(page).getByRole("button", { name: "Crop image 2", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Crop image" })).toBeVisible();
  await expect(page.getByTestId("crop-size")).toHaveText("320 × 200 of 320 × 200");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Crop image" })).toBeHidden();
});

test("3.4: Crop on image 1 crops the first snip; the callouts stay on what they mark; Undo restores it", async ({ page }) => {
  const id = await page.evaluate(() => window.__collide!.seedShape({ x: 150, y: 120, w: 40, h: 30 }));
  await list(page).getByRole("button", { name: "Crop image 1" }).click();
  await expect(page.getByRole("dialog", { name: "Crop image" })).toBeVisible();
  await expect(page.getByTestId("crop-size")).toHaveText("400 × 300 of 400 × 300");
  // Drag the top-left corner to (25 %, 20 %) and the bottom-right corner to (75 %, 70 %) of the picture.
  const b = (await page.getByTestId("crop-stage").boundingBox())!;
  const corner = async (from: [number, number], to: [number, number]) => {
    await page.mouse.move(b.x + from[0], b.y + from[1]);
    await page.mouse.down();
    await page.mouse.move(b.x + to[0], b.y + to[1], { steps: 4 });
    await page.mouse.up();
  };
  await corner([3, 3], [b.width * 0.25, b.height * 0.2]);
  await corner([b.width - 3, b.height - 3], [b.width * 0.75, b.height * 0.7]);
  await expect(page.getByTestId("crop-size")).toHaveText(/^\d+ × \d+ of 400 × 300$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Crop image" })).toBeHidden();

  const st = await page.evaluate(() => window.__collide!.getState());
  expect(st.image!.width).toBeGreaterThan(190);
  expect(st.image!.width).toBeLessThan(210);
  expect(st.image!.height).toBeGreaterThan(140);
  expect(st.image!.height).toBeLessThan(160);
  const doc = (await page.evaluate(() => window.__collide!.getDoc()))!;
  expect(doc.source).toMatchObject({ width: 400, height: 300 });
  const crop = (doc.source as { crop?: { x: number; y: number } }).crop!;
  const moved = doc.shapes.find((s) => s.id === id)!;
  expect(moved.x).toBeCloseTo(150 - crop.x * 400, 0);
  expect(moved.y).toBeCloseTo(120 - crop.y * 300, 0);
  await expect(list(page).getByTestId("base-image-row").getByRole("button", { name: "Crop image 1" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Undo" }).click();
  expect((await page.evaluate(() => window.__collide!.getState())).image).toMatchObject({ width: 400, height: 300 });
  expect((await page.evaluate(() => window.__collide!.getDoc()))!.shapes.find((s) => s.id === id)).toMatchObject({ x: 150, y: 120 });
});

test("3.3: every callout has a delete that acts at once, no confirmation; Undo restores its original number", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    void d.dismiss();
  });
  for (const x of [40, 120, 200]) await page.evaluate((x) => window.__collide!.seedShape({ x, y: 60, w: 50, h: 40 }), x);
  const rows = page.getByTestId("callout-row");
  await expect(rows).toHaveCount(3);
  await list(page).getByRole("textbox", { name: "Note for callout 2" }).fill("second");
  await list(page).getByRole("textbox", { name: "Note for callout 2" }).blur();
  await expect(list(page).getByRole("button", { name: /^Delete callout \d$/ })).toHaveCount(3);

  await list(page).getByRole("button", { name: "Delete callout 2" }).click();
  await expect(rows).toHaveCount(2);
  expect(dialogs).toBe(0);
  await expect(page.getByTestId("crop-dialog")).toHaveCount(0);
  await expect(list(page).getByRole("textbox", { name: /^Note for callout/ })).toHaveCount(2);
  for (const n of ["1", "2"]) await expect(list(page).getByRole("textbox", { name: `Note for callout ${n}` })).toHaveValue("");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(rows).toHaveCount(3);
  await expect(list(page).getByRole("textbox", { name: "Note for callout 2" })).toHaveValue("second");
  const items = (await page.evaluate(() => window.__collide!.state())).items;
  expect(items.map((i) => i.number)).toEqual([3, 2, 1]);
});
