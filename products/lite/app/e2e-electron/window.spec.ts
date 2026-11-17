import { expect, test } from "@playwright/test";
import { BRIDGE_KEYS } from "../src/renderer/bridge";
import { launch } from "./launch";

test("Lite opens one window titled Lite, 1280 × 800 and resizable, on the app's own build", async () => {
  const { app, page, close } = await launch();
  try {
    await expect(page).toHaveTitle("Lite");
    expect(page.url()).toBe("lite://app/");
    await expect(page.getByTestId("app-root")).toBeVisible();
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // L03: the prototype's backdrop behind the window frame.
    expect(background).toBe("rgb(20, 20, 22)");

    const shell = await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      const win = windows[0];
      return {
        windows: windows.length,
        name: electronApp.getName(),
        title: win.getTitle(),
        size: win.getSize(),
        resizable: win.isResizable(),
        visible: win.isVisible(),
      };
    });
    expect(shell).toEqual({ windows: 1, name: "Lite", title: "Lite", size: [1280, 800], resizable: true, visible: true });
  } finally {
    await close();
  }
});

test("the page is isolated: window.lite has exactly the bridge, no Node, sandbox on", async () => {
  const { app, page, close } = await launch();
  try {
    await expect(page.getByTestId("app-root")).toBeVisible();
    const inPage = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const lite = (w.lite ?? {}) as Record<string, unknown>;
      return {
        liteKeys: Object.keys(lite).sort(),
        desktop: lite.desktop,
        frozen: Object.isFrozen(lite),
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
      liteKeys: [...BRIDGE_KEYS],
      desktop: true,
      frozen: true,
      require: "undefined",
      process: "undefined",
      module: "undefined",
      Buffer: "undefined",
      ipcRenderer: "undefined",
      electron: "undefined",
      secureContext: true,
    });

    const prefs = await app.evaluate(({ BrowserWindow }) => {
      // Present at runtime; missing from Electron 33's type definitions.
      const contents = BrowserWindow.getAllWindows()[0].webContents as unknown as {
        getLastWebPreferences(): { contextIsolation?: boolean; sandbox?: boolean; nodeIntegration?: boolean };
      };
      const p = contents.getLastWebPreferences();
      return { contextIsolation: p.contextIsolation, sandbox: p.sandbox, nodeIntegration: p.nodeIntegration };
    });
    expect(prefs).toEqual({ contextIsolation: true, sandbox: true, nodeIntegration: false });
  } finally {
    await close();
  }
});

test("the window stays on the app: no navigation away, no new windows", async () => {
  const { app, page, close } = await launch();
  try {
    await expect(page.getByTestId("app-root")).toBeVisible();
    expect(await page.evaluate(() => window.open("https://example.com/") === null)).toBe(true);
    for (const target of ["https://example.com/", "file:///etc/hostname", "data:text/html,<p>away</p>"]) {
      await page.evaluate((url) => {
        window.location.href = url;
      }, target);
      await page.waitForTimeout(250);
      expect(page.url(), target).toBe("lite://app/");
    }
    expect(await page.getByTestId("app-root").isVisible()).toBe(true);
    expect(await app.windows()).toHaveLength(1);
  } finally {
    await close();
  }
});

test("the shell shows in the app, with the drawn window buttons in the title bar", async () => {
  const { page, close } = await launch();
  try {
    await expect(page.getByRole("complementary", { name: "Package files" })).toBeVisible();
    await expect(page.getByRole("main", { name: "Viewer" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Assistant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Assistant", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".l-title .l-wc button")).toHaveCount(3);
    const s = await page.evaluate(() => (window as unknown as { __lite: { state(): { selected: { id: string }; tab: unknown } } }).__lite.state());
    expect(s.selected.id).toBe("about");
    expect(s.tab).toBeNull();
  } finally {
    await close();
  }
});

// L10 (Grant 2026-11-17, ISSUES.md 7): frameless window with the prototype's drawn buttons.
type WinState = { maximized: boolean; minimized: boolean; calls: string[] };
const winState = (app: import("@playwright/test").ElectronApplication) =>
  app.evaluate(({ BrowserWindow }): WinState => {
    const w = BrowserWindow.getAllWindows()[0];
    const calls = (globalThis as unknown as { __liteCalls?: string[] }).__liteCalls ?? [];
    return { maximized: w.isMaximized(), minimized: w.isMinimized(), calls: [...calls] };
  });

/**
 * The cloud box's virtual display (xvfb) has no window manager, so a real maximize or minimize
 * never happens there. This stands in for the window manager on the window object only: the
 * calls are recorded and the state and events follow as a window manager would make them.
 * Everything else is real: the page's buttons, the preload, the IPC channel, main.cjs's checks,
 * applyWindowAction and the maximized event back to the page. Windows checks: TESTER-NOTES.md.
 */
async function stubWindowManager(app: import("@playwright/test").ElectronApplication) {
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const calls: string[] = [];
    (globalThis as unknown as { __liteCalls: string[] }).__liteCalls = calls;
    let maximized = false;
    let minimized = false;
    Object.assign(w, {
      isMaximized: () => maximized,
      isMinimized: () => minimized,
      maximize: () => (calls.push("maximize"), (maximized = true), w.emit("maximize")),
      unmaximize: () => (calls.push("unmaximize"), (maximized = false), w.emit("unmaximize")),
      minimize: () => (calls.push("minimize"), (minimized = true), w.emit("minimize")),
    });
  });
}

test("L10: the window is frameless; the title bar drags it, its buttons do not", async () => {
  const { app, page, close } = await launch();
  try {
    await expect(page.getByTestId("app-root")).toHaveClass(/\bis-desktop\b/);
    const shell = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return { bounds: w.getBounds(), content: w.getContentBounds(), min: w.getMinimumSize(), resizable: w.isResizable(), menu: w.isMenuBarVisible() };
    });
    // No system frame or title bar: the page fills the whole window.
    expect(shell.content).toEqual(shell.bounds);
    expect(shell.min).toEqual([400, 500]);
    expect(shell.resizable).toBe(true);
    expect(shell.menu).toBe(false);
    const regions = await page.evaluate(() => {
      const region = (sel: string) => getComputedStyle(document.querySelector(sel)!).getPropertyValue("-webkit-app-region");
      return { title: region(".l-title"), assistant: region("#chatbtn"), buttons: [...document.querySelectorAll(".l-wc button")].map((b) => getComputedStyle(b).getPropertyValue("-webkit-app-region")) };
    });
    expect(regions).toEqual({ title: "drag", assistant: "no-drag", buttons: ["no-drag", "no-drag", "no-drag"] });
    // The title bar sits at the window's top edge (no backdrop margin in the app).
    expect(await page.locator(".l-title").boundingBox()).toMatchObject({ x: 0, y: 0 });
  } finally {
    await close();
  }
});

