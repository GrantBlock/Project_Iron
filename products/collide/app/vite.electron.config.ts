import { builtinModules } from "node:module";
import { defineConfig } from "vite";

// Main-process bundle: src/native (+ src/snip/crop.ts) -> dist-electron/native.cjs,
// loaded by electron/main.cjs. `pnpm build:electron`; `pnpm build` runs it too.
// Updates (Grant 2026-11-17): electron-updater is bundled on its own -> dist-electron/updater.cjs (main.cjs loads it
// only in the installed app), so the packaged app needs no node_modules. Electron and Node's modules stay external.
export default defineConfig({
  clearScreen: false,
  publicDir: false,
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    minify: false,
    target: "node20",
    lib: {
      entry: { native: "src/native/index.ts", updater: "src/native/updater.ts" },
      formats: ["cjs"],
      fileName: (_format, name) => `${name}.cjs`,
    },
    rollupOptions: {
      external: ["electron", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
    },
  },
});
