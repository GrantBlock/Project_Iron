import { expect, test } from "../fixture";
import { box, drag, openMarkdown, workspace } from "../helpers";

// Seed: ../../../prototype-checks/markdown-zoom.js
// Ctrl + wheel zooms around the cursor; drawing still lines up; Ctrl+0 fits.

test("Ctrl + wheel zooms around the cursor, drawing still lines up, Ctrl+0 fits", async ({ page, open, state, shots }) => {
  await open();
  await openMarkdown(page);
  const ws = workspace(page);

  const start = (await state()).zoom!;
  expect(start.fit).toBe(true);
  await expect(ws.getByText(`${start.percent}% · fit`, { exact: true })).toBeVisible(); // the status bar

  // A point on the page, a bit in from its left and down from the heading.
  const h1 = await box(ws.getByRole("heading", { level: 1 }));
  const tx = h1.x + h1.width * 0.3;
  const ty = h1.y + 150;

  // Mark that point before the zoom: a small rectangle drawn there tells which page pixel it is.
  await page.keyboard.press("r");
  await drag(page, [tx, ty], [tx + 40, ty + 20], 3);
  const first = (await state()).items.find((i) => i.type === "rect" && Math.abs(i.w - 40 / (start.percent / 100)) < 4)!;
  expect(first).toBeTruthy();
  await page.keyboard.press("Escape");

  // Ctrl + wheel up, five notches, with the cursor on that point.
  await page.mouse.move(tx, ty);
  await page.keyboard.down("Control");
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(60);
  }
  await page.keyboard.up("Control");
  await expect.poll(async () => (await state()).zoom!.percent).toBeGreaterThan(start.percent);
  const zoomed = (await state()).zoom!;
  expect(zoomed.fit).toBe(false);
  await expect(ws.getByText(`${zoomed.percent}%`, { exact: true })).toBeVisible();

  // The page pixel under the cursor is still the same one: a rectangle started at the same screen point
  // begins at the same page pixel as the first one (within 2 px).
  await page.keyboard.press("r");
  await drag(page, [tx, ty], [tx + 80, ty + 40], 3);
  const second = (await state()).items[0];
  expect(second.type).toBe("rect");
  expect(second.id).not.toBe(first.id);
  expect(Math.abs(second.x - first.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(2);
  // And the drag length matches the zoom: 80 screen px is 80 / scale page px.
  expect(Math.abs(second.w - 80 / (zoomed.percent / 100))).toBeLessThanOrEqual(3);
  await shots("zoomed-in");

  // Ctrl+0 fits the page again.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+0");
  await expect.poll(async () => (await state()).zoom).toEqual(start);
  await expect(ws.getByText(`${start.percent}% · fit`, { exact: true })).toBeVisible();
});
