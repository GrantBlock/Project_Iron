import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Two projects (`pnpm e2e` builds first, then runs both):
// - chromium: UI specs (e2e/) against the Vite build under `vite preview` (port 4330).
//   Uses the preinstalled browser when present (cloud box); do not run `playwright install` there.
// - electron: app specs (e2e-electron/) that start the built app with Playwright's _electron.
//   They need a display: scripts/e2e.mjs wraps the run in `xvfb-run -a` on Linux without one.
const preinstalled = "/opt/pw-browsers/chromium";

export default defineConfig({
  workers: 2,
  use: { trace: "off" },
  projects: [
    {
      name: "chromium",
      testDir: "e2e",
      use: {
        browserName: "chromium",
        baseURL: "http://localhost:4330",
        launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
      },
    },
    { name: "electron", testDir: "e2e-electron" },
  ],
  webServer: {
    command: "pnpm exec vite preview",
    url: "http://localhost:4330",
    reuseExistingServer: true,
  },
});
