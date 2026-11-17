import { expect, test } from "../fixture";
import { atStage, drag, openSnip, snipImage, tool } from "../helpers";

// Seed: ../../../prototype-checks/print-area-and-bubble-stacking.js
// Bubbles stack beside each other; a dropped bubble snaps beside another;
// Copy takes the print area with a tight margin.

const NOTES = ["Stack A note for the bubble", "Stack B note for the bubble", "Stack C note for the bubble"];

type Bubble = { x: number; y: number; w: number; h: number };
const overlap = (a: Bubble, b: Bubble) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("bubbles stack without overlapping, a dropped bubble snaps beside another, Copy takes the print area", async ({ page, open, state, shots }) => {
  await open();
  await openSnip(page);
  const img = snipImage(page);
  const first = (await state()).items.length; // the snip's own items

  // Three small rectangles close together, so their note bubbles want the same place.
  const at: [number, number][] = [[-20, -40], [30, -20], [0, 0]];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("r");
    const [x, y] = await atStage(page, at[i][0], at[i][1]);
    await drag(page, [x, y], [x + 20, y + 14], 3);
    await page.keyboard.type(NOTES[i]);
    await page.keyboard.press("Escape");
  }
  await page.keyboard.press("Control+0");
  await expect.poll(async () => (await state()).zoom?.fit).toBe(true);

  // The three new callouts are numbered after the existing ones; no two bubbles overlap; none was dragged.
  let items = (await state()).items;
  expect(items).toHaveLength(first + 3);
  const num = (n: number) => items.find((i) => i.number === n)!;
  const [a, b, c] = [num(first + 1), num(first + 2), num(first + 3)];
  expect([a.note, b.note, c.note]).toEqual(NOTES);
  const bubbles = items.filter((i) => i.bubble && !i.hidden.bubble).map((i) => i.bubble!);
  for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) expect(overlap(bubbles[i], bubbles[j]), `bubbles ${i} and ${j} overlap`).toBe(false);
  for (const n of [a, b, c]) expect(n.bubble!.moved).toBe(false);
  await shots("stacked-bubbles");

  // Screen position of two bubbles' text and their image positions give the scale; drag bubble b to just right of bubble a.
  const ta = await img.getByText(new RegExp(`^${NOTES[0].slice(0, 12)}`)).boundingBox();
  const tb = await img.getByText(new RegExp(`^${NOTES[1].slice(0, 12)}`)).boundingBox();
  expect(ta && tb).toBeTruthy();
  const k = (tb!.x - ta!.x) / (b.bubble!.x - a.bubble!.x);
  expect(k).toBeGreaterThan(0);
  const GAP = 6;
  const dx = (a.bubble!.x + a.bubble!.w + GAP - b.bubble!.x) * k;
  const dy = (a.bubble!.y - b.bubble!.y) * k;
  // Drop it a few pixels off: it snaps.
  await drag(page, [tb!.x + 10, tb!.y + 7], [tb!.x + 10 + dx + 8, tb!.y + 7 + dy + 4], 6);

  items = (await state()).items;
  const na = items.find((i) => i.number === first + 1)!.bubble!;
  const nb = items.find((i) => i.number === first + 2)!.bubble!;
  expect(nb.moved).toBe(true);
  expect(na.moved).toBe(false);
  expect(Math.abs(nb.x - (na.x + na.w + GAP))).toBeLessThanOrEqual(1);
  expect(Math.abs(nb.y - na.y)).toBeLessThanOrEqual(1);
  await shots("snapped-bubble");

  // Copy takes the print area; the frame on the canvas and the toast give the same size.
  const frame = await img.getByText(/^Print area · \d+ × \d+$/).textContent();
  const size = frame!.replace("Print area · ", "");
  await tool(page, "Copy to clipboard").click();
  await expect(page.getByRole("status")).toHaveText(`Copied the print area · ${size} with note boxes`);
});
