import { expect, test } from "../fixture";
import { atStage, drag, openMarkdown, openSnip, workspace } from "../helpers";

// Seed: ../../../prototype-checks/esc-returns-to-select.js
// Esc returns to Select in both editors, also from a note box.

test("Esc returns to Select in Snip and in Markdown, also from a note box", async ({ page, open, state, shots }) => {
  await open();
  await openSnip(page);

  // Snip: a tool key picks the tool, Esc goes back to Select.
  await page.keyboard.press("r");
  expect((await state()).activeTool).toBe("rect");
  await page.keyboard.press("Escape");
  expect((await state()).activeTool).toBe("select");

  // Draw a line: the new callout's note box has the cursor. Esc leaves the box and returns to Select.
  await page.keyboard.press("l");
  expect((await state()).activeTool).toBe("line");
  const [x, y] = await atStage(page, -50, -20);
  await drag(page, [x, y], [x + 100, y + 50], 3);
  await page.keyboard.type("note");
  const note = workspace(page).getByRole("textbox", { name: /^Note for callout/ }).first();
  await expect(note).toBeFocused();
  await expect(note).toHaveValue("note");
  await page.keyboard.press("Escape");
  await expect(note).not.toBeFocused();
  const s = await state();
  expect(s.activeTool).toBe("select");
  expect(s.items.some((i) => i.type === "line" && i.note === "note")).toBe(true);
  await shots("snip-after-esc");

  // Markdown Preview: same.
  await openMarkdown(page);
  expect((await state()).mode).toBe("preview");
  await page.keyboard.press("c");
  expect((await state()).activeTool).not.toBe("select");
  await page.keyboard.press("Escape");
  expect((await state()).activeTool).toBe("select");
  await expect(workspace(page).getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
});
