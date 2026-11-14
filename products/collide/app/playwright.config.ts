import { defineConfig } from "@playwright/test";

// Chromium only. Uses the preinstalled browser when present (cloud box);
// otherwise Playwright's own downloaded Chromium.
import { existsSync } from "node:fs";
const preinstalled = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "e2e",
  // Platform-independent baselines (Chromium only).
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: "http://localhost:1420",
    trace: "off",
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
  },
});
