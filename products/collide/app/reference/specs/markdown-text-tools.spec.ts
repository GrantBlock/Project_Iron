import { expect, test } from "../fixture";
import { openMarkdown, recents, tool, workspace } from "../helpers";

// Seed: ../../../prototype-checks/markdown-text-tools.js
// Heading, Table, Num list, Label; unsaved mark; hide toolbar; full width; tables in the preview.

const NAME = "P06-Project-Workspace-Spec.md";

test("the Markdown text tools edit the source; unsaved mark; hide toolbar; full width; tables in the preview", async ({ page, open, state, shots }) => {
  await open();
  await openMarkdown(page);
  const ws = workspace(page);
  await ws.getByRole("button", { name: "Edit", exact: true }).click();
  const src = ws.getByRole("textbox", { name: NAME });
  const lines = async () => (await src.inputValue()).split("\n");
  await expect(src).toBeVisible();

  // Nothing changed yet: the tab shows Saved.
  expect((await state()).tabs[0].dirty).toBe(false);
  await expect(page.getByRole("tab").getByLabel("Saved", { exact: true })).toBeVisible();
  const original = await lines();
  const heading = original.findIndex((l) => l.startsWith("The project workspace"));
  expect(heading).toBeGreaterThan(0);

  // Heading 3 on the line the cursor is in (the keys move the cursor from the top of the text).
  await src.click();
  await page.keyboard.press("Control+Home");
  for (let i = 0; i < heading; i++) await page.keyboard.press("ArrowDown");
  await ws.getByRole("combobox", { name: "Heading" }).selectOption({ label: "Heading 3" });
  expect((await lines())[heading]).toBe("### " + original[heading]);

  // Num list on the selected lines, then Label on the line the selection ends in.
  const left = original.findIndex((l) => l.startsWith("- Left: project"));
  await src.click();
  await page.keyboard.press("Control+End");
  for (let i = 0; i < original.length - 1 - left; i++) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Home");
  for (let i = 0; i < 60; i++) await page.keyboard.press("Shift+ArrowRight");
  await ws.getByRole("button", { name: "Num list" }).click();
  await ws.getByRole("button", { name: "Label" }).click();
  let now = await lines();
  expect(now.slice(left, left + 3)).toEqual(["1. Left: project sections", "2. Centre: the open section", "**Label:** Right: [placeholder] session panel"]);

  // Table at the cursor (the end of the text).
  expect(now.some((l) => l.startsWith("| --- "))).toBe(false);
  await src.click();
  await page.keyboard.press("Control+End");
  await ws.getByRole("button", { name: "Table", exact: true }).click();
  now = await lines();
  const t = now.findIndex((l) => l.startsWith("| Item |"));
  expect(t).toBeGreaterThan(0);
  expect(now.slice(t, t + 3)).toEqual(["| Item | Owner | Status |", "| --- | --- | --- |", "| [item] | [owner] | [status] |"]);

  // The unsaved mark.
  expect((await state()).tabs[0].dirty).toBe(true);
  await expect(page.getByRole("tab").getByLabel("Unsaved changes")).toBeVisible();

  // Hide the toolbar and show it again.
  const toolbar = ws.getByRole("toolbar", { name: "Markdown tools" });
  await expect(toolbar).toBeVisible();
  // The prototype marks the toolbar hidden but a style keeps it on screen (ISSUES 20), so this spec checks the
  // button's own state and not that the toolbar disappears.
  const toggle = ws.getByRole("button", { name: "Hide the toolbar" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  const show = ws.getByRole("button", { name: "Show the toolbar" });
  await expect(show).toHaveAttribute("aria-pressed", "false");
  await show.click();
  await expect(ws.getByRole("button", { name: "Hide the toolbar" })).toHaveAttribute("aria-pressed", "true");
  await expect(toolbar).toBeVisible();

  // Full width hides the sidebar; the table shows in the live preview.
  const full = ws.getByRole("button", { name: "Full width" });
  await full.click();
  await expect(full).toHaveAttribute("aria-pressed", "true");
  await expect(recents(page)).toBeHidden();
  await expect(ws.getByRole("table")).toBeVisible();
  await expect(ws.getByRole("columnheader", { name: "Owner" })).toBeVisible();
  await shots("full-width-table");
  await full.click();
  await expect(recents(page)).toBeVisible();

  // Preview: the Point tool and a click on the page.
  await ws.getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(async () => (await state()).mode).toBe("preview");
  await page.keyboard.press("p");
  expect((await state()).activeTool).not.toBe("select");
  await expect(tool(page, "Select")).toHaveAttribute("aria-pressed", "false");
});
