import { defineConfig } from "vite";

// The renderer (index.html → dist/). Fonts come from ../prototype/system-kit/fonts,
// hence fs.allow. Electron 33 is Chromium 130.
export default defineConfig({
  clearScreen: false,
  build: { outDir: "dist", target: "chrome130" },
  server: { port: 1430, strictPort: true, fs: { allow: [".."] } },
  preview: { port: 4330, strictPort: true },
});
