// `pnpm e2e` (after `pnpm build`): Playwright, both projects. Extra arguments go to
// `playwright test` (e.g. `pnpm e2e --project=electron`). The Electron specs need a
// display: on Linux without one the run is wrapped in `xvfb-run -a`.
import { spawn } from "node:child_process";

const args = ["exec", "playwright", "test", ...process.argv.slice(2)];
const needsXvfb = process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
const [command, commandArgs] = needsXvfb ? ["xvfb-run", ["-a", "pnpm", ...args]] : ["pnpm", args];

const child = spawn(command, commandArgs, { stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
child.on("error", (err) => {
  console.error(needsXvfb ? `Could not start xvfb-run (install xvfb, or run with a display): ${err.message}` : err.message);
  process.exit(1);
});
