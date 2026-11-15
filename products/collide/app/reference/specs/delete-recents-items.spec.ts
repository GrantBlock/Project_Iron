import { expect, test } from "../fixture";
import { LINE3, openMarkdown, openSnip, recents } from "../helpers";

// Seed: ../../../prototype-checks/delete-recents-items.js
// Delete a snip or a zip from Recents with the splash; Esc keeps it; its tabs close.

test("deleting a snip or a zip from Recents asks first; Esc keeps it; its tabs close", async ({ page, open, state, shots }) => {
  await open();
  const rec = recents(page);
  const snipRow = rec.getByRole("button", { name: new RegExp(`^${LINE3}`) });
  const splash = (title: string) => page.getByRole("alertdialog", { name: `Delete ${title}?` });
  const del = (title: string) => rec.getByRole("button", { name: `Delete ${title}`, exact: true });

  // A snip: open, hover its row, delete -> splash; Esc keeps it.
  await openSnip(page);
  expect((await state()).tabs).toHaveLength(1);
  await snipRow.hover();
  await del(LINE3).click();
  await expect(splash(LINE3)).toBeVisible();
  await expect(splash(LINE3).getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await expect(splash(LINE3).getByRole("button", { name: "Cancel" })).toBeVisible();
  expect((await state()).splash).toEqual({ kind: "delete", title: LINE3 });
  await shots("delete-splash");
  await page.keyboard.press("Escape");
  await expect(splash(LINE3)).toBeHidden();
  await expect(snipRow).toBeVisible();
  expect((await state()).splash).toBeNull();
  expect((await state()).tabs).toHaveLength(1);

  // Delete it for real: gone from Recents, its tab closed, blank canvas.
  await snipRow.hover();
  await del(LINE3).click();
  await splash(LINE3).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(splash(LINE3)).toBeHidden();
  await expect(snipRow).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText("Blank canvas", { exact: true })).toBeVisible();
  expect(await state()).toMatchObject({ view: "blank", tabs: [], splash: null });

  // A zip: a file from it is open; deleting the zip closes that tab and removes it from Recents.
  await openMarkdown(page);
  expect((await state()).tabs.map((t) => t.kind)).toEqual(["markdown"]);
  const zip = rec.getByRole("button", { name: /^builder-v0\.1\.zip/ });
  await zip.hover();
  await del("builder-v0.1.zip").click();
  await expect(splash("builder-v0.1.zip")).toBeVisible();
  await splash("builder-v0.1.zip").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(splash("builder-v0.1.zip")).toBeHidden();
  await expect(zip).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect((await state()).view).toBe("blank");

  // The other zip, with nothing open, goes the same way. (The splash says "Enter deletes", but the prototype puts the
  // cursor on Cancel, so Enter cancels: ISSUES 19. This spec uses the Delete button.)
  const notes = rec.getByRole("button", { name: /^collide-run-2-notes\.zip/ });
  await notes.hover();
  await del("collide-run-2-notes.zip").click();
  await splash("collide-run-2-notes.zip").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(notes).toHaveCount(0);
  await shots("after-deletes");
});
