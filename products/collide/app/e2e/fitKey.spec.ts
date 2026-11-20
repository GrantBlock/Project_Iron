// T48 (Grant 2026-11-20): the plain F key fits the canvas, like Ctrl+0 (kept), in the Snip editor, the Markdown Preview
// and a PDF page; never while typing (a callout note, the Markdown Edit text area).
import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const IMAGE = "/tests/fixtures/sample-400x300.png";
const PDF = fileURLToPath(new URL("../tests/fixtures/two-pages.pdf", import.meta.url));
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
const recents = (page: Page) => page.getByRole("complementary", { name: "Recents" });
const zoom = (page: Page) => page.evaluate(() => window.__collide!.state().zoom);

test("Snip editor: F fits after a zoom; typing an f in a callout note does not", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), IMAGE);
  await expect.poll(async () => (await zoom(page))?.fit).toBe(true);
  const fit = (await zoom(page))!;

  // A callout, then type an f into its note.
  await page.keyboard.press("p");
  const box = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const note = page.getByTestId("callout-note").first();
  await note.click();

  // Zoom in with the wheel, then type in the note.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await zoom(page))!.fit).toBe(false);
  await note.click();
  await page.keyboard.type("fff");
  await expect(note).toHaveValue(/fff$/);
  expect((await zoom(page))!.fit).toBe(false);

  // Off the note, F fits.
  await page.getByTestId("canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Escape");
  await page.keyboard.press("f");
  await expect.poll(() => zoom(page)).toEqual(fit);
  // Ctrl+0 still fits too.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await zoom(page))!.fit).toBe(false);
  await page.keyboard.press("Control+0");
  await expect.poll(() => zoom(page)).toEqual(fit);
});

test("Markdown: F fits the Preview; in Edit, an f typed in the text area is only text", async ({ page }) => {
  await page.goto("/?sample");
  await recents(page).getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
  await ws(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
  await expect.poll(async () => (await zoom(page))?.fit).toBe(true);
  const fit = (await zoom(page))!;
  await page.keyboard.press("Control+=");
  await expect.poll(async () => (await zoom(page))!.fit).toBe(false);
  await page.keyboard.press("f");
  await expect.poll(() => zoom(page)).toEqual(fit);

  await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
  const text = ws(page).getByRole("textbox", { name: "P06-Project-Workspace-Spec.md" });
  const before = await text.inputValue();
  await text.focus();
  await page.keyboard.press("End");
  await page.keyboard.type("f");
  await expect(text).toHaveValue(/f/);
  expect((await text.inputValue()).length).toBe(before.length + 1);
});

test("PDF: F fits the page after a zoom", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles(PDF);
  await expect(page.getByTestId("notice")).toContainText("PDF opened");
  await expect(page.locator('[data-testid="pdf-page"][data-page="1"][data-drawn="yes"]')).toBeVisible();
  await expect.poll(async () => (await zoom(page))?.fit).toBe(true);
  const fit = (await zoom(page))!;
  await page.keyboard.press("Control+=");
  await page.keyboard.press("Control+=");
  await expect.poll(async () => (await zoom(page))!.fit).toBe(false);
  await page.keyboard.press("f");
  await expect.poll(() => zoom(page)).toEqual(fit);
});
