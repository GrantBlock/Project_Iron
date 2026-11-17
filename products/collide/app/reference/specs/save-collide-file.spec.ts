import { expect, test } from "../fixture";
import { openMarkdown, openSnip, tool, addSnip } from "../helpers";

// Seed: ../../../prototype-checks/save-collide-file.js
// Save as .collide from Snip and from Markdown.

test("Save as .collide works from Snip (two sources) and from Markdown", async ({ page, open, state, shots }) => {
  await open();
  const toast = page.getByRole("status");

  // Snip with a second image added beside the first: the file has both sources and every item.
  await openSnip(page);
  await addSnip(page);
  await expect(toast).toHaveText("Snip added beside the image · copied to clipboard");
  const items = (await state()).items;
  expect(items.filter((i) => i.type === "image")).toHaveLength(1);
  expect(items.filter((i) => i.number !== null)).toHaveLength(4);

  await tool(page, "Save as .collide").click();
  await expect(toast).toHaveText(/^Saved line-3-conveyor-guard\.collide · 2 sources and 5 items/);
  await shots("saved-from-snip");

  // Markdown: the .md file and its items.
  await openMarkdown(page);
  const md = (await state()).items;
  await tool(page, "Save as .collide").click();
  await expect(toast).toHaveText(new RegExp(`^Saved P06-Project-Workspace-Spec\\.collide · the \\.md file with ${md.length} items`));
});
