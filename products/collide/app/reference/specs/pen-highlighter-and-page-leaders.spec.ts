import { expect, test } from "../fixture";
import { atStage, box, drag, openMarkdown, openSnip, tool, workspace } from "../helpers";

// Seed: ../../../prototype-checks/pen-highlighter-and-page-leaders.js
// Pen and Highlighter strokes; resizing a stroke; Markdown bubbles, leaders and cards; Export from the page.

test("pen and highlighter strokes, resizing a stroke, page bubbles and cards, Export from the page", async ({ page, open, state, shots }) => {
  await open();
  await openSnip(page);
  const ws = workspace(page);
  const list = ws.getByRole("complementary", { name: "Callouts" });

  // A pen stroke (12 points on a wave) and a highlighter stroke.
  const [px, py] = await atStage(page, -60, 60);
  const pts: [number, number][] = [[px, py]];
  for (let i = 1; i <= 12; i++) pts.push([px + i * 8, py + Math.sin(i / 2) * 15]);
  await tool(page, "Pen").click();
  await page.mouse.move(...pts[0]);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...p);
  await page.mouse.up();
  const [hx, hy] = await atStage(page, -70, -80);
  await tool(page, "Highlighter").click();
  await drag(page, [hx, hy], [hx + 180, hy + 2], 8);

  let items = (await state()).items;
  expect(items.slice(0, 2).map((i) => i.type)).toEqual(["hl", "pen"]);
  expect(items.slice(0, 2).every((i) => i.number === null && i.bubble === null)).toBe(true);
  expect(items[1].points).toBe(13);
  expect(items[0].points).toBeGreaterThan(1);

  // Select the pen stroke from the list; its handles show. Drag the bottom-right corner handle outward.
  await tool(page, "Select").click();
  await list.getByText("Pen", { exact: true }).click();
  const pen0 = (await state()).items.find((i) => i.type === "pen")!;
  expect((await state()).selection).toEqual([pen0.id]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const corner: [number, number] = [Math.max(...xs), Math.max(...ys)];
  const k = (Math.max(...xs) - Math.min(...xs)) / pen0.w; // screen px per image px
  await drag(page, corner, [corner[0] + 60, corner[1] + 40], 4);
  const pen1 = (await state()).items.find((i) => i.type === "pen")!;
  expect(pen1.id).toBe(pen0.id);
  expect(pen1.points).toBe(13);
  expect(pen1.x).toBeCloseTo(pen0.x, 0); // the opposite corner stays
  expect(pen1.y).toBeCloseTo(pen0.y, 0);
  expect(pen1.w).toBeGreaterThan(pen0.w + 30 / k);
  expect(pen1.h).toBeGreaterThan(pen0.h + 20 / k);
  await shots("pen-resized");

  // Markdown: the page has callouts with bubbles and cards.
  await openMarkdown(page);
  const doc0 = (await state()).items;
  expect(doc0.filter((i) => i.bubble).length).toBe(2);
  await expect(list.getByRole("textbox", { name: /^Note for callout/ })).toHaveCount(2);
  await expect(list.getByRole("button", { name: /^Hide the note text/ })).toHaveCount(2);
  const noteOf = (n: number) => doc0.find((i) => i.number === n)!.note;

  // A pen stroke on the page is in the list but is no callout.
  const h1 = await box(ws.getByRole("heading", { level: 1 }));
  await page.keyboard.press("n");
  await page.mouse.move(h1.x + 75, h1.y + 380);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(h1.x + 75 + i * 12, h1.y + 380 + (i % 2) * 8);
  await page.mouse.up();
  await page.keyboard.press("Escape");
  let md = (await state()).items;
  expect(md.map((i) => i.type)).toEqual(["pen", "ellipse", "rect"]);
  expect(md[0]).toMatchObject({ number: null, bubble: null });

  // Drag the bubble of callout 1 down by its text: it stays where it was dropped.
  expect(md.find((i) => i.number === 1)!.bubble!.moved).toBe(false);
  const text = await box(ws.getByText(noteOf(1).slice(0, 12)).first());
  await drag(page, [text.x + 8, text.y + 6], [text.x + 8, text.y + 60], 4);
  md = (await state()).items;
  expect(md.find((i) => i.number === 1)!.bubble!.moved).toBe(true);
  expect(md.find((i) => i.number === 1)!.bubble!.y).toBeGreaterThan(doc0.find((i) => i.number === 1)!.bubble!.y);

  // A card can hide its note text (the first card with that button is callout 2).
  await list.getByRole("button", { name: /^Hide the note text/ }).first().click();
  md = (await state()).items;
  expect(md.find((i) => i.number === 2)!.hidden.text).toBe(true);
  expect(md.find((i) => i.number === 1)!.hidden.text).toBe(false);
  await shots("page-leaders");

  // Export saves the visible page with its callouts.
  await ws.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/^Saved to .*Markups\/.* · \d+ × \d+ · copied to clipboard$/);
});
