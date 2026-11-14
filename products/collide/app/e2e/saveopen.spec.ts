import { expect, test } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";

test("save, reload, open: doc and image identical and still editable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);

  // Draw rect + ellipse + callout by hand, plus seeded shapes with notes.
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const at = async (key: string, a: [number, number], b: [number, number]) => {
    await page.keyboard.press(key);
    await page.mouse.move(box.x + a[0], box.y + a[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + b[0], box.y + b[1], { steps: 5 });
    await page.mouse.up();
  };
  await at("r", [300, 200], [380, 250]);
  await at("o", [420, 220], [500, 280]);
  await page.keyboard.press("c");
  await page.mouse.click(box.x + 150, box.y + 300);
  await page.evaluate(() => {
    window.__collide!.seedShape({ x: 40, y: 30, w: 140, h: 80 });
    window.__collide!.seedShape({ x: 220, y: 150, w: 120, h: 90 });
  });
  await page.getByTestId("callout-note").first().fill("Button misaligned");
  await page.getByTestId("callout-note").first().blur();

  const saved = await page.evaluate(() => window.__collide!.getDoc());
  expect(saved!.shapes.length).toBeGreaterThanOrEqual(4);
  await page.getByTestId("save-markup").click();
  await expect(page.getByTestId("notice")).toContainText("Markup saved");

  await page.reload();
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
  expect(await page.evaluate(() => window.__collide!.getDoc())).toBeNull();

  await page.getByTestId("open-markup").click();
  await expect(page.getByTestId("notice")).toContainText("Markup opened");
  const state = await page.evaluate(() => ({ doc: window.__collide!.getDoc(), s: window.__collide!.getState() }));
  expect(state.doc).toEqual(saved);
  expect(state.s.image).toMatchObject({ width: 400, height: 300 });

  // Fully editable: select, move, undo.
  const id = saved!.shapes[saved!.shapes.length - 1].id;
  const before = state.s.shapes.find((s) => s.id === id)!;
  const p = await page.evaluate((i) => {
    const h = window.__collide!;
    const s = h.getState();
    const sh = s.shapes.find((x) => x.id === i)!;
    const o = s.stage!;
    return { x: o.x + (sh.x + sh.w / 2) * o.scale, y: o.y + (sh.y + sh.h / 2) * o.scale };
  }, id);
  await page.keyboard.press("v");
  await page.mouse.move(box.x + p.x, box.y + p.y);
  await page.mouse.down();
  await page.mouse.move(box.x + p.x + 40, box.y + p.y + 30, { steps: 5 });
  await page.mouse.up();
  const moved = (await page.evaluate(() => window.__collide!.getState())).shapes.find((s) => s.id === id)!;
  expect(moved.x).not.toBe(before.x);
  expect((await page.evaluate(() => window.__collide!.getState())).selectedId).toBe(id);
  await page.keyboard.press("Control+z");
  const undone = (await page.evaluate(() => window.__collide!.getState())).shapes.find((s) => s.id === id)!;
  expect(undone.x).toBe(before.x);
  expect(undone.y).toBe(before.y);
});
