import { expect, test, type Page } from "@playwright/test";
import { decodePng } from "../src/tools/screenshot-diff";

// L06: the 3D viewer (app only; the reference specs check the parts list on both).

const viewport = (page: Page) => page.locator(".l-viewport");

async function openModel(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name, exact: true }).click();
  await expect(viewport(page)).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
}

/** The canvas as pixels: share of model pixels (not the viewport background) and of steel-blue pixels. */
async function look(page: Page) {
  const img = decodePng(await page.locator(".l-viewport canvas").screenshot());
  const n = img.width * img.height;
  // The background is the most common colour (the viewport surface shows through the transparent canvas).
  const counts = new Map<number, number>();
  for (let i = 0; i < n * 4; i += 4) {
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const bg = [(top >> 16) & 255, (top >> 8) & 255, top & 255];
  let model = 0;
  let blue = 0;
  for (let i = 0; i < n * 4; i += 4) {
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 24) model++;
    if (b > 120 && b > r + 60) blue++;
  }
  return { model: model / n, blue: blue / n };
}

test("the model renders from the bundled sample GLB, marked as a sample, with local requests only", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await openModel(page, "Palletizer frame v4");
  await expect(viewport(page).getByText("Sample model", { exact: true })).toBeVisible();
  await expect(viewport(page).getByText("Drag to orbit · scroll to zoom")).toBeVisible();
  const { model } = await look(page);
  expect(model).toBeGreaterThan(0.05);
  expect(requests.some((u) => /\/assets\/m1-[\w-]+\.glb$/.test(u))).toBe(true);
  expect(requests.filter((u) => !u.startsWith("http://localhost:4330/") && !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
});

test("zoom and orbit change the view; Fit to view brings the whole model back", async ({ page }) => {
  await openModel(page, "Palletizer frame v4");
  const fitted = (await look(page)).model;
  const box = (await page.locator(".l-viewport canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 600);
  const zoomedOut = (await look(page)).model;
  expect(zoomedOut).toBeLessThan(fitted * 0.6);
  // Orbit: drag sideways.
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Fit to view" }).click();
  const back = (await look(page)).model;
  expect(Math.abs(back - fitted) / fitted).toBeLessThan(0.1);
});

test("selecting a part in the list highlights it in the viewer; selecting it again clears it", async ({ page }) => {
  await openModel(page, "Palletizer frame v4");
  expect((await look(page)).blue).toBeLessThan(0.002);
  const row = page.getByRole("button", { name: /^Transfer axis/ });
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await expect(row).toHaveClass(/is-on/);
  await expect.poll(async () => (await look(page)).blue).toBeGreaterThan(0.005);
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await look(page)).blue).toBeLessThan(0.002);
});

test("clicking a part in the viewer selects its row; clicking empty space clears it", async ({ page }) => {
  await openModel(page, "Palletizer frame v4");
  const box = (await page.locator(".l-viewport canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".l-part[aria-pressed=true]")).toHaveCount(1);
  expect((await look(page)).blue).toBeGreaterThan(0.005);
  await page.mouse.click(box.x + 20, box.y + box.height - 40);
  await expect(page.locator(".l-part[aria-pressed=true]")).toHaveCount(0);
});

test("the second sample model loads; opening another item removes the viewer", async ({ page }) => {
  await openModel(page, "Standard guard layout");
  expect((await look(page)).model).toBeGreaterThan(0.05);
  await page.getByRole("button", { name: /^Guard panel/ }).click();
  await expect.poll(async () => (await look(page)).blue).toBeGreaterThan(0.005);
  await page.getByRole("button", { name: "Handoff log template", exact: true }).click();
  await expect(page.locator("#view canvas")).toHaveCount(0);
});
