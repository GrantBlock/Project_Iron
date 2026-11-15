// `pnpm electron:dev`: builds the main-process bundle (dist-electron/native.cjs),
// starts the Vite dev server, then opens it in Electron.
// Closing the window stops the server. Extra arguments go to Electron.
import { spawn } from "node:child_process";
import electronPath from "electron";
import { build, createServer } from "vite";

await build({ configFile: "vite.electron.config.ts", logLevel: "warn" });

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0] ?? `http://localhost:${server.config.server.port}/`;
console.log(`Collide dev server: ${url}`);

const child = spawn(electronPath, [".", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, COLLIDE_DEV_URL: url },
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
