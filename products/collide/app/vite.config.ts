import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), overlay: resolve(__dirname, "overlay.html") },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: { allow: [".."] },
  },
});
