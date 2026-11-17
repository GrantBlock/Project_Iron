import { test, expect, state, shots, tree, viewer, grantOverride, TARGET_NAME } from "./fixture";

const box = (page: any) => page.getByLabel("Search this package");

test.describe("search", () => {
  test("empty query shows every item", async ({ lite: page }) => {
    const s = await state(page);
    expect(s.search).toEqual({ query: "", matchCount: 7, highlights: 0 });
  });

  test("typing filters the tree and reports the match count", async ({ lite: page }) => {
    await box(page).fill("gearbox");
    // Matches by title (GB-220 gearbox data sheet) or text (LOTO page mentions the gearbox; process doc names none).
    const s = await state(page);
    expect(s.search.query).toBe("gearbox");
    expect(s.search.matchCount).toBe(2);
    await expect(tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" })).toBeVisible();
    await expect(tree(page).getByRole("button", { name: "Lockout procedure LOTO-004" })).toBeVisible();
    await expect(tree(page).getByRole("button", { name: "Handoff log template" })).toHaveCount(0);
    await expect(tree(page).getByRole("button", { name: "Pneumatic cylinder sizing" })).toHaveCount(0);
  });

  test("folder counts follow the filter and empty folders disappear", async ({ lite: page }) => {
    await box(page).fill("pneumatic");
    // Pneumatic: note title in folder 1; LOTO text in folder 2.
    await expect(tree(page).getByRole("button", { name: /^Palletizer retrofit/ })).toContainText("1");
    await expect(tree(page).getByRole("button", { name: /^Engineering resources/ })).toContainText("1");
    await box(page).fill("cylinder");
    await expect(tree(page).getByRole("button", { name: /^Engineering resources/ })).toHaveCount(0);
    expect((await state(page)).openFolders).toEqual(["Palletizer retrofit"]);
  });

  test("matching is case-insensitive and also searches note text", async ({ lite: page }) => {
    await box(page).fill("ROD DIAMETER");
    expect((await state(page)).search.matchCount).toBe(1);
    await expect(tree(page).getByRole("button", { name: "Pneumatic cylinder sizing" })).toBeVisible();
  });

  test("no matches shows an empty message; About stays", async ({ lite: page }) => {
    await box(page).fill("zzzz-nothing");
    await expect(tree(page).getByText("Nothing in this package matches.")).toBeVisible();
    expect((await state(page)).search.matchCount).toBe(0);
    await expect(tree(page).getByRole("button", { name: "About this package" })).toBeVisible();
  });

  test("opening a result highlights the match on the page", async ({ lite: page }) => {
    await box(page).fill("oil");
    await tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" }).click();
    const s = await state(page);
    expect(s.view).toMatchObject({ type: "document", page: 1 });
    // Highlights only show on pages that contain the term; page 1 has none, page 2 does.
    await viewer(page).getByRole("button", { name: "Next" }).click();
    await expect(viewer(page).locator("mark")).toHaveCount(1);
    await expect(viewer(page).locator("mark")).toHaveText("Oil");
    expect((await state(page)).search.highlights).toBe(1);
  });

  test("highlight is case-insensitive and covers repeated hits", async ({ lite: page }) => {
    await box(page).fill("mounting position");
    await tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" }).click();
    await viewer(page).getByRole("button", { name: "Next" }).click();
    await expect(viewer(page).locator("mark")).toHaveCount(2);
    expect((await state(page)).search.highlights).toBe(2);
  });

  test("clearing the search restores the tree", async ({ lite: page }) => {
    await box(page).fill("gearbox");
    expect((await state(page)).search.matchCount).toBe(2);
    await box(page).fill("");
    const s = await state(page);
    expect(s.search).toMatchObject({ query: "", matchCount: 7 });
    await expect(tree(page).getByRole("button", { name: "Handoff log template" })).toBeVisible();
    await expect(tree(page).getByRole("button", { name: /^Palletizer retrofit/ })).toContainText("4");
  });

  test("a closed folder stays closed while searching and after clearing [Grant 2026-11-17]", grantOverride("ISSUES 3"), async ({ lite: page }) => {
    test.fail(TARGET_NAME === "prototype", "Grant 2026-11-17 overrides the prototype");
    const folder = (n: string) => tree(page).getByRole("button", { name: new RegExp("^" + n) });
    await folder("Palletizer retrofit").click();
    await box(page).fill("gearbox");
    await expect(folder("Palletizer retrofit")).toHaveAttribute("aria-expanded", "false");
    await expect(tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" })).toBeHidden();
    expect((await state(page)).openFolders).toEqual(["Engineering resources"]);
    await box(page).fill("");
    await expect(folder("Palletizer retrofit")).toHaveAttribute("aria-expanded", "false");
    await expect(folder("Engineering resources")).toHaveAttribute("aria-expanded", "true");
    expect((await state(page)).openFolders).toEqual(["Engineering resources"]);
  });

  test("screenshots", async ({ lite: page }) => {
    await box(page).fill("oil");
    await tree(page).getByRole("button", { name: "GB-220 gearbox data sheet" }).click();
    await viewer(page).getByRole("button", { name: "Next" }).click();
    await shots(page, "search");
  });
});
