import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Chromium only. Uses the preinstalled browser when present (cloud box);
// otherwise Playwright's own downloaded Chromium.
const preinstalled = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "specs",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    viewport: { width: 1440, height: 860 },
    trace: "off",
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
