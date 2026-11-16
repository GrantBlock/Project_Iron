// T15: the snip in the real Electron shell, with a fake capture (COLLIDE_FAKE_CAPTURE=1:
// a fixed four-colour frame the size of the real display). Windows-only behaviour
// (real capture, DPI, the key press itself, the DWM fade) stays a manual check.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fakeColorAt } from "../src/native/fakeCapturer";
import { launch } from "./launch";

interface WindowInfo {
  visible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  opacity: number;
  alwaysOnTop: boolean;
  resizable: boolean;
  maximized: boolean;
  url: string;
}

/** The app's windows by title ("Collide" is the editor, "Collide overlay" the overlay). */
function windows(app: ElectronApplication): Promise<Record<string, WindowInfo>> {
  return app.evaluate(({ BrowserWindow }) =>
    Object.fromEntries(
      BrowserWindow.getAllWindows().map((w) => [
        w.getTitle(),
        {
          visible: w.isVisible(),
          bounds: w.getBounds(),
          opacity: w.getOpacity(),
          alwaysOnTop: w.isAlwaysOnTop(),
          resizable: w.isResizable(),
          maximized: w.isMaximized(),
          url: w.webContents.getURL(),
        },
      ]),
    ),
  );
}

/** The display the snip captures: the one under the cursor. */
function capturedDisplay(app: ElectronApplication) {
  return app.evaluate(({ screen }) => {
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    return { bounds: d.bounds, scale: d.scaleFactor, width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  });
}

/** What the clipboard holds as an image: its size and the [r, g, b] of its four corners. */
function clipboardImage(app: ElectronApplication) {
  return app.evaluate(({ clipboard }) => {
    const image = clipboard.readImage();
    const { width, height } = image.getSize();
    if (image.isEmpty()) return { width, height, corners: [] as number[][] };
    const bgra = image.toBitmap();
    const at = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return [bgra[i + 2], bgra[i + 1], bgra[i]];
    };
    return { width, height, corners: [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)] };
  });
}

/** The image open in the editor, flattened: its size and the [r, g, b] of its four corners. */
function editorImage(page: Page) {
  return page.evaluate(async () => {
    const flat = await window.__collide!.exportPng();
    const img = new Image();
    img.src = flat.dataUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    const [w, h] = [canvas.width, canvas.height];
    return { width: w, height: h, corners: [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)] };
  });
}

/** Drag a 100 x 80 box (overlay px) centred on the overlay, so the crop holds all four colours of the fake frame. */
async function dragCentreBox(overlay: Page, display: { scale: number; width: number; height: number }) {
  const view = await overlay.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const box = { x: Math.round(view.w / 2) - 50, y: Math.round(view.h / 2) - 40, w: 100, h: 80 };
  await overlay.mouse.move(box.x, box.y);
  await overlay.mouse.down();
  await overlay.mouse.move(box.x + 40, box.y + 30, { steps: 3 });
  await overlay.mouse.move(box.x + box.w, box.y + box.h, { steps: 3 });
  await overlay.mouse.up();
  // The crop in physical px, rounded outward as crop.ts does.
  const s = display.scale;
  const x = Math.floor(box.x * s);
  const y = Math.floor(box.y * s);
  const width = Math.ceil((box.x + box.w) * s) - x;
  const height = Math.ceil((box.y + box.h) * s) - y;
  const colour = (px: number, py: number) => [...fakeColorAt(px, py, display.width, display.height)];
  const corners = [colour(x, y), colour(x + width - 1, y), colour(x, y + height - 1), colour(x + width - 1, y + height - 1)];
  return { width, height, corners };
}

async function startSnip(app: ElectronApplication, start: () => Promise<unknown>): Promise<Page> {
  const opened = app.waitForEvent("window");
  await start();
  const overlay = await opened;
  // The page has the frozen frame before the window is shown.
  await expect(overlay.getByTestId("overlay")).toBeVisible();
  await expect.poll(async () => (await windows(app))["Collide overlay"]?.visible).toBe(true);
  return overlay;
}

