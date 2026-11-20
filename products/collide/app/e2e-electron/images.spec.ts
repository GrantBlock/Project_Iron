// RUN3 T33 + T39: Add snip in the real Electron shell, with the fake capture (COLLIDE_FAKE_CAPTURE=1: a fixed four-colour
// frame the size of the display). Both show the drag box, like New snip (Grant 2026-11-17): Current over the screen as
// it is (Collide stays), Behind after Collide hides. The whole capture is kept and the box is its crop; Crop on the
// image's row changes it. Save writes the added images beside source.png; Open brings them back.
// Real Windows capture (what "the program that is open" shows, DPI) stays a manual check.
import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./launch";

type Item = { type: string; x: number; y: number; w: number; h: number; src?: string; crop?: { x: number; y: number; w: number; h: number } };
const images = async (page: Page) => ((await page.evaluate(() => window.__collide!.getDoc()))?.shapes ?? []).filter((s) => s.type === "image") as Item[];

test("Add snip: Current and Behind add beside the image; save and open keep both", async () => {
  const { app, documents, close } = await launch({ fakeCapture: true });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.__collide);
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 200;
      const x = c.getContext("2d")!;
      x.fillStyle = "rgb(200, 30, 40)";
      x.fillRect(0, 0, 320, 200);
      await window.__collide!.openImage(c.toDataURL("image/png"), "base.png");
    });
    const display = await app.evaluate(({ screen }) => {
      const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      return { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
    });
    const recents = page.getByRole("complementary", { name: "Recents" });
    const addSnip = recents.getByRole("button", { name: "Add snip", exact: true });

    const visible = (title: string) => app.evaluate(({ BrowserWindow }, t) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === t)?.isVisible() ?? false, title);
    /** Drag a 100 x 80 box in the middle of the overlay. */
    const dragBox = async (overlay: Page) => {
      await expect(overlay.getByTestId("overlay")).toBeVisible();
      await expect.poll(() => visible("Collide overlay")).toBe(true);
      const view = await overlay.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
      const b = { x: Math.round(view.w / 2) - 50, y: Math.round(view.h / 2) - 40 };
      await overlay.mouse.move(b.x, b.y);
      await overlay.mouse.down();
      await overlay.mouse.move(b.x + 50, b.y + 40, { steps: 3 });
      await overlay.mouse.move(b.x + 100, b.y + 80, { steps: 3 });
      await overlay.mouse.up();
    };

    // Current: the drag box over the screen as it is (Collide is not hidden); the box comes beside the base image,
    // at its own size (T46, 2.1), with the box's aspect. The file is the whole capture; the box is its crop.
    await recents.getByRole("radio", { name: "Current" }).click();
    const opened = app.waitForEvent("window");
    await addSnip.click();
    const overlay = await opened;
    expect(await visible("Collide")).toBe(true);
    await dragBox(overlay);
    await expect.poll(async () => (await images(page)).length).toBe(1);
    await expect(page.getByTestId("toast")).toHaveText("Snip added beside the image · copied to clipboard");
    const [first] = await images(page);
    // T46 (2.1): its own size, the captured pixels of the box (was: as tall as the base image, h 200).
    expect(first).toMatchObject({ x: 344, y: 0, src: "image-1.png" });
    expect(first.w).toBe(Math.round(first.crop!.w * display.width));
    expect(first.h).toBe(Math.round(first.crop!.h * display.height));
    expect(first.w / first.h).toBeCloseTo(100 / 80, 1);
    expect(first.crop!.w).toBeGreaterThan(0);
    expect(first.crop!.w).toBeLessThan(1);

    // Crop on its row: Reset to the whole capture keeps the scale, so the image grows to the whole screen's aspect.
    await page.getByRole("button", { name: "Crop image" }).first().click();
    await expect(page.getByRole("dialog", { name: "Crop image" })).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByTestId("crop-size")).toHaveText(`${display.width} × ${display.height} of ${display.width} × ${display.height}`);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Crop image" })).toBeHidden();
    const whole = (await images(page))[0];
    expect(whole.crop).toBeUndefined();
    expect(whole.w / whole.h).toBeCloseTo(display.width / display.height, 1);
    // Undo brings the box back.
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await images(page))[0].crop?.w ?? 1).toBeLessThan(1);

    // Behind: Collide hides, the overlay takes a box, the crop comes beside the first image.
    await recents.getByRole("radio", { name: "Behind" }).click();
    await addSnip.click();
    await expect.poll(() => visible("Collide")).toBe(false);
    await dragBox(overlay);
    await expect.poll(async () => (await images(page)).length).toBe(2);
    await expect(page.getByTestId("toast")).toHaveText("Snip from behind added beside the image · copied to clipboard");
    const second = (await images(page))[1];
    expect(second).toMatchObject({ x: first.x + first.w + 24, y: 0, src: "image-2.png" });
    expect(second.h).toBe(Math.round(second.crop!.h * display.height)); // T46 (2.1): was h 200
    expect(second.w / second.h).toBeCloseTo(100 / 80, 1);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Collide")!.isVisible())).toBe(true);

    // Save: the two image files sit beside source.png and annotations.json lists them.
    await page.getByTestId("save-markup").click();
    await expect(page.getByTestId("notice")).toContainText("Markup saved");
    const root = join(documents, "Collide", "Markups");
    const [folder] = readdirSync(root);
    expect(readdirSync(join(root, folder)).sort()).toEqual(["annotations.json", "export.png", "image-1.png", "image-2.png", "source.png"]);
    const json = JSON.parse(readFileSync(join(root, folder, "annotations.json"), "utf8")) as { images: { file: string; width: number; height: number }[] };
    expect(json.images).toEqual([
      { file: "image-1.png", width: display.width, height: display.height },
      { file: "image-2.png", width: display.width, height: display.height },
    ]);
    const saved = await page.evaluate(() => window.__collide!.getDoc());

    // Close the tab, open the markup again: the same items, the pictures drawn.
    await page.keyboard.press("Control+w");
    await expect.poll(() => page.evaluate(() => window.__collide!.state().view)).toBe("blank");
    await page.evaluate((f) => window.__collide!.openMarkup(f), join(root, folder));
    const back = await page.evaluate(() => window.__collide!.getDoc());
    expect(back!.shapes).toEqual(saved!.shapes);
    expect((await page.evaluate(() => window.__collide!.state())).items.slice(0, 2).map((i) => `${i.type}:${i.number ?? "-"}`)).toEqual(["image:-", "image:-"]);
  } finally {
    await close();
  }
});
