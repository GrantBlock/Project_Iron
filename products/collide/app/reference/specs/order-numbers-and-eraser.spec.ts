import { expect, test } from "../fixture";
import { atStage, box, drag, openMarkdown, openSnip, recents, scribble, tool, workspace } from "../helpers";

// Seed: ../../../prototype-checks/order-numbers-and-eraser.js
// List front to back; pens, highlighters and images without numbers or bubbles;
// the eraser removes strokes only; reorder.

const ERASER = "Eraser: removes a whole pen or highlighter stroke";

test("front-to-back list; strokes and images have no number or bubble; the eraser removes strokes only; reorder", async ({ page, open, state, shots }) => {
  await open();
  await openSnip(page);
  const ws = workspace(page);
  const list = ws.getByRole("complementary", { name: "Callouts" });
  const summary = async () => (await state()).items.map((i) => `${i.type}:${i.number ?? "-"}`);

  const callouts = ["point:4", "rect:3", "ellipse:2", "rect:1"];
  expect(await summary()).toEqual(callouts);

  // A pen stroke and a highlighter stroke.
  const strokes = async () => {
    const [px, py] = await atStage(page, -20, 100);
    await tool(page, "Pen").click();
    await scribble(page, px, py, 10, 8, 10);
    const [hx, hy] = await atStage(page, -50, -20);
    await tool(page, "Highlighter").click();
    await drag(page, [hx, hy], [hx + 170, hy + 2], 6);
  };
  await strokes();
  expect(await summary()).toEqual(["hl:-", "pen:-", ...callouts]);
  let items = (await state()).items;
  for (const i of items.slice(0, 2)) {
    expect(i.number).toBeNull();
    expect(i.bubble).toBeNull();
  }
  expect(items[1].points).toBeGreaterThan(5);

  // The eraser takes whole strokes (the pen, then the highlighter) and nothing else.
  const [ex, ey] = await atStage(page, -10, 105);
  await tool(page, ERASER).click();
  // One stroke from the pen to the highlighter.
  await drag(page, [ex, ey], [ex + 30, ey - 124], 8);
  expect(await summary()).toEqual(callouts);
  await tool(page, "Select").click();

  // Again, then Add snip: the image comes in front, also without a number or a bubble.
  await strokes();
  await recents(page).getByRole("button", { name: "Add snip", exact: true }).click();
  await expect.poll(async () => (await state()).items.some((i) => i.type === "image")).toBe(true);
  expect(await summary()).toEqual(["image:-", "hl:-", "pen:-", ...callouts]);
  items = (await state()).items;
  expect(items[0].bubble).toBeNull();
  // The list beside the canvas shows the same order, front to back; only callouts have numbers.
  await expect(list.getByText("no number", { exact: false })).toHaveCount(3);
  await expect(list.getByRole("combobox", { name: /^Type of callout/ })).toHaveCount(4);
  await shots("list-front-to-back");

  // Reorder: drag the last card (callout 1, the back one) to the front. Numbers count from the back, so they shift.
  const labels = async () => await list.locator("[aria-label^=Reorder]").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")));
  expect(await labels()).toEqual(["Reorder Image", "Reorder Highlighter", "Reorder Pen", "Reorder callout 4", "Reorder callout 3", "Reorder callout 2", "Reorder callout 1"]);
  const grip = list.locator("[aria-label^=Reorder]");
  await grip.last().dragTo(grip.first());
  expect(await summary()).toEqual(["rect:4", "image:-", "hl:-", "pen:-", "point:3", "rect:2", "ellipse:1"]);

  // Markdown: a pen stroke on the page has no number or bubble; the eraser takes it.
  await openMarkdown(page);
  const before = (await state()).items.length;
  const h1 = await box(ws.getByRole("heading", { level: 1 }));
  await page.keyboard.press("n");
  await scribble(page, h1.x + 75, h1.y + 100, 8, 10, 6);
  items = (await state()).items;
  expect(items).toHaveLength(before + 1);
  expect(items[0]).toMatchObject({ type: "pen", number: null, bubble: null });
  await page.keyboard.press("e");
  expect((await state()).activeTool).toBe("eraser");
  await drag(page, [h1.x + 105, h1.y + 98], [h1.x + 125, h1.y + 106], 5);
  expect((await state()).items).toHaveLength(before);
  expect((await state()).items.every((i) => i.type !== "pen")).toBe(true);
});
