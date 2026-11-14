import { expect, test } from "@playwright/test";

const FIXTURE = "/tests/fixtures/sample-400x300.png";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").locator("canvas").first().waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), FIXTURE);
  await page.evaluate(() => {
    window.__collide!.seedShape({ x: 40, y: 30, w: 140, h: 80 });
    window.__collide!.seedShape({ x: 220, y: 150, w: 120, h: 90 });
  });
});

const exportPng = (page: import("@playwright/test").Page) => page.evaluate(() => window.__collide!.exportPng());

test("export is source W x H regardless of zoom and pan, and the view is restored", async ({ page }) => {
  const area = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.wheel(0, -600);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 + 90, area.y + area.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");

  const before = await page.evaluate(() => window.__collide!.getState().stage!);
  expect(before.scale).not.toBeCloseTo(1, 1);

  const out = await exportPng(page);
  expect(out.width).toBe(400);
  expect(out.height).toBe(300);
  const dims = await page.evaluate(
    (url) =>
      new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = url;
      }),
    out.dataUrl,
  );
  expect(dims).toEqual({ w: 400, h: 300 });

  const after = await page.evaluate(() => window.__collide!.getState().stage!);
  expect(after).toEqual(before);
});

test("selection outline is absent and export matches the committed baseline", async ({ page }) => {
  await page.keyboard.press("Escape");
  const clean = await exportPng(page);
  // Select a shape by clicking it, then export again: output must be identical.
  const area = (await page.getByTestId("canvas").boundingBox())!;
  const p = await page.evaluate(() => {
    const s = window.__collide!.getState();
    return { scale: s.stage!.scale, x: s.stage!.x, y: s.stage!.y };
  });
  await page.mouse.click(area.x + p.x + (40 + 70) * p.scale, area.y + p.y + 30 * p.scale);
  expect(await page.evaluate(() => window.__collide!.getState().selectedId)).not.toBeNull();
  const selected = await exportPng(page);
  expect(selected.dataUrl).toBe(clean.dataUrl);

  const buf = Buffer.from(selected.dataUrl.split(",")[1], "base64");
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  expect(buf).toMatchSnapshot("export-400x300.png", { maxDiffPixelRatio: 0.002 });
});

test("toolbar Export downloads a PNG", async ({ page }) => {
  const dl = page.waitForEvent("download");
  await page.getByTestId("export-btn").click();
  expect((await dl).suggestedFilename()).toBe("sample-400x300-markup.png");
});

const decode = (page: import("@playwright/test").Page, dataUrl: string) =>
  page.evaluate(
    (url) =>
      new Promise<{ w: number; h: number; px: number[][] }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0);
          const at = (x: number, y: number) => Array.from(g.getImageData(x, y, 1, 1).data);
          const W = img.naturalWidth;
          const H = img.naturalHeight;
          // corners (inside the 40px markers) and the middle of the bottom-right seeded shape's left edge
          resolve({ w: W, h: H, px: [at(10, 10), at(W - 10, 10), at(10, H - 10), at(W - 10, H - 10), at(W - 300, H - 200)] });
        };
        img.onerror = reject;
        img.src = url;
      }),
    dataUrl,
  );

async function largeExport(page: import("@playwright/test").Page) {
  const url = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 4032;
    c.height = 3024;
    const g = c.getContext("2d")!;
    g.fillStyle = "#808080";
    g.fillRect(0, 0, 4032, 3024);
    const mark = (x: number, y: number, col: string) => {
      g.fillStyle = col;
      g.fillRect(x, y, 40, 40);
    };
    mark(0, 0, "#ff0000");
    mark(4032 - 40, 0, "#00ff00");
    mark(0, 3024 - 40, "#0000ff");
    mark(4032 - 40, 3024 - 40, "#ffff00");
    return c.toDataURL("image/png");
  });
  await page.evaluate((u) => window.__collide!.openImage(u, "large.png"), url);
  await page.evaluate(() => window.__collide!.seedShape({ x: 3600, y: 2700, w: 300, h: 200 }));
  const area = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.wheel(0, -500);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 - 60, area.y + area.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const out = await exportPng(page);
  const d = await decode(page, out.dataUrl);
  expect([out.width, out.height]).toEqual([4032, 3024]);
  expect([d.w, d.h]).toEqual([4032, 3024]);
  const [tl, tr, bl, br, sh] = d.px;
  expect(tl.slice(0, 3)).toEqual([255, 0, 0]);
  expect(tr.slice(0, 3)).toEqual([0, 255, 0]);
  expect(bl.slice(0, 3)).toEqual([0, 0, 255]);
  expect(br.slice(0, 3)).toEqual([255, 255, 0]);
  expect(sh.slice(0, 3)).toEqual([128, 128, 128]);
}

test("large 4032 x 3024 image exports at full size with corner markers intact", async ({ page }) => {
  await largeExport(page);
});

test.describe("device scale factor 2", () => {
  test.use({ deviceScaleFactor: 2 });
  test("export stays source W x H (pixelRatio 1)", async ({ page }) => {
    await largeExport(page);
    const out = await exportPng(page);
    expect([out.width, out.height]).toEqual([4032, 3024]);
  });
  test("small fixture stays 400 x 300", async ({ page }) => {
    const out = await exportPng(page);
    expect((await decode(page, out.dataUrl)).w).toBe(400);
  });
});
