import { test, expect, state, shots, viewer, tree } from "./fixture";

const open = (page: any, name: string) => tree(page).getByRole("button", { name, exact: true }).click();

test.describe("views", () => {
  test("About content", async ({ lite: page }) => {
    const v = viewer(page);
    await expect(v.getByRole("heading", { name: "Site 7332 maintenance package", level: 1 })).toBeVisible();
    await expect(v.getByText("Opened from a Builder package. Lite shows it read only.")).toBeVisible();
    await expect(v.getByText("Signed by Block Concepts. Every file matches its hash.")).toBeVisible();
    for (const t of ["Package", "Client or site", "Revision", "Built", "Nov 11, 2026", "Format", "Lite package v0.1",
      "Contents", "3 documents, 2 models, 2 notes", "Contact", "[Contact name and email]", "Projects",
      "BC-Q-26041", "Palletizer retrofit", "ENG-RES", "Engineering resources"]) {
      await expect(v.getByText(t, { exact: true })).toBeVisible();
    }
    await expect(v.getByText("Lite never uploads anything from this package and needs no login.")).toBeVisible();
    expect((await state(page)).view).toEqual({ type: "about", page: null, pageCount: null });
  });

  test("document pages, Previous and Next, page count", async ({ lite: page }) => {
    await open(page, "GB-220 gearbox data sheet");
    const v = viewer(page);
    const prev = v.getByRole("button", { name: "Previous" });
    const next = v.getByRole("button", { name: "Next" });
    await expect(v.getByText("Document · 6 pages")).toBeVisible();
    await expect(v.getByText("Page 1 of 6")).toBeVisible();
    await expect(v.getByText("GB-220 gearbox. Ratio 20 to 1, rated output torque 220 N·m")).toBeVisible();
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    expect((await state(page)).view).toEqual({ type: "document", page: 1, pageCount: 6 });

    await next.click();
    await expect(v.getByText("Page 2 of 6")).toBeVisible();
    await expect(v.getByText("Oil volume depends on the mounting position")).toBeVisible();
    await expect(prev).toBeEnabled();
    expect((await state(page)).view.page).toBe(2);

    for (let i = 0; i < 4; i++) await next.click();
    await expect(v.getByText("Page 6 of 6")).toBeVisible();
    await expect(v.getByText("Ordering information and part numbers.")).toBeVisible();
    await expect(next).toBeDisabled();
    expect((await state(page)).view).toEqual({ type: "document", page: 6, pageCount: 6 });

    await prev.click();
    await expect(v.getByText("Page 5 of 6")).toBeVisible();
    await expect(v.getByText("Maximum radial load 3,200 N")).toBeVisible();
  });

  test("document page counts per document", async ({ lite: page }) => {
    await open(page, "Process document, rev 3");
    await expect(viewer(page).getByText("Page 1 of 3")).toBeVisible();
    await expect(viewer(page).getByText("The palletizer builds layers of six cases at 9 s per cycle (A)")).toBeVisible();
    await open(page, "Lockout procedure LOTO-004");
    await expect(viewer(page).getByText("Page 1 of 3")).toBeVisible();
    await expect(viewer(page).getByText("Purpose. This procedure covers lockout")).toBeVisible();
    expect((await state(page)).view.pageCount).toBe(3);
  });

  test("opening another document starts at page 1", async ({ lite: page }) => {
    await open(page, "GB-220 gearbox data sheet");
    await viewer(page).getByRole("button", { name: "Next" }).click();
    await open(page, "Process document, rev 3");
    expect((await state(page)).view.page).toBe(1);
  });

  test("note text", async ({ lite: page }) => {
    await open(page, "Pneumatic cylinder sizing");
    const v = viewer(page);
    await expect(v.getByRole("heading", { name: "Pneumatic cylinder sizing", level: 1 })).toBeVisible();
    await expect(v.getByText("Cylinder bore sized at 63 mm (A).")).toBeVisible();
    await expect(v.getByText("Open item: confirm the rod diameter with the vendor.")).toBeVisible();
    await expect(v.getByRole("button", { name: "Next" })).toHaveCount(0);
    expect((await state(page)).view).toEqual({ type: "note", page: null, pageCount: null });

    await open(page, "Handoff log template");
    await expect(v.getByText("Date, shift, what changed, what is waiting, who to call.")).toBeVisible();
  });

  test("model view parts list", async ({ lite: page }) => {
    await open(page, "Palletizer frame v4");
    const v = viewer(page);
    await expect(v.getByRole("heading", { name: "Palletizer frame v4", level: 1 })).toBeVisible();
    await expect(v.getByText("3D model · read only")).toBeVisible();
    for (const [part, bodies] of [["Frame", "1 body"], ["Transfer axis", "3 bodies"], ["Guard door", "2 bodies"], ["Gearbox GB-220", "1 body"]]) {
      await expect(v.getByText(part, { exact: true })).toBeVisible();
      await expect(v.getByText(bodies, { exact: true }).first()).toBeVisible();
    }
    expect((await state(page)).view).toEqual({ type: "model", page: null, pageCount: null });

    await open(page, "Standard guard layout");
    await expect(v.getByText("Guard panel", { exact: true })).toBeVisible();
    await expect(v.getByText("4 bodies", { exact: true })).toBeVisible();
    await expect(v.getByText("Door interlock", { exact: true })).toBeVisible();
    await expect(v.getByText("2 bodies", { exact: true })).toBeVisible();
  });

  test("screenshots", async ({ lite: page }) => {
    await open(page, "GB-220 gearbox data sheet");
    await shots(page, "views-document");
    await open(page, "Palletizer frame v4");
    await shots(page, "views-model");
    await open(page, "Pneumatic cylinder sizing");
    await shots(page, "views-note");
    await open(page, "About this package");
    await shots(page, "views-about");
  });
});
