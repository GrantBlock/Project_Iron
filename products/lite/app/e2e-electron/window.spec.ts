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

test("the shell shows in the app; the system frame has the window controls, so the drawn ones are left out", async () => {
  const { page, close } = await launch();
  try {
    await expect(page.getByRole("complementary", { name: "Package files" })).toBeVisible();
    await expect(page.getByRole("main", { name: "Viewer" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Assistant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Assistant", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".l-title .l-wc")).toHaveCount(0);
    const s = await page.evaluate(() => (window as unknown as { __lite: { state(): { selected: { id: string }; tab: unknown } } }).__lite.state());
    expect(s.selected.id).toBe("about");
    expect(s.tab).toBeNull();
  } finally {
    await close();
  }
});
