import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";
interface DocShape { id: string; type: string; x: number; y: number; w: number; h: number; callout?: number; note?: string }
const shapes = async (page: Page) => ((await page.evaluate(() => window.__collide!.getDoc())) as { shapes: DocShape[] }).shapes;

async function toPage(page: Page, ix: number, iy: number) {
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const { stage } = (await page.evaluate(() => window.__collide!.getState())) as { stage: { scale: number; x: number; y: number } };
  return { x: box.x + stage.x + ix * stage.scale, y: box.y + stage.y + iy * stage.scale };
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await toPage(page, ...from);
  const b = await toPage(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
});

test("empty state, then rows with numbered badges; row and shape selection stay in sync", async ({ page }) => {
  await expect(page.getByTestId("callouts")).toContainText("Draw on the image to add a callout.");
  await page.keyboard.press("r");
  await drag(page, [40, 30], [140, 90]);
  await page.keyboard.press("o");
  await drag(page, [200, 150], [300, 230]);
  await expect(page.getByTestId("callout-row")).toHaveCount(2);
  await expect(page.getByTestId("callout-badge")).toHaveText(["1", "2"]);
  await expect(page.getByTestId("callout-row").nth(1)).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("callout-row").first().click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId("callout-row").first()).toHaveAttribute("aria-selected", "true");
  // Selecting on the canvas selects the row.
  await page.keyboard.press("v");
  const p = await toPage(page, 250, 190);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("callout-row").nth(1)).toHaveAttribute("aria-selected", "true");
});

test("note edits persist in the doc and are one undo step per burst", async ({ page }) => {
  await page.keyboard.press("r");
  await drag(page, [40, 30], [140, 90]);
  const note = page.getByTestId("callout-note").first();
  await note.click();
  await note.pressSequentially("Check wiring");
  expect((await shapes(page))[0].note).toBe("Check wiring");
  await note.blur();
  // The whole typing burst is one step.
  await page.keyboard.press("Control+z");
  expect((await shapes(page))[0].note ?? "").toBe("");
  expect(await shapes(page)).toHaveLength(1);
  await page.keyboard.press("Control+y");
  expect((await shapes(page))[0].note).toBe("Check wiring");
});

test("undo/redo across draw, move, delete and note edit via keyboard and buttons", async ({ page }) => {
  const undoBtn = page.getByRole("button", { name: "Undo" });
  const redoBtn = page.getByRole("button", { name: "Redo" });
  await expect(undoBtn).toBeDisabled();
  await expect(redoBtn).toBeDisabled();

  // Draw
  await page.keyboard.press("r");
  await drag(page, [100, 80], [220, 140]);
  expect(await shapes(page)).toHaveLength(1);
  await expect(undoBtn).toBeEnabled();

  // Move (+60, +30)
  await page.keyboard.press("v");
  const mid = await toPage(page, 160, 110);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x + 30, mid.y + 15, { steps: 4 });
  await page.mouse.move(mid.x + 60, mid.y + 30, { steps: 4 });
  await page.mouse.up();
  expect(Math.abs((await shapes(page))[0].x - 160)).toBeLessThanOrEqual(2);

  // Note edit, then leave the field
  const note = page.getByTestId("callout-note").first();
  await note.click();
  await note.pressSequentially("Replace");
  await note.blur();
  expect((await shapes(page))[0].note).toBe("Replace");

  // Delete
  await page.getByTestId("callout-row").first().click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Delete");
  expect(await shapes(page)).toHaveLength(0);

  // Undo with keyboard: delete, note, move, draw
  await page.keyboard.press("Control+z");
  expect(await shapes(page)).toHaveLength(1);
  expect((await shapes(page))[0].note).toBe("Replace");
  await page.keyboard.press("Control+z");
  expect((await shapes(page))[0].note ?? "").toBe("");
  await undoBtn.click();
  expect(Math.abs((await shapes(page))[0].x - 100)).toBeLessThanOrEqual(2);
  await undoBtn.click();
  expect(await shapes(page)).toHaveLength(0);
  await expect(undoBtn).toBeDisabled();

  // Redo: Ctrl+Y, Ctrl+Shift+Z and the button
  await page.keyboard.press("Control+y");
  expect(await shapes(page)).toHaveLength(1);
  await page.keyboard.press("Control+Shift+Z");
  expect(Math.abs((await shapes(page))[0].x - 160)).toBeLessThanOrEqual(2);
  await redoBtn.click();
  expect((await shapes(page))[0].note).toBe("Replace");
  await redoBtn.click();
  expect(await shapes(page)).toHaveLength(0);
  await expect(redoBtn).toBeDisabled();

  // A new action after undo drops redo.
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(redoBtn).toBeEnabled();
  await page.keyboard.press("o");
  await drag(page, [20, 20], [80, 70]);
  await expect(redoBtn).toBeDisabled();
});