test("New snip: overlay on the captured display, crop, editor shows the crop, clipboard has the image", async () => {
  const { app, close } = await launch({ fakeCapture: true });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    const display = await capturedDisplay(app);

    // Put the editor somewhere particular, so "restored exactly" means something.
    const place = { x: display.bounds.x + 37, y: display.bounds.y + 53, width: 1100, height: 700 };
    await app.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds), place);
    await expect.poll(async () => (await windows(app)).Collide.bounds).toEqual(place);
    await app.evaluate(({ clipboard }) => clipboard.clear());
    expect((await clipboardImage(app)).corners).toEqual([]);

    const overlay = await startSnip(app, () => page.getByTestId("new-snip").click());

    // The overlay: transparent, frameless, always-on-top window covering exactly the captured display; the editor is gone.
    const during = await windows(app);
    expect(Object.keys(during).sort()).toEqual(["Collide", "Collide overlay"]);
    expect(during["Collide overlay"]).toMatchObject({ visible: true, bounds: display.bounds, alwaysOnTop: true, resizable: false, url: "collide://app/overlay.html" });
    expect(during.Collide.visible).toBe(false);
    expect([during.Collide.bounds.x, during.Collide.bounds.y]).toEqual([-32000, -32000]);
    // It shows the frozen frame at the display's full physical size.
    await expect(overlay.getByTestId("overlay")).toBeVisible();
    const frame = overlay.getByTestId("overlay-frame");
    await expect.poll(() => frame.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([display.width, display.height]);
    expect(await overlay.evaluate(() => window.devicePixelRatio)).toBe(display.scale);

    const want = await dragCentreBox(overlay, display);

    // The crop opens in the editor as a new markup named snip-YYYY-MM-DD-HHMM and is copied straight away.
    await expect(page.getByTestId("notice")).toContainText("Snip copied to clipboard");
    await expect(page.getByTestId("file-name")).toHaveText(/^snip-\d{4}-\d{2}-\d{2}-\d{4}$/);
    expect(await page.evaluate(() => window.__collide!.getState().image)).toMatchObject({ width: want.width, height: want.height });
    expect(await editorImage(page)).toEqual(want);
    expect(await clipboardImage(app)).toEqual(want);

    // The overlay is hidden and the editor is back exactly where it was.
    const after = await windows(app);
    expect(after["Collide overlay"].visible).toBe(false);
    expect(after.Collide).toMatchObject({ visible: true, bounds: place, opacity: 1, maximized: false });
  } finally {
    await close();
  }
});

test("the hotkey's snip request runs the same flow; Esc cancels; the next snip reuses the overlay", async () => {
  const { app, close } = await launch({ fakeCapture: true });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    const display = await capturedDisplay(app);
    const before = (await windows(app)).Collide.bounds;
    // The default hotkey is registered. Pressing it for real is a manual check; this sends what a press sends.
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered("Control+Alt+S"))).toBe(true);

    const overlay = await startSnip(app, () =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("collide:snip-request"))),
    );
    expect((await windows(app)).Collide.visible).toBe(false);

    // Closing the overlay (Alt+F4) must not strand the snip with the editor hidden: it stays, and Esc still cancels.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Collide overlay")!.close());
    await overlay.waitForTimeout(200);
    expect((await windows(app))["Collide overlay"]).toMatchObject({ visible: true });

    await overlay.keyboard.press("Escape");
    await expect.poll(async () => (await windows(app)).Collide.visible).toBe(true);
    const cancelled = await windows(app);
    expect(cancelled["Collide overlay"].visible).toBe(false);
    expect(cancelled.Collide).toMatchObject({ bounds: before, opacity: 1 });
    expect(await page.evaluate(() => window.__collide!.getState().image)).toBeNull();
    await expect(page.getByTestId("notice")).toHaveCount(0);

    // A second snip, from the button: no new window, and the crop works.
    let opened = 0;
    app.on("window", () => opened++);
    await page.getByTestId("new-snip").click();
    await expect.poll(async () => (await windows(app))["Collide overlay"].visible).toBe(true);
    const want = await dragCentreBox(overlay, display);
    await expect(page.getByTestId("notice")).toContainText("Snip copied to clipboard");
    expect(await editorImage(page)).toEqual(want);
    expect(opened).toBe(0);
    expect(Object.keys(await windows(app))).toHaveLength(2);

    // Closing the editor quits Collide: the hidden overlay does not keep it running.
    const quit = app.waitForEvent("close");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Collide")!.close());
    await quit;
  } finally {
    await close();
  }
});

