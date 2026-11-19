import { test, expect, state, shots, PHONE, tree, viewer, assistant } from "./fixture";

test.use({ viewport: PHONE });

test.describe("under 900px: tabs", () => {
  test.beforeEach(async ({ lite: page }) => {
    await page.setViewportSize(PHONE);
  });

  test("three tabs, Files first and selected", async ({ lite: page }) => {
    const tabs = page.getByRole("tablist", { name: "Panes" });
    await expect(tabs).toBeVisible();
    for (const n of ["Files", "View", "Assistant"]) await expect(tabs.getByRole("tab", { name: n })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");
    await expect(tabs.getByRole("tab", { name: "View" })).toHaveAttribute("aria-selected", "false");
    expect((await state(page)).tab).toBe("files");
    await expect(tree(page)).toBeVisible();
    await expect(viewer(page)).toBeHidden();
    await expect(assistant(page)).toBeHidden();
  });

  test("each tab shows only its pane", async ({ lite: page }) => {
    const tab = (n: string) => page.getByRole("tab", { name: n });
    await tab("View").click();
    await expect(viewer(page)).toBeVisible();
    await expect(tree(page)).toBeHidden();
    await expect(assistant(page)).toBeHidden();
    await expect(tab("View")).toHaveAttribute("aria-selected", "true");
    expect((await state(page)).tab).toBe("view");

    await tab("Assistant").click();
    await expect(assistant(page)).toBeVisible();
    await expect(viewer(page)).toBeHidden();
    await expect(tree(page)).toBeHidden();
    expect((await state(page)).tab).toBe("assistant");

    await tab("Files").click();
    await expect(tree(page)).toBeVisible();
    expect((await state(page)).tab).toBe("files");
  });

  test("selecting a tree item jumps to the View tab", async ({ lite: page }) => {
    await tree(page).getByRole("button", { name: "Process document, rev 3" }).click();
    expect((await state(page)).tab).toBe("view");
    await expect(viewer(page).getByText("Page 1 of 3")).toBeVisible();
    await page.getByRole("tab", { name: "Files" }).click();
    await expect(tree(page).getByRole("button", { name: "Process document, rev 3" })).toHaveClass(/is-on/);
  });

  test("a citation in the Assistant tab opens the page in the View tab", async ({ lite: page }) => {
    await page.getByRole("tab", { name: "Assistant" }).click();
    await assistant(page).getByRole("button", { name: "What is the gearbox oil change interval?" }).click();
    await assistant(page).getByRole("button", { name: "Open source 1" }).first().click();
    const s = await state(page);
    expect(s.tab).toBe("view");
    expect(s.view).toEqual({ type: "document", page: 4, pageCount: 6 });
    await expect(viewer(page).getByText("Page 4 of 6")).toBeVisible();
  });

  test("search works in the Files tab", async ({ lite: page }) => {
    await page.getByLabel("Search this package").fill("cylinder");
    expect((await state(page)).search.matchCount).toBe(1);
    await expect(tree(page).getByRole("button", { name: "Pneumatic cylinder sizing" })).toBeVisible();
  });

  test("tab reads null again above 900px and the three areas return", async ({ lite: page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    expect((await state(page)).tab).toBeNull();
    await expect(tree(page)).toBeVisible();
    await expect(viewer(page)).toBeVisible();
    await expect(assistant(page)).toBeVisible();
    await page.setViewportSize({ width: 901, height: 800 });
    expect((await state(page)).tab).toBeNull();
    await page.setViewportSize({ width: 900, height: 800 });
    expect((await state(page)).tab).toBe("files");
  });

  test("screenshots", async ({ lite: page }) => {
    await shots(page, "tabs-files");
    await tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" }).click();
    await shots(page, "tabs-view");
    await page.getByRole("tab", { name: "Assistant" }).click();
    await shots(page, "tabs-assistant");
  });
});
