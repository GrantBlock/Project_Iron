import { _electron as electron, expect, test, type ElectronApplication } from "@playwright/test";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("..", import.meta.url));

// Chromium's own sandbox can't start as root on Linux (the cloud box, some CI).
// This only affects how the test launches Electron; the page sandbox setting is asserted below.
const rootOnLinux = process.platform === "linux" && process.getuid?.() === 0;

function launch(devUrl?: string): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "COLLIDE_DEV_URL") env[key] = value;
  }
  if (devUrl) env.COLLIDE_DEV_URL = devUrl;
  return electron.launch({ args: [appDir, ...(rootOnLinux ? ["--no-sandbox"] : [])], env });
}

test("Electron opens the editor from the Vite build", async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page).toHaveTitle("Collide");
    expect(page.url()).toBe("collide://app/");
    await expect(page.getByTestId("app-root")).toBeVisible();
    await expect(page.getByTestId("toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas")).toBeVisible();
    expect(await app.windows()).toHaveLength(1);
  } finally {
    await app.close();
  }
});

test("Electron opens the editor from the Vite dev server", async () => {
  const app = await launch("http://localhost:1420/");
  try {
    const page = await app.firstWindow();
    await expect(page).toHaveTitle("Collide");
    expect(page.url()).toBe("http://localhost:1420/");
    await expect(page.getByTestId("toolbar")).toBeVisible();
    await expect(page.getByTestId("canvas")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("the page is isolated: an empty window.collide, no Node, sandbox on", async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();

    const inPage = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return {
        collide: typeof w.collide,
        collideKeys: Object.keys((w.collide ?? {}) as object),
        require: typeof w.require,
        process: typeof w.process,
        secureContext: window.isSecureContext,
      };
    });
    expect(inPage).toEqual({
      collide: "object",
      collideKeys: [],
      require: "undefined",
      process: "undefined",
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
    await app.close();
  }
});
