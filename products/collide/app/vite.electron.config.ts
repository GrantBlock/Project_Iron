import { defineConfig } from "vite";

// Main-process bundle: src/native (+ src/snip/crop.ts) -> dist-electron/native.cjs,
// loaded by electron/main.cjs. `pnpm build:electron`; `pnpm build` runs it too.
export default defineConfig({
  clearScreen: false,
  publicDir: false,
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    minify: false,
    target: "node20",
    lib: {
      entry: "src/native/index.ts",
      formats: ["cjs"],
      fileName: () => "native.cjs",
    },
  },
});
