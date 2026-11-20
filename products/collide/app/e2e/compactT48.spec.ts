// Written before the code (Lydia, tests first). Assumed hook: data-testid="compact-block" = brand row + the five controls.
// T48 (Grant 2026-11-20): the collapse button reduces the app to the compact view: the sidebar's top block alone (brand
// row, New snip + delay, Add snip + Current/Behind, Open, New file). Search, Recents, Tags, the footer and the whole
// workspace are hidden, even with tabs open; Expand brings everything back as it was. In a browser the window cannot
// shrink, so the compact block sits alone at the top left.
import { expect, test, type Page } from "@playwright/test";

const IMAGE = "/tests/fixtures/sample-400x300.png";
const side = (page: Page) => page.getByTestId("sidebar");
const state = (page: Page) => page.evaluate(() => window.__collide!.state());

test("collapsed with tabs open: only the compact block shows, top left; Expand brings the tabs back as they were", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?sample");
  await side(page).getByRole("button", { name: "README.md", exact: true }).click();
  await side(page).getByRole("button", { name: "New file" }).click();
  const before = (await state(page)).tabs;
  expect(before).toHaveLength(2);

  await side(page).getByRole("button", { name: "Collapse window" }).click();
  expect((await state(page)).sidebar.collapsed).toBe(true);
  await expect(page.getByRole("region", { name: "Workspace" })).toBeHidden();
  await expect(page.getByRole("tab")).toHaveCount(0);
  for (const name of ["New snip", "Add snip", "New file"]) await expect(side(page).getByRole("button", { name })).toBeVisible();
  await expect(side(page).getByRole("button", { name: "Open", exact: true })).toBeVisible();
  await expect(side(page).getByRole("radiogroup", { name: "Delay before New snip captures" })).toBeVisible();
  await expect(side(page).getByRole("radiogroup", { name: "Where Add snip captures" })).toBeVisible();
  for (const name of ["Appearance", "Settings and Connect"]) await expect(page.getByRole("button", { name })).toHaveCount(0);
  await expect(side(page).getByRole("textbox", { name: "Search" })).toHaveCount(0);
  await expect(side(page).getByText("Today")).toHaveCount(0);
  await expect(side(page).getByText("Tags")).toHaveCount(0);

  // The compact block alone, at the top left, the panel's width, as tall as its content; nothing else on the page.
  const block = page.getByTestId("compact-block");
  const bb = (await block.boundingBox())!;
  expect(Math.round(bb.x)).toBe(0);
  expect(Math.round(bb.y)).toBe(0);
  expect(Math.round(bb.width)).toBe(276);
  const last = (await side(page).getByRole("button", { name: "New file" }).boundingBox())!;
  expect(bb.height).toBeGreaterThanOrEqual(last.y + last.height);
  expect(bb.height).toBeLessThan(last.y + last.height + 40);
  const sb = (await side(page).boundingBox())!;
  expect(Math.round(sb.x)).toBe(0);
  expect(Math.round(sb.y)).toBe(0);
  expect(Math.round(sb.width)).toBe(276);
  // The window cannot shrink in a browser: the rest of the page is empty, no scrollbars.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  expect(await page.evaluate(() => (window.localStorage.getItem("collide.collapsed")))).toBe("1");

  // The same button swaps back.
  const expand = side(page).getByRole("button", { name: "Expand window" });
  await expect(expand).toBeVisible();
  await expand.click();
  expect((await state(page)).tabs).toEqual(before);
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Workspace" })).toBeVisible();
  await expect(side(page).getByRole("textbox", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings and Connect" })).toBeVisible();
});

test("collapsed, the hidden editor takes no keys; expanded, it does again", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), IMAGE);
  await expect.poll(async () => (await state(page)).activeTool).toBe("select");
  await side(page).getByRole("button", { name: "Collapse window" }).click();
  await page.keyboard.press("r");
  expect((await state(page)).activeTool).toBe("select");
  await side(page).getByRole("button", { name: "Expand window" }).click();
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("r");
  await expect.poll(async () => (await state(page)).activeTool).toBe("rect");
});

test("the Connected pill shows in the compact brand row when Connected mode is on", async ({ page }) => {
  await page.goto("/");
  await side(page).getByRole("button", { name: "Settings and Connect" }).click();
  await page.getByRole("button", { name: "Enable Connected mode" }).click();
  await side(page).getByRole("button", { name: "Collapse window" }).click();
  await expect(side(page).getByTestId("connected-pill")).toBeVisible();
});
