import { expect, test } from "../fixture";
import { atStage, drag, openSnip, tool, workspace } from "../helpers";

// Seed: ../../../prototype-checks/callout-numbering.js
// A new callout takes the next number; the existing numbers stay.

test("a new callout takes the next number and the existing numbers stay", async ({ page, open, state, shots }) => {
  await open();
  await openSnip(page);

  const before = (await state()).items.filter((i) => i.number !== null);
  expect(before.map((i) => i.number).sort()).toEqual([1, 2, 3, 4]);
  const notes = Object.fromEntries(before.map((i) => [i.number, i.note]));

  await tool(page, "Rectangle").click();
  const [x, y] = await atStage(page, -40, 20);
  await drag(page, [x, y], [x + 50, y + 40], 3);
  await page.keyboard.type("new one");

  const after = (await state()).items.filter((i) => i.number !== null);
  expect(after).toHaveLength(5);
  // The new callout is number 5 and is the front-most; 1 to 4 keep their numbers and notes.
  const added = after.find((i) => i.number === 5)!;
  expect(added.type).toBe("rect");
  expect(added.note).toBe("new one");
  for (const n of [1, 2, 3, 4]) expect(after.find((i) => i.number === n)!.note).toBe(notes[n]);
  await expect(workspace(page).getByRole("textbox", { name: "Note for callout 5" })).toHaveValue("new one");
  await shots("fifth-callout");
});
