import { expect, test } from "../fixture";
import { box, drag, openMarkdown, scribble, tool, workspace } from "../helpers";

// Seed: ../../../prototype-checks/markdown-margin-drawing.js
// Shapes and strokes can start in the margin beside the page.

test("a shape or a stroke can start in the margin beside the Markdown page", async ({ page, open, state, shots }) => {
  await open();
  await openMarkdown(page);
  const ws = workspace(page);

  // The margin: between the left edge of the work area and the page's text (the page is centred in the area).
  const h1 = await box(ws.getByRole("heading", { level: 1 }));
  const area = await box(ws.getByRole("toolbar"));
  const marginX = (area.x + h1.x) / 2;
  expect(marginX).toBeLessThan(h1.x - 40);
  const top = h1.y;

  const before = (await state()).items;
  expect(before.length).toBeGreaterThan(0);
  const added = async () => (await state()).items.filter((i) => !before.some((b) => b.id === i.id));

  // A rectangle that starts left of the page and ends on it.
  await page.keyboard.press("r");
  await drag(page, [marginX, top + 300], [h1.x + 60, top + 360], 4);
  let items = await added();
  expect(items).toHaveLength(1);
  expect(items[0].type).toBe("rect");
  expect(items[0].x).toBeLessThan(0); // page pixels: negative = left of the page
  expect(items[0].x + items[0].w).toBeGreaterThan(0);
  await shots("rect-from-margin");

  // A pen stroke that starts in the margin.
  await page.keyboard.press("Escape");
  await page.keyboard.press("n");
  expect((await state()).activeTool).toBe("pen");
  await scribble(page, marginX, top + 480, 6, 12, 6);
  items = await added();
  expect(items.map((i) => i.type)).toEqual(["pen", "rect"]); // front to back: the new stroke is in front
  expect(items[0].x).toBeLessThan(0);
  expect(items[0].points).toBeGreaterThan(2);

  // Select on the margin does nothing harmful.
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  const count = (await state()).items.length;
  await page.mouse.click(marginX, top + 200);
  const s = await state();
  expect(s.items).toHaveLength(count);
  expect(s.selection).toEqual([]);
  expect(s.activeTool).toBe("select");
  await expect(tool(page, "Select")).toHaveAttribute("aria-pressed", "true");
});
