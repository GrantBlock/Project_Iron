import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./launch";

test("Electron opens the editor from the Vite build", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page).toHaveTitle("Collide");
    expect(page.url()).toBe("collide://app/");
    await expect(page.getByTestId("app-root")).toBeVisible();
    // T31: the app opens on the blank canvas with the sidebar; the toolbar belongs to a Snip tab.
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("canvas")).toBeVisible();
    expect(await app.windows()).toHaveLength(1);
  } finally {
    await close();
  }
});

test("Electron opens the editor from the Vite dev server", async () => {
  const { app, close } = await launch({ devUrl: "http://localhost:1420/" });
  try {
    const page = await app.firstWindow();
    await expect(page).toHaveTitle("Collide");
    expect(page.url()).toBe("http://localhost:1420/");
    // T31: the app opens on the blank canvas with the sidebar; the toolbar belongs to a Snip tab.
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("canvas")).toBeVisible();
  } finally {
    await close();
  }
});

// RUN2.md, "Preload bridge window.collide": these and nothing else (RUN3 T35 adds collideFiles: .collide save, open, pick; T36 adds storage: info, setKeep, prune; T38 adds collideFiles.openPdf and exportPdf).
const BRIDGE_KEYS = [
  "captureMonitor",
  "collapse",
  "collideFiles",
  "copyImage",
  "cropCapture",
  "hideEditor",
  "hideOverlay",
  "markups",
  "onSnipRequest",
  "overlay", // the overlay events
  "settingsStatus",
  "showEditor",
  "showOverlay",
  "storage",
];

test("the page is isolated: window.collide has exactly the bridge, no Node, sandbox on", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();

    const inPage = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const collide = (w.collide ?? {}) as Record<string, unknown>;
      const kinds = (o: unknown) =>
        Object.fromEntries(
          Object.entries((o ?? {}) as Record<string, unknown>)
            .map(([k, v]) => [k, typeof v] as const)
            .sort(([a], [b]) => a.localeCompare(b)),
        );
      return {
        collide: typeof w.collide,
        collideKeys: Object.keys(collide).sort(),
        functions: Object.entries(collide)
          .filter(([, v]) => typeof v === "function")
          .map(([k]) => k)
          .sort(),
        markups: kinds(collide.markups),
        collideFiles: kinds(collide.collideFiles),
        storage: kinds(collide.storage),
        overlay: kinds(collide.overlay),
        require: typeof w.require,
        process: typeof w.process,
        module: typeof w.module,
        Buffer: typeof w.Buffer,
        ipcRenderer: typeof w.ipcRenderer,
        electron: typeof w.electron,
        secureContext: window.isSecureContext,
      };
    });
    expect(inPage).toEqual({
      collide: "object",
      collideKeys: BRIDGE_KEYS,
      functions: BRIDGE_KEYS.filter((k) => k !== "markups" && k !== "overlay" && k !== "collideFiles" && k !== "storage"),
      markups: { list: "function", open: "function", pick: "function", remove: "function", save: "function" },
      collideFiles: { exportPdf: "function", open: "function", openPdf: "function", pick: "function", save: "function" },
      storage: { info: "function", prune: "function", setKeep: "function" },
      overlay: { emit: "function", on: "function" },
      require: "undefined",
      process: "undefined",
      module: "undefined",
      Buffer: "undefined",
      ipcRenderer: "undefined",
      electron: "undefined",
      secureContext: true,
    });

    const shell = await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      // Present at runtime; missing from Electron 33's type definitions.
      const contents = win.webContents as unknown as {
        getLastWebPreferences(): { contextIsolation?: boolean; sandbox?: boolean; nodeIntegration?: boolean };
      };
      const prefs = contents.getLastWebPreferences();
      return {
        name: electronApp.getName(),
        title: win.getTitle(),
        contextIsolation: prefs.contextIsolation,
        sandbox: prefs.sandbox,
        nodeIntegration: prefs.nodeIntegration,
      };
    });
    expect(shell).toEqual({
      name: "Collide",
      title: "Collide",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    });
  } finally {
    await close();
  }
});

