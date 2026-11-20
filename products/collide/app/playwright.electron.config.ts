import { defineConfig } from "@playwright/test";

// Electron shell smoke test: `pnpm e2e:electron` (builds first).
// Separate from `pnpm e2e` (browser, playwright.config.ts) so that suite is unchanged.
// Linux needs a display: `xvfb-run -a pnpm e2e:electron`.
export default defineConfig({
  testDir: "e2e-electron",
  workers: 1,
  use: { trace: "off" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
  },
});
