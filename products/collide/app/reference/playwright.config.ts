import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { APP_PORT, OUT_DIR, SIZES, type RefOptions } from "./targets";

// The reference harness (RUN3 T30): every spec in specs/ runs twice,
// against the prototype (file://…/layout-prototype.html) and against the app (the Vite build, in Chromium).
// Run it with `pnpm ref` (both), `pnpm ref:prototype` or `pnpm ref:app`; see ../../prototype-checks/README.md.
const appDir = fileURLToPath(new URL("..", import.meta.url));
const prototype = pathToFileURL(fileURLToPath(new URL("../../layout-prototype.html", import.meta.url))).href;
const out = `${appDir}${OUT_DIR}`;
const preinstalled = "/opt/pw-browsers/chromium";
// `pnpm ref:prototype` needs no app build and no server.
const prototypeOnly = process.env.REF_TARGET === "prototype";

export default defineConfig<RefOptions>({
  testDir: "specs",
  outputDir: `${out}/test-results`,
  // A slow machine must not turn a correct spec into a failing one.
  workers: 2,
  reporter: [["list"], ["./reporter.ts"]],
  use: {
    browserName: "chromium",
    viewport: SIZES[0],
    // A step that cannot be done fails in seconds, not at the test timeout (the app fails many specs until it is built).
    actionTimeout: 5000,
    trace: "off",
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
  },
  projects: [
    { name: "prototype", use: { target: "prototype", targetUrl: prototype } },
    { name: "app", use: { target: "app", targetUrl: `http://localhost:${APP_PORT}/` } },
  ],
  webServer: prototypeOnly
    ? undefined
    : {
        // Serves dist/, which `pnpm ref` builds first.
        command: `pnpm exec vite preview --port ${APP_PORT} --strictPort`,
        cwd: appDir,
        url: `http://localhost:${APP_PORT}`,
        reuseExistingServer: true,
      },
});