test("capture and crop through the bridge: real screen frame, real nativeImage crop, typed errors", async () => {
  const { app, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();

    // No frame held yet: the typed error reaches the page as its cause-and-fix message.
    const early = await page.evaluate(() => window.collide!.cropCapture({ x: 0, y: 0, w: 10, h: 10 }, 1).then(
      () => "resolved",
      (e: unknown) => ({ isError: e instanceof Error, message: (e as Error).message }),
    ));
    expect(early).toEqual({ isError: true, message: "No capture to crop — start a new snip." });

    const display = await app.evaluate(({ screen }) => {
      const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      return { width: d.size.width, height: d.size.height, scaleFactor: d.scaleFactor };
    });

    const result = await page.evaluate(async () => {
      const collide = window.collide!;
      const load = async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return img;
      };
      const pixels = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data.join(",");
      };
      const message = (p: Promise<unknown>) => p.then(() => "resolved", (e: unknown) => (e as Error).message);

      const cap = await collide.captureMonitor();
      const frame = await load(cap.png);
      const box = { x: 10, y: 20, w: 100, h: 50 };
      const s = cap.scaleFactor;
      const want = { x: Math.floor(box.x * s), y: Math.floor(box.y * s), w: Math.ceil((box.x + box.w) * s) - Math.floor(box.x * s), h: Math.ceil((box.y + box.h) * s) - Math.floor(box.y * s) };
      const crop = await collide.cropCapture(box, s);
      const cropped = await load(crop.png);
      // The frame stays held: a second, clamped crop of the bottom-right corner still works.
      const corner = await collide.cropCapture({ x: cap.width / s - 5, y: cap.height / s - 5, w: 500, h: 500 }, s);
      return {
        cap: { width: cap.width, height: cap.height, scaleFactor: s, isPng: cap.png.startsWith("data:image/png;base64,") },
        frame: [frame.naturalWidth, frame.naturalHeight],
        want,
        crop: [crop.width, crop.height, cropped.naturalWidth, cropped.naturalHeight],
        samePixels: pixels(cropped, 0, 0, crop.width, crop.height) === pixels(frame, want.x, want.y, want.w, want.h),
        corner: [corner.width, corner.height],
        emptyBox: await message(collide.cropCapture({ x: 10, y: 10, w: 0, h: 0 }, s)),
        outside: await message(collide.cropCapture({ x: -500, y: 0, w: 100, h: 100 }, s)),
        invalid: await message(collide.cropCapture({ x: 0, y: 0, w: 10, h: 10 }, 0)),
      };
    });

    const physical = { width: Math.round(display.width * display.scaleFactor), height: Math.round(display.height * display.scaleFactor) };
    expect(result.cap).toEqual({ ...physical, scaleFactor: display.scaleFactor, isPng: true });
    expect(result.frame).toEqual([physical.width, physical.height]);
    expect(result.crop).toEqual([result.want.w, result.want.h, result.want.w, result.want.h]);
    expect(result.samePixels).toBe(true);
    expect(result.corner).toEqual([Math.ceil(5 * display.scaleFactor), Math.ceil(5 * display.scaleFactor)]);
    expect(result.emptyBox).toBe("The selection has no width or height — drag a larger box and release again.");
    expect(result.outside).toBe("The selection is outside the captured screen — drag a box over the screen and release again.");
    expect(result.invalid).toBe("The selection or display scale is not a valid number — start a new snip.");
  } finally {
    await close();
  }
});

test("bridge: markups, settings, copyImage and overlay events answer", async () => {
  const { app, userData, close } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();

    const result = await page.evaluate(async () => {
      const collide = window.collide!;
      const message = (p: Promise<unknown>) => p.then(() => "resolved", (e: unknown) => (e as Error).message);
      const ping = new Promise<unknown>((resolve) => {
        const off = collide.overlay.on("collide:overlay-ping", (payload) => {
          off();
          resolve(payload);
        });
        collide.overlay.emit("collide:overlay-ping", { snipId: 7 });
      });
      let unknownEvent = "no error";
      try {
        collide.overlay.emit("collide:capture-monitor" as never);
      } catch (e) {
        unknownEvent = (e as Error).message;
      }
      const offSnip = collide.onSnipRequest(() => undefined);
      return {
        showOverlay: await message(collide.showOverlay({ x: 0, y: 0, width: 0, height: 10 })),
        copyImage: await message(collide.copyImage("data:image/png;base64,AAAA")),
        settingsStatus: await collide.settingsStatus(),
        // Real since T16 (markups.spec.ts): nothing is saved yet in this launch's own Documents folder.
        markupsList: await collide.markups.list(),
        markupsOpen: await message(collide.markups.open("")),
        ping: await ping,
        unknownEvent,
        offSnip: typeof offSnip,
      };
    });
    expect(result).toEqual({
      showOverlay: "The overlay position is not valid — start a new snip.",
      copyImage: "The image to copy is not a PNG — try Copy again, or use Export instead.",
      settingsStatus: { hotkey: "Ctrl+Alt+S", warning: null },
      markupsList: [],
      markupsOpen: "No markup folder was given. Pick a folder created by Save.",
      ping: { snipId: 7 },
      unknownEvent: "Unknown overlay event: collide:capture-monitor",
      offSnip: "function",
    });

    // A first start writes settings.json with the default hotkey into the user-data folder.
    expect(await app.evaluate(({ app: electronApp }) => electronApp.getPath("userData"))).toBe(userData);
    expect(readFileSync(join(userData, "settings.json"), "utf8")).toBe('{\n  "hotkey": "Ctrl+Alt+S"\n}\n');
    // Nothing above opened the overlay window: it appears with the first snip.
    expect(await app.windows()).toHaveLength(1);
  } finally {
    await close();
  }
});

test("the shell stays on the app: other dev URLs ignored, no navigation away, no new windows", async () => {
  // COLLIDE_DEV_URL is honoured only for http on this machine.
  const { app, close } = await launch({ devUrl: "https://example.com/" });
  try {
    const page = await app.firstWindow();
    expect(page.url()).toBe("collide://app/");
    await expect(page.getByTestId("canvas")).toBeVisible();

    const opened = await page.evaluate(() => window.open("https://example.com/") === null);
    expect(opened).toBe(true);
    for (const target of ["https://example.com/", "file:///etc/hostname", "data:text/html,<p>away</p>"]) {
      await page.evaluate((url) => {
        window.location.href = url;
      }, target);
      await page.waitForTimeout(250);
      expect(page.url(), target).toBe("collide://app/");
    }
    // Checked without Playwright's auto-wait: it keeps waiting for the navigation the shell cancelled.
    expect(await page.getByTestId("canvas").isVisible()).toBe(true);
    const shell = await app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return { windows: windows.length, url: windows[0].webContents.getURL(), loading: windows[0].webContents.isLoading() };
    });
    expect(shell).toEqual({ windows: 1, url: "collide://app/", loading: false });
    expect(await app.windows()).toHaveLength(1);
  } finally {
    await close();
  }
});
