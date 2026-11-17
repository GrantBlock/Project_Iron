import { expect, test } from "@playwright/test";

// App-specific checks of the L03 shell (the reference specs in ../reference cover the
// prototype's behaviour; `pnpm ref` runs them).

type Snap = { selected: { id: string | null }; openFolders: string[]; assistantShown: boolean };
const snap = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __lite: { state(): Snap } }).__lite.state());

test("window.__lite is read-only and reading it changes nothing", async ({ page }) => {
  await page.goto("/");
  const before = await snap(page);
  const result = await page.evaluate(() => {
    const w = window as unknown as { __lite: { state(): unknown } };
    const hook = w.__lite;
    try {
      (w as { __lite: unknown }).__lite = null;
    } catch {
      /* strict-mode assignment to a read-only property */
    }
    return { same: w.__lite === hook, frozen: Object.isFrozen(hook), keys: Object.keys(hook) };
  });
  expect(result).toEqual({ same: true, frozen: true, keys: ["state"] });
  const s = (await snap(page)) as Snap & { selected: object };
  (s.openFolders as string[]).push("changed");
  expect(await snap(page)).toEqual(before);
});

test("keyboard: tree rows are buttons; Enter selects and focus stays on the selected row", async ({ page }) => {
  await page.goto("/");
  const row = page.getByRole("button", { name: "Pneumatic cylinder sizing", exact: true });
  await row.focus();
  await page.keyboard.press("Enter");
  expect((await snap(page)).selected.id).toBe("n1");
  await expect(page.getByRole("button", { name: "Pneumatic cylinder sizing", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Pneumatic cylinder sizing", exact: true })).toHaveClass(/is-on/);
  // The selected row has the steel-blue left edge.
  const edge = await page.locator(".l-it.is-on").evaluate((e) => getComputedStyle(e).boxShadow);
  expect(edge).toContain("rgb(70, 130, 180)");

  const folder = page.getByRole("button", { name: /^Engineering resources/ });
  await folder.focus();
  await page.keyboard.press("Enter");
  await expect(folder).toHaveAttribute("aria-expanded", "false");
  await expect(folder).toBeFocused();
});

test("skip link goes to the viewer", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "Viewer" })).toBeFocused();
});

test("the web build draws the prototype's window controls in the title bar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".l-title .l-wc span")).toHaveCount(3);
});

test("L04 views: Next and Previous keep the keyboard on the page buttons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Process document, rev 3", exact: true }).click();
  const next = page.getByRole("button", { name: "Next" });
  await next.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Page 3 of 3")).toBeVisible();
  // Next is now disabled, so the keyboard moves to Previous.
  await expect(page.getByRole("button", { name: "Previous" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
});

test("L04 views: the model view keeps the prototype's viewport placeholder and parts list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Standard guard layout", exact: true }).click();
  await expect(page.locator(".l-viewport .hint")).toHaveText("Drag to orbit · scroll to zoom");
  await expect(page.locator(".l-part")).toHaveText(["Guard panel4 bodies", "Door interlock2 bodies"]);
});

test("L05 search: regex and HTML characters are plain text; the highlight is a <mark> around the page's own text", async ({ page }) => {
  await page.goto("/");
  const box = page.getByLabel("Search this package");
  await box.fill("(A)");
  await expect(page.getByRole("button", { name: "Process document, rev 3", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Process document, rev 3", exact: true }).click();
  await expect(page.locator(".l-paper mark")).toHaveText(["(A)"]);
  await box.fill("<b>x</b>");
  await expect(page.getByText("Nothing in this package matches.")).toBeVisible();
  await expect(page.locator("#tree b")).toHaveCount(0);
  await box.fill("");
  await expect(page.locator("#tree .l-it")).toHaveCount(7);
});

test("L07 Assistant: a typed question is shown as text, never parsed as HTML", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Ask about this package");
  await input.fill("<img src=x onerror=alert(1)> torque?");
  await input.press("Enter");
  await expect(page.locator(".l-m.u")).toHaveText("<img src=x onerror=alert(1)> torque?");
  await expect(page.locator("#msgs img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open source 2" })).toBeVisible();
});