test("snip delay: the editor hides at once, the capture and overlay come after the delay", async () => {
  const { app, close } = await launch({ fakeCapture: true });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    // T31: the delay is a toggle in the sidebar (was a drop-down in the toolbar).
    await page.getByTestId("snip-delay").getByRole("radio", { name: "3s", exact: true }).click();

    const started = Date.now();
    const opened = app.waitForEvent("window");
    await page.getByTestId("new-snip").click();
    await opened;
    await expect.poll(async () => (await windows(app)).Collide.visible).toBe(false);
    const hiddenAfter = Date.now() - started;
    expect(hiddenAfter).toBeLessThan(2500);
    expect((await windows(app))["Collide overlay"].visible).toBe(false); // still waiting

    await expect.poll(async () => (await windows(app))["Collide overlay"].visible, { timeout: 10_000 }).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(3000);
  } finally {
    await close();
  }
});

test("Copy falls back to the shell's clipboard when the web clipboard refuses", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { write: () => Promise.reject(new Error("Document is not focused.")) } });
    });
    await app.evaluate(({ clipboard }) => clipboard.clear());

    // A 64 x 48 image made on the page (the collide:// origin serves only the build).
    const corner = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 48;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgb(10, 120, 200)";
      ctx.fillRect(0, 0, 64, 48);
      await window.__collide!.openImage(canvas.toDataURL("image/png"), "plain.png");
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    });
    await page.getByTestId("copy-btn").click();
    await expect(page.getByTestId("notice")).toContainText("Copied to clipboard");
    expect(await clipboardImage(app)).toEqual({ width: 64, height: 48, corners: [corner, corner, corner, corner] });
  } finally {
    await close();
  }
});

test("settings.json: a custom hotkey is the one registered", async () => {
  const { app, userData, close } = await launch({ settings: '{"hotkey":"Ctrl+Shift+F9"}' });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    expect(await page.evaluate(() => window.collide!.settingsStatus())).toEqual({ hotkey: "Ctrl+Shift+F9", warning: null });
    expect(await app.evaluate(({ globalShortcut }) => [globalShortcut.isRegistered("Control+Shift+F9"), globalShortcut.isRegistered("Control+Alt+S")])).toEqual([true, false]);
    await expect(page.getByTestId("notice")).toHaveCount(0);
    expect(readFileSync(join(userData, "settings.json"), "utf8")).toBe('{"hotkey":"Ctrl+Shift+F9"}');
  } finally {
    await close();
  }
});

test("settings.json: Win+Shift+S is refused with a toast naming the fix, and Ctrl+Alt+S is used", async () => {
  const { app, userData, close } = await launch({ settings: '{"hotkey":"Super+Shift+S"}' });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    const file = join(userData, "settings.json");
    const notice = page.getByTestId("notice");
    await expect(notice).toContainText("Hotkey setting not used");
    await expect(notice).toContainText(`Hotkey setting ignored: Win+Shift+S is reserved by Windows. Using Ctrl+Alt+S. Fix "hotkey" in ${file} (example: "Ctrl+Alt+S") and restart Collide.`);
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered("Control+Alt+S"))).toBe(true);
    // The bad file is left for the user to fix, not overwritten.
    expect(readFileSync(file, "utf8")).toBe('{"hotkey":"Super+Shift+S"}');
  } finally {
    await close();
  }
});

test("pnpm electron:dev: the overlay loads from the dev server and the snip works", async () => {
  const { app, close } = await launch({ devUrl: "http://localhost:1420/", fakeCapture: true });
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    const display = await capturedDisplay(app);
    const overlay = await startSnip(app, () => page.getByTestId("new-snip").click());
    expect(overlay.url()).toBe("http://localhost:1420/overlay.html");
    const want = await dragCentreBox(overlay, display);
    await expect(page.getByTestId("notice")).toContainText("Snip copied to clipboard");
    expect(await editorImage(page)).toEqual(want);
    expect(await clipboardImage(app)).toEqual(want);
  } finally {
    await close();
  }
});
