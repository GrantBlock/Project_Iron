import { defineConfig } from "vite";

// Main-process bundle: src/native → dist-electron/native.cjs, loaded by electron/main.cjs.
// `pnpm build:native`; `pnpm build` and `pnpm dev` run it too.
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
