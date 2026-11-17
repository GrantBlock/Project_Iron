// `pnpm dev`: builds the main-process bundle (dist-electron/native.cjs), starts the
// Vite dev server, then opens it in an Electron window. Closing the window stops the
// server. Extra arguments go to Electron. As root on Linux, Chromium's sandbox cannot
// start, so --no-sandbox is added there (dev only).
import { spawn } from "node:child_process";
import electronPath from "electron";
import { build, createServer } from "vite";

await build({ configFile: "vite.native.config.ts", logLevel: "warn" });

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0] ?? `http://localhost:${server.config.server.port}/`;
console.log(`Lite dev server: ${url}`);

const rootOnLinux = process.platform === "linux" && process.getuid?.() === 0;
const child = spawn(electronPath, [".", ...(rootOnLinux ? ["--no-sandbox"] : []), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, LITE_DEV_URL: url },
});

const stop = async (code) => {
  await server.close();
  process.exit(code);
};
child.on("exit", (code) => void stop(code ?? 0));
child.on("error", (err) => {
  console.error(err);
  void stop(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