test("L10: maximize and restore toggle the window and the icon; double-click on the title bar does too", async () => {
  const { app, page, close } = await launch();
  try {
    await stubWindowManager(app);
    const wc = page.getByRole("group", { name: "Window" });
    await expect(wc.getByRole("button")).toHaveText(["", "", ""]);
    await expect(wc.getByRole("button", { name: "Maximize" })).toHaveAttribute("data-maximized", "false");
    const path = () => wc.locator("button").nth(1).locator("path").getAttribute("d");
    expect(await path()).toBe("M6 6h12v12H6z");

    await wc.getByRole("button", { name: "Maximize" }).click();
    await expect.poll(async () => (await winState(app)).maximized).toBe(true);
    const restore = wc.getByRole("button", { name: "Restore" });
    await expect(restore).toHaveAttribute("data-maximized", "true");
    expect(await path()).toBe("M6 9h9v9H6zM9 9V6h9v9h-3");

    await restore.click();
    await expect.poll(async () => (await winState(app)).maximized).toBe(false);
    await expect(wc.getByRole("button", { name: "Maximize" })).toHaveAttribute("data-maximized", "false");
    expect(await path()).toBe("M6 6h12v12H6z");

    // Double-click on the title bar (not on a button). On Windows the system handles it in the
    // drag region; here the page's handler does.
    await page.locator(".l-tp").dispatchEvent("dblclick");
    await expect.poll(async () => (await winState(app)).maximized).toBe(true);
    await expect(wc.getByRole("button", { name: "Restore" })).toBeVisible();
    await page.locator(".l-title").dispatchEvent("dblclick");
    await expect.poll(async () => (await winState(app)).maximized).toBe(false);
    // A double-click on a title bar button is not a title bar double-click.
    await page.locator("#chatbtn").dispatchEvent("dblclick");
    await page.waitForTimeout(300);
    expect(await winState(app)).toEqual({ maximized: false, minimized: false, calls: ["maximize", "unmaximize", "maximize", "unmaximize"] });
  } finally {
    await close();
  }
});

test("L10: minimize minimizes; close closes the window and quits (for real)", async () => {
  const { app, page, close } = await launch();
  try {
    await stubWindowManager(app);
    await page.getByRole("button", { name: "Minimize" }).click();
    await expect.poll(async () => await winState(app)).toEqual({ maximized: false, minimized: true, calls: ["minimize"] });
    // The bridge has the three actions only (no destroy, setBounds, ...; main.cjs ignores any other action).
    expect(await page.evaluate(() => typeof (window as unknown as { lite: Record<string, unknown> }).lite.destroy)).toBe("undefined");

    const exited = new Promise<number | null>((resolve) => app.process().once("exit", (code) => resolve(code)));
    await page.getByRole("button", { name: "Close" }).click();
    expect(await exited).toBe(0);
  } finally {
    await close();
  }
});

test("L10: the window buttons stay under 900px (the only way to close a frameless window)", async () => {
  const { app, page, close } = await launch();
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(600, 700));
    await expect(page.getByRole("tablist")).toBeVisible();
    for (const name of ["Minimize", "Maximize", "Close"]) await expect(page.getByRole("button", { name })).toBeVisible();
    await expect(page.locator("#chatbtn")).toBeHidden();
  } finally {
    await close();
  }
});

test("L06: the model view renders the sample GLB in the app, from lite://app/ only", async () => {
  const { page, output, close } = await launch();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  try {
    await page.getByRole("button", { name: "Palletizer frame v4", exact: true }).click();
    await expect(page.locator(".l-viewport")).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
    // Non-blank: some canvas pixels differ from its corner (the viewport background shows through).
    const drawn = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(".l-viewport canvas")!;
      const copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      const g = copy.getContext("2d")!;
      g.drawImage(c, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n / (c.width * c.height);
    });
    expect(drawn).toBeGreaterThan(0.05);
    expect(requests.some((u) => /^lite:\/\/app\/assets\/m1-[\w-]+\.glb$/.test(u))).toBe(true);
    expect(requests.filter((u) => !/^(lite:\/\/app\/|data:|blob:)/.test(u))).toEqual([]);
    expect(output()).not.toContain("[lite] blocked");
  } finally {
    await close();
  }
});
