import { expect, test } from "../fixture";
import { openSnip, pasteImage, pasteText, recents, workspace } from "../helpers";

// Seed: ../../../prototype-checks/paste-image.js
// Paste into Snip (beside the image), into Markdown Edit and Preview (saved to images/ and linked),
// with nothing open (a new snip); text paste untouched.

const NAME = "P06-Project-Workspace-Spec.md";

test("pasting an image: new snip, beside the image, into Markdown Edit and Preview; text paste untouched", async ({ page, open, state, shots }) => {
  await open();
  const ws = workspace(page);
  const toast = page.getByRole("status");

  // Nothing open: the pasted image opens as a new snip, the size of the image.
  expect(await pasteImage(page)).toBe(true);
  await expect(toast).toHaveText("Pasted image opened as a new snip · 320 × 200");
  let s = await state();
  expect(s.view).toBe("snip");
  expect(s.tabs).toHaveLength(1);
  expect(s.tabs[0].title).toMatch(/^Pasted image/);
  expect(s.items).toEqual([]);
  await expect(ws.getByText("320 × 200", { exact: true })).toBeVisible();

  // In an open snip: the image is added beside the base image (an image item, aspect kept, no number).
  await openSnip(page);
  const before = (await state()).items.length;
  expect(await pasteImage(page)).toBe(true);
  await expect(toast).toHaveText("Pasted image added beside the image · 320 × 200");
  s = await state();
  expect(s.items).toHaveLength(before + 1);
  const img = s.items.find((i) => i.type === "image")!;
  expect(img.number).toBeNull();
  expect(img.w / img.h).toBeCloseTo(320 / 200, 1);
  expect(s.tabs.map((t) => t.title)).toContain("Line 3 conveyor guard");
  await shots("pasted-into-snip");

  // Markdown Edit: the cursor is at "## 6 States"; the image is saved to images/ and linked there.
  await recents(page).getByRole("button", { name: NAME, exact: true }).click();
  await ws.getByRole("button", { name: "Edit", exact: true }).click();
  const src = ws.getByRole("textbox", { name: NAME });
  const lines = async () => (await src.inputValue()).split("\n");
  const total = (await lines()).length;
  const states = (await lines()).findIndex((l) => l.startsWith("## 6 States"));
  await src.click();
  await page.keyboard.press("Control+End");
  for (let i = 0; i < total - 1 - states; i++) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Home");
  expect(await pasteImage(page)).toBe(true);
  await expect(toast).toHaveText(/^Pasted image saved to images\/pasted-\d+\.png and linked$/);
  const after = await lines();
  const link = after.findIndex((l) => /^!\[Pasted image\]\(images\/pasted-\d+\.png\)/.test(l));
  expect(link).toBe(states); // at the cursor, in front of the heading
  expect(after[link + 1]).toBe("## 6 States");
  await expect(ws.getByRole("img", { name: "Pasted image" })).toBeVisible(); // the live preview
  await expect(recents(page).getByRole("button", { name: /^pasted-\d+\.png$/ })).toHaveCount(1);
  await shots("pasted-into-markdown");

  // Markdown Preview: also saved and linked (at the end of the file).
  await ws.getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(async () => (await state()).mode).toBe("preview");
  expect(await pasteImage(page)).toBe(true);
  await expect(toast).toHaveText(/^Pasted image saved to images\/pasted-\d+\.png and linked$/);
  await ws.getByRole("button", { name: "Edit", exact: true }).click();
  expect(((await src.inputValue()).match(/Pasted image/g) ?? []).length).toBe(2);

  // A text paste is left to the text box.
  await src.click();
  expect(await pasteText(page, "hello")).toBe(false);
});
