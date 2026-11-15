import { expect, test } from "../fixture";

// Seed: ../../../prototype-checks/tabs-and-close-splash.js
// Tabs keep their own edits; closing a changed tab shows the splash; Esc keeps it;
// Close without saving; the last tab closed shows the blank canvas.
//
// This is the example for the other reference specs: visible UI (roles, labels, text) and state() only.

const SNIP = "Line 3 conveyor guard";
const NOTE = "Changed note";

test("tabs keep their own edits; closing a changed tab asks first; the last tab closed shows the blank canvas", async ({ page, open, state, shots }) => {
  await open();
  const recents = page.getByRole("complementary", { name: "Recents" });
  const tabs = page.getByRole("tab");
  const note = page.getByRole("textbox", { name: "Note for callout 1" });
  const splash = page.getByRole("alertdialog", { name: `Save changes to ${SNIP}?` });
  const close = (title: string) => page.getByRole("button", { name: `Close ${title}`, exact: true });

  expect((await state()).view).toBe("blank");

  // Open a snip and change a note, then open three more items: each gets its own tab.
  await recents.getByRole("button", { name: new RegExp(`^${SNIP}`) }).click();
  const original = (await state()).items.find((i) => i.number === 1)!.note;
  expect(original).not.toBe(NOTE);
  await note.fill(NOTE);
  await recents.getByRole("button", { name: /^HMI header grid/ }).click();
  await recents.getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
  await page.getByRole("button", { name: "Settings and Connect" }).click();

  await expect(tabs).toHaveCount(4);
  expect((await state()).tabs.map((t) => [t.title, t.kind, t.dirty, t.active])).toEqual([
    [SNIP, "snip", true, false],
    ["HMI header grid", "snip", false, false],
    ["P06-Project-Workspace-Spec.md", "markdown", false, false],
    ["Settings", "settings", false, true],
  ]);
  expect((await state()).view).toBe("settings");

  // Back on the first tab the edit is still there, and the tab shows it has unsaved changes.
  await tabs.filter({ hasText: SNIP }).click();
  await expect(tabs.filter({ hasText: SNIP })).toHaveAttribute("aria-selected", "true");
  await expect(note).toHaveValue(NOTE);
  await expect(tabs.filter({ hasText: SNIP }).getByLabel("Unsaved changes")).toBeVisible();
  await expect(tabs.filter({ hasText: "HMI header grid" }).getByLabel("Saved", { exact: true })).toBeVisible();
  let s = await state();
  expect(s.view).toBe("snip");
  expect(s.items.find((i) => i.number === 1)!.note).toBe(NOTE);
  expect(s.tabs.map((t) => t.active)).toEqual([true, false, false, false]);
  await shots("four-tabs");

  // Closing a changed tab asks first, on a splash over the whole window.
  await close(SNIP).click();
  await expect(splash).toBeVisible();
  await expect(splash.getByRole("button", { name: "Save and close" })).toBeFocused();
  await expect(splash.getByRole("button", { name: "Close without saving" })).toBeVisible();
  await expect(splash.getByRole("button", { name: "Cancel" })).toBeVisible();
  expect((await state()).splash).toEqual({ kind: "close", title: SNIP });
  await shots("close-splash");

  // Esc keeps the tab and its edit.
  await page.keyboard.press("Escape");
  await expect(splash).toBeHidden();
  await expect(tabs).toHaveCount(4);
  s = await state();
  expect(s.splash).toBeNull();
  expect(s.tabs[0]).toMatchObject({ title: SNIP, dirty: true, active: true });

  // Close without saving closes it; the next tab is shown.
  await close(SNIP).click();
  await splash.getByRole("button", { name: "Close without saving" }).click();
  await expect(splash).toBeHidden();
  await expect(tabs).toHaveCount(3);
  s = await state();
  expect(s.splash).toBeNull();
  expect(s.tabs.map((t) => [t.title, t.dirty, t.active])).toEqual([
    ["HMI header grid", false, true],
    ["P06-Project-Workspace-Spec.md", false, false],
    ["Settings", false, false],
  ]);

  // Unchanged tabs close without asking; after the last one the blank canvas is back.
  for (const title of ["HMI header grid", "P06-Project-Workspace-Spec.md", "Settings"]) {
    await close(title).click();
    await expect(splash).toBeHidden();
  }
  await expect(tabs).toHaveCount(0);
  await expect(page.getByText("Blank canvas", { exact: true })).toBeVisible();
  s = await state();
  expect(s).toMatchObject({ view: "blank", tabs: [], editor: null, items: [], splash: null });
});
