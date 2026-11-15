import { _electron as electron, type ElectronApplication } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("..", import.meta.url));

// Chromium's own sandbox can't start as root on Linux (the cloud box, some CI).
// This only affects how the test launches Electron; the page sandbox setting is asserted in shell.spec.ts.
const rootOnLinux = process.platform === "linux" && process.getuid?.() === 0;

export interface LaunchOptions {
  /** `COLLIDE_DEV_URL`: load the editor from the Vite dev server. */
  devUrl?: string;
  /** `COLLIDE_FAKE_CAPTURE=1`: the snip freezes a fixed four-colour frame instead of the real screen. */
  fakeCapture?: boolean;
  /** Text of settings.json to put in the user-data folder before the app starts. */
  settings?: string;
}

export interface Launched {
  app: ElectronApplication;
  /** The app's own, empty, user-data folder: settings.json is written here. */
  userData: string;
  /** Close the app and delete its user-data folder. */
  close(): Promise<void>;
}

export async function launch(options: LaunchOptions = {}): Promise<Launched> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "COLLIDE_DEV_URL" && key !== "COLLIDE_FAKE_CAPTURE") env[key] = value;
  }
  if (options.devUrl) env.COLLIDE_DEV_URL = options.devUrl;
  if (options.fakeCapture) env.COLLIDE_FAKE_CAPTURE = "1";

  const userData = join(mkdtempSync(join(tmpdir(), "collide-e2e-")), "user-data");
  if (options.settings !== undefined) {
    mkdirSync(userData, { recursive: true });
    writeFileSync(join(userData, "settings.json"), options.settings);
  }
  const app = await electron.launch({ args: [appDir, `--user-data-dir=${userData}`, ...(rootOnLinux ? ["--no-sandbox"] : [])], env });
  return {
    app,
    userData,
    close: async () => {
      // The app may already have quit (a test that closes the editor).
      await app.close().catch(() => undefined);
      rmSync(join(userData, ".."), { recursive: true, force: true });
    },
  };
}
