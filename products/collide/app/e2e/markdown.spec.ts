// RUN3 T34: the Markdown editor in the browser build, past what the reference specs check: Insert image saves into
// the zip's images/ folder, Copy PNG gives a real picture of the visible page, Save keeps the text and the markup
// for the session, and the page's scroll survives Edit / Preview and tab switches.
import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const NAME = "P06-Project-Workspace-Spec.md";
const FIXTURE = fileURLToPath(new URL("../tests/fixtures/sample-400x300.png", import.meta.url));

const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });
const recents = (page: Page) => page.getByRole("complementary", { name: "Recents" });
const state = (page: Page) => page.evaluate(() => window.__collide!.state());

async function openP06(page: Page) {
  await page.goto("/?sample");
  await recents(page).getByRole("button", { name: NAME, exact: true }).click();
  await ws(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
}

test("Insert image saves the picture into images/ and links it at the end of the file (Preview)", async ({ page }) => {
  await openP06(page);
  await ws(page).locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.getByRole("status")).toHaveText("Inserted image saved to images/sample-400x300.png and linked");
  await expect(recents(page).getByRole("button", { name: "sample-400x300.png", exact: true })).toBeVisible();
  expect((await state(page)).tabs[0].dirty).toBe(true);
  await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
  const src = await ws(page).getByRole("textbox", { name: NAME }).inputValue();
  expect(src.trimEnd().split("\n").pop()).toBe("![sample-400x300](images/sample-400x300.png)");
  await expect(ws(page).getByRole("img", { name: "sample-400x300" })).toBeVisible();
});

test("Copy PNG puts the visible page with its callouts on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openP06(page);
  await ws(page).getByRole("button", { name: "Copy PNG", exact: true }).click();
  const toast = page.getByRole("status");
  await expect(toast).toHaveText(/^Copied the visible page and its callouts as a PNG · \d+ × \d+$/);
  const [w, h] = (await toast.textContent())!.match(/(\d+) × (\d+)/)!.slice(1).map(Number);
  // The picture: its size, and most of it is the page (its own colour), not the canvas behind it.
  const pic = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0].getType("image/png");
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const x = c.getContext("2d")!;
    x.drawImage(bmp, 0, 0);
    const probe = document.createElement("div");
    probe.style.background = "var(--raised)";
    document.body.appendChild(probe);
    const [r, g, b] = getComputedStyle(probe).backgroundColor.match(/\d+/g)!.map(Number);
    probe.remove();
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let paper = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < 3 && Math.abs(d[i + 1] - g) < 3 && Math.abs(d[i + 2] - b) < 3) paper++;
    return { width: c.width, height: c.height, paper: paper / (d.length / 4) };
  });
  expect([pic.width, pic.height]).toEqual([w, h]);
  expect(pic.paper).toBeGreaterThan(0.3);
});

test("Save keeps the text and the markup until Collide closes; closing and opening again shows them", async ({ page }) => {
  await openP06(page);
  // A rectangle on the page, then a line of text.
  await page.keyboard.press("r");
  const h1 = (await ws(page).getByRole("heading", { level: 1 }).boundingBox())!;
  await page.mouse.move(h1.x + 40, h1.y + 120);
  await page.mouse.down();
  await page.mouse.move(h1.x + 140, h1.y + 160, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
  const src = ws(page).getByRole("textbox", { name: NAME });
  await src.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("Saved line");
  await expect(page.getByRole("tab").getByLabel("Unsaved changes")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("tab").getByLabel("Saved", { exact: true })).toBeVisible();
  const items = (await state(page)).items.length;
  expect(items).toBe(3);

  await page.getByRole("button", { name: `Close ${NAME}` }).click();
  expect((await state(page)).tabs).toEqual([]);
  await recents(page).getByRole("button", { name: NAME, exact: true }).click();
  await ws(page).getByRole("toolbar", { name: "Markdown tools" }).waitFor();
  expect((await state(page)).items).toHaveLength(items);
  await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
  expect((await ws(page).getByRole("textbox", { name: NAME }).inputValue()).endsWith("Saved line")).toBe(true);
});

test("the page keeps its scroll through Edit / Preview and another tab", async ({ page }) => {
  await openP06(page);
  const heading = ws(page).getByRole("heading", { level: 1 });
  const top0 = (await heading.boundingBox())!.y;
  const h1 = (await heading.boundingBox())!;
  await page.mouse.move(h1.x + 100, h1.y + 200);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await heading.boundingBox())!.y).toBeLessThan(top0 - 20);
  const scrolled = (await heading.boundingBox())!.y;
  expect((await state(page)).zoom!.fit).toBe(true); // a scroll is no zoom

  await ws(page).getByRole("button", { name: "Edit", exact: true }).click();
  await ws(page).getByRole("button", { name: "Preview", exact: true }).click();
  await expect.poll(async () => (await heading.boundingBox())!.y).toBeCloseTo(scrolled, 0);

  await recents(page).getByRole("button", { name: "README.md", exact: true }).click();
  await recents(page).getByRole("button", { name: NAME, exact: true }).click();
  await expect.poll(async () => (await heading.boundingBox())!.y).toBeCloseTo(scrolled, 0);

  // Ctrl+= zooms in a step; Ctrl+0 fits again.
  const fit = (await state(page)).zoom!;
  await page.keyboard.press("Control+=");
  await expect.poll(async () => Math.abs((await state(page)).zoom!.percent - fit.percent * 1.1)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Control+0");
  await expect.poll(async () => (await state(page)).zoom).toEqual(fit);
});
