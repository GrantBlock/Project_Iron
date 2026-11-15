import { expect, test } from "../fixture";
import { openMarkdown, openSnip, recents, tool, workspace } from "../helpers";

// Seed: ../../../prototype-checks/click-outside-returns-to-select.js
// A click outside the canvas or page (not on the toolbar) goes back to Select and still lands.

test("a click outside the canvas or page returns to Select and still lands", async ({ page, open, state, shots }) => {
  await open();
  await openSnip(page);
  const callouts = workspace(page).getByRole("complementary", { name: "Callouts" });

  // Snip: Rectangle and a colour are picked; a click on the Callouts list goes to Select and selects that callout.
  await tool(page, "Rectangle").click();
  await tool(page, "Blue").click();
  await expect(tool(page, "Rectangle")).toHaveAttribute("aria-pressed", "true");
  expect((await state()).activeTool).toBe("rect");
  await callouts.getByText("2", { exact: true }).click();
  await expect(tool(page, "Select")).toHaveAttribute("aria-pressed", "true");
  await expect(tool(page, "Rectangle")).toHaveAttribute("aria-pressed", "false");
  let s = await state();
  expect(s.activeTool).toBe("select");
  expect(s.selection).toEqual([s.items.find((i) => i.number === 2)!.id]);

  // Ellipse, then a click in Recents opens the other snip with Select.
  await tool(page, "Ellipse").click();
  expect((await state()).activeTool).toBe("ellipse");
  await recents(page).getByRole("button", { name: /^HMI header grid/ }).click();
  await expect.poll(async () => (await state()).tabs.find((t) => t.active)?.title).toBe("HMI header grid");
  s = await state();
  expect(s.activeTool).toBe("select");
  expect(s.tabs).toHaveLength(2);

  // Markdown Preview: Line and a colour are picked; a click in a callout note goes to Select and the note takes the cursor.
  await openMarkdown(page);
  expect((await state()).mode).toBe("preview");
  await tool(page, "Line").click();
  await tool(page, "Yellow").click();
  expect((await state()).activeTool).toBe("line");
  const note = callouts.getByRole("textbox", { name: "Note for callout 1" });
  await note.click();
  await expect(note).toBeFocused();
  await expect(tool(page, "Select")).toHaveAttribute("aria-pressed", "true");
  expect((await state()).activeTool).toBe("select");
  await shots("note-focused");
});
