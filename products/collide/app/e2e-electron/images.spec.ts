// RUN3 T33: Add snip in the real Electron shell, with the fake capture (COLLIDE_FAKE_CAPTURE=1: a fixed four-colour
// frame the size of the display). Current adds a screenshot of the screen as it is; Behind hides Collide and adds the
// crop, like New snip. Save writes the added images beside source.png; Open brings them back.
// Real Windows capture (what "the program that is open" shows, DPI) stays a manual check.
import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./launch";

type Item = { type: string; x: number; y: number; w: number; h: number; src?: string };
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

    // Current: the whole screen as it is, beside the base image, as tall as it, aspect kept.
    await recents.getByRole("radio", { name: "Current" }).click();
    await addSnip.click();
    await expect.poll(async () => (await images(page)).length).toBe(1);
    await expect(page.getByTestId("toast")).toHaveText("Screenshot added beside the image · copied to clipboard");
    const [first] = await images(page);
    expect(first).toMatchObject({ x: 344, y: 0, h: 200, src: "image-1.png" });
    expect(first.w).toBe(Math.round((200 * display.width) / display.height));

    // Behind: Collide hides, the overlay takes a box, the crop comes beside the first image.
    await recents.getByRole("radio", { name: "Behind" }).click();
    const opened = app.waitForEvent("window");
    await addSnip.click();
    const overlay = await opened;
    await expect(overlay.getByTestId("overlay")).toBeVisible();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Collide overlay")?.isVisible())).toBe(true);
    const view = await overlay.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    const b = { x: Math.round(view.w / 2) - 50, y: Math.round(view.h / 2) - 40 };
    await overlay.mouse.move(b.x, b.y);
    await overlay.mouse.down();
    await overlay.mouse.move(b.x + 50, b.y + 40, { steps: 3 });
    await overlay.mouse.move(b.x + 100, b.y + 80, { steps: 3 });
    await overlay.mouse.up();
    await expect.poll(async () => (await images(page)).length).toBe(2);
    await expect(page.getByTestId("toast")).toHaveText("Snip from behind added beside the image · copied to clipboard");
    const second = (await images(page))[1];
    expect(second).toMatchObject({ x: first.x + first.w + 24, y: 0, h: 200, src: "image-2.png" });
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
      { file: "image-2.png", width: expect.any(Number), height: expect.any(Number) },
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
