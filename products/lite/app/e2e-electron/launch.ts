import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("..", import.meta.url));

// Chromium's own sandbox can't start as root on Linux (the cloud box, some CI).
// This only affects how the test launches Electron; the page sandbox setting is asserted in window.spec.ts.
const rootOnLinux = process.platform === "linux" && process.getuid?.() === 0;

export interface Launched {
  app: ElectronApplication;
  page: Page;
  /** Everything the main process wrote to stdout and stderr so far (the request guard logs there). */
  output(): string;
  /** Close the app and delete its user-data folder. */
  close(): Promise<void>;
}

/** Starts the built app (`pnpm build` first) with its own empty user-data folder. */
export async function launch(): Promise<Launched> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "LITE_DEV_URL") env[key] = value;
  }
  const home = realpathSync(mkdtempSync(join(tmpdir(), "lite-e2e-")));
  const app = await electron.launch({ args: [appDir, `--user-data-dir=${join(home, "user-data")}`, ...(rootOnLinux ? ["--no-sandbox"] : [])], env });
  let output = "";
  app.process().stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  app.process().stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const page = await app.firstWindow();
  return {
    app,
    page,
    output: () => output,
    close: async () => {
      await app.close().catch(() => undefined);
      rmSync(home, { recursive: true, force: true });
    },
  };
}
