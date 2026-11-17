import { test, expect, state, shots, tree, viewer, assistant } from "./fixture";

test.describe("shell", () => {
  test("three areas are visible at desktop width", async ({ lite: page }) => {
    await expect(tree(page)).toBeVisible();
    await expect(viewer(page)).toBeVisible();
    await expect(assistant(page)).toBeVisible();
    await expect(page.getByText("Lite", { exact: true })).toBeVisible();
    await expect(page.getByText("Site 7332 maintenance package").first()).toBeVisible();
    await expect(page.getByLabel("Search this package")).toBeVisible();
    await expect(page.getByText("Offline. Nothing leaves this computer.")).toBeVisible();
    // The Files / View / Assistant tabs only exist under 900px.
    await expect(page.getByRole("tab", { name: "Files" })).toBeHidden();
    expect((await state(page)).tab).toBeNull();
  });

  test("left side shows the package name and client line", async ({ lite: page }) => {
    await expect(tree(page).getByText("Site 7332 maintenance package")).toBeVisible();
    await expect(tree(page).getByText("[Client or site] · Rev A · built by Block Concepts")).toBeVisible();
  });

  test("Assistant button hides and shows the right side", async ({ lite: page }) => {
    const btn = page.getByRole("button", { name: "Assistant", exact: true });
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    expect((await state(page)).assistantShown).toBe(true);

    await btn.click();
    await expect(assistant(page)).toBeHidden();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await expect(viewer(page)).toBeVisible();
    expect((await state(page)).assistantShown).toBe(false);

    await btn.click();
    await expect(assistant(page)).toBeVisible();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    expect((await state(page)).assistantShown).toBe(true);
  });

  test("hiding the Assistant widens the viewer", async ({ lite: page }) => {
    const before = (await viewer(page).boundingBox())!.width;
    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    const after = (await viewer(page).boundingBox())!.width;
    expect(after).toBeGreaterThan(before + 200);
  });

  test("path bar and Read only tag", async ({ lite: page }) => {
    await expect(viewer(page).getByText("Read only", { exact: true })).toBeVisible();
    await expect(viewer(page).getByText("About this package").first()).toBeVisible();
    expect((await state(page)).selected.path).toBe("About this package");

    await page.getByRole("button", { name: "Process document, rev 3" }).click();
    await expect(viewer(page).getByText("Palletizer retrofit / Process document, rev 3")).toBeVisible();
    expect((await state(page)).selected.path).toBe("Palletizer retrofit / Process document, rev 3");
    await expect(viewer(page).getByText("Read only", { exact: true })).toBeVisible();
  });

  test("Assistant panel header and notices", async ({ lite: page }) => {
    const a = assistant(page);
    await expect(a.getByText("On this computer", { exact: true })).toBeVisible();
    await expect(a.getByPlaceholder("Ask about this package")).toBeVisible();
    await expect(a.getByText("I answer only from this package and cite the page.")).toBeVisible();
    await expect(a.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("screenshots", async ({ lite: page }) => {
    await shots(page, "shell");
  });
});
