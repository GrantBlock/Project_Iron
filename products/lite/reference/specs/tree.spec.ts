import { test, expect, state, shots, tree } from "./fixture";

const group = (page: any, name: string) => tree(page).getByRole("button", { name: new RegExp("^" + name) });

test.describe("tree", () => {
  test("About this package is selected at start", async ({ lite: page }) => {
    const s = await state(page);
    expect(s.selected.type).toBe("about");
    expect(s.selected.id).toBe("about");
    expect(s.view.type).toBe("about");
    expect(s.search.query).toBe("");
    await expect(page.getByRole("heading", { name: "Site 7332 maintenance package", level: 1 })).toBeVisible();
  });

  test("two project folders with their items, all open at start", async ({ lite: page }) => {
    expect((await state(page)).openFolders).toEqual(["Palletizer retrofit", "Engineering resources"]);
    await expect(group(page, "Palletizer retrofit")).toHaveAttribute("aria-expanded", "true");
    await expect(group(page, "Engineering resources")).toHaveAttribute("aria-expanded", "true");
    for (const n of [
      "Process document, rev 3", "GB-220 gearbox data sheet", "Palletizer frame v4", "Pneumatic cylinder sizing",
      "Lockout procedure LOTO-004", "Standard guard layout", "Handoff log template",
    ]) {
      await expect(tree(page).getByRole("button", { name: n, exact: true })).toBeVisible();
    }
    // Folder rows show their item counts.
    await expect(group(page, "Palletizer retrofit")).toContainText("4");
    await expect(group(page, "Engineering resources")).toContainText("3");
  });

  test("folders collapse and expand independently", async ({ lite: page }) => {
    const first = group(page, "Palletizer retrofit");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(tree(page).getByRole("button", { name: "Process document, rev 3" })).toBeHidden();
    await expect(tree(page).getByRole("button", { name: "Lockout procedure LOTO-004" })).toBeVisible();
    expect((await state(page)).openFolders).toEqual(["Engineering resources"]);
    // Collapsing does not change the selection.
    expect((await state(page)).selected.type).toBe("about");

    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(tree(page).getByRole("button", { name: "Process document, rev 3" })).toBeVisible();
    expect((await state(page)).openFolders).toEqual(["Palletizer retrofit", "Engineering resources"]);
  });

  test("selecting items updates the view, the path and the selected row", async ({ lite: page }) => {
    const cases = [
      ["Process document, rev 3", "d1", "document", "Palletizer retrofit"],
      ["Palletizer frame v4", "m1", "model", "Palletizer retrofit"],
      ["Pneumatic cylinder sizing", "n1", "note", "Palletizer retrofit"],
      ["Lockout procedure LOTO-004", "d3", "document", "Engineering resources"],
      ["Handoff log template", "n2", "note", "Engineering resources"],
    ] as const;
    for (const [title, id, type, folder] of cases) {
      await tree(page).getByRole("button", { name: title, exact: true }).click();
      const s = await state(page);
      expect(s.selected).toEqual({ id, type, title, path: `${folder} / ${title}` });
      expect(s.view.type).toBe(type);
    }
  });

  test("only the selected row has the selected state; About returns", async ({ lite: page }) => {
    const row = (n: string) => tree(page).getByRole("button", { name: n, exact: true });
    await row("GB-220 gearbox data sheet").click();
    await expect(row("GB-220 gearbox data sheet")).toHaveClass(/is-on/);
    await expect(row("About this package")).not.toHaveClass(/is-on/);
    await expect(tree(page).locator(".is-on")).toHaveCount(1);

    await row("Standard guard layout").click();
    await expect(row("Standard guard layout")).toHaveClass(/is-on/);
    await expect(row("GB-220 gearbox data sheet")).not.toHaveClass(/is-on/);
    await expect(tree(page).locator(".is-on")).toHaveCount(1);

    await row("About this package").click();
    await expect(row("About this package")).toHaveClass(/is-on/);
    expect((await state(page)).selected.type).toBe("about");
  });

  test("screenshots", async ({ lite: page }) => {
    await tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" }).click();
    await group(page, "Engineering resources").click();
    await shots(page, "tree");
  });
});
