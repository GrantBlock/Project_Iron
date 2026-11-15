// The reference harness (RUN3 T30): every spec in reference/specs runs against the prototype and the app.
//   pnpm ref              both; builds the app first (vite build)
//   pnpm ref:prototype    the prototype only; no build, no server
//   pnpm ref:app          the app only
// Anything after that goes to Playwright, e.g. `pnpm ref:prototype tabs` or `pnpm ref -g "close splash"`.
// REF_SHOTS=0 skips the screenshots.
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const target = argv[0] === "prototype" || argv[0] === "app" ? argv.shift() : null;
const run = (args, env = {}) =>
  spawnSync("pnpm", ["exec", ...args], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } }).status ?? 1;

if (target !== "prototype") {
  const built = run(["vite", "build"]);
  if (built !== 0) process.exit(built);
}
const project = target ? [`--project=${target}`] : [];
process.exit(run(["playwright", "test", "-c", "reference/playwright.config.ts", ...project, ...argv], { REF_TARGET: target ?? "all" }));
