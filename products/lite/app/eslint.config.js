import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-electron", "release", "node_modules", "test-results", "playwright-report"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { URL: "readonly", console: "readonly", process: "readonly", Buffer: "readonly" } },
  },
  {
    // Electron main and preload: plain CommonJS run by Electron, not bundled by Vite.
    files: ["electron/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        __dirname: "readonly",
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        Headers: "readonly",
        Response: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
