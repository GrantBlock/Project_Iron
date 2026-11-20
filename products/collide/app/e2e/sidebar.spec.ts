import { expect, test } from "@playwright/test";

// T44 (Run 4, 5.1 to 5.4): New file, the collapse view and the Connected pill, in a real browser (CSS applied).

test("New file sits below Open and opens a Markdown file; the collapse view shows the five controls only", async ({ page }) => {
  await page.goto("/?sample");
  const side = page.getByTestId("sidebar");
  const open = side.getByRole("button", { name: "Open", exact: true });
  const newFile = side.getByRole("button", { name: "New file" });
  await expect(newFile).toBeVisible();
  const [o, n] = [await open.boundingBox(), await newFile.boundingBox()];
  expect(n!.y).toBeGreaterThan(o!.y + o!.height - 1);
  expect(Math.round(n!.x)).toBe(Math.round(o!.x));
  expect(Math.round(n!.width)).toBe(Math.round(o!.width));
  await expect(side.getByRole("textbox", { name: "Search" })).toBeVisible();

  await side.getByRole("button", { name: "Collapse window" }).click();
  for (const name of ["New snip", "Add snip", "New file"]) await expect(side.getByRole("button", { name })).toBeVisible();
  await expect(side.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  await expect(side.getByRole("radiogroup", { name: "Delay before New snip captures" })).toBeVisible();
  await expect(side.getByRole("radiogroup", { name: "Where Add snip captures" })).toBeVisible();
  await expect(side.getByRole("textbox", { name: "Search" })).toHaveCount(0);
  await expect(side.getByText("Today")).toHaveCount(0);

  await side.getByRole("button", { name: "New file" }).click();
  // T48: the compact view hides the tab bar and the canvas even with a tab open (was: the tab showed beside the panel).
  await expect(page.getByRole("tab", { name: /\.md/ })).toHaveCount(0);
  await side.getByRole("button", { name: "Expand window" }).click();
  await expect(page.getByRole("tab", { name: /\.md/ })).toBeVisible();
  // The tab header has no collapse button.
  await expect(page.getByRole("button", { name: /^(Collapse|Expand) window$/ })).toHaveCount(1);
});

test("the Connected pill shows only after Enable Connected mode, with the off light when nothing answers", async ({ page }) => {
  await page.goto("/");
  const side = page.getByTestId("sidebar");
  await expect(side.getByTestId("connected-pill")).toHaveCount(0);
  await side.getByRole("button", { name: "Settings and Connect" }).click();
  await page.getByRole("button", { name: "Enable Connected mode" }).click();
  const pill = side.getByTestId("connected-pill");
  await expect(pill).toHaveText("Connected");
  await expect(pill).toHaveAttribute("data-light", "off");
  await page.getByRole("button", { name: "Enable Connected mode" }).click();
  await expect(side.getByTestId("connected-pill")).toHaveCount(0);
});
