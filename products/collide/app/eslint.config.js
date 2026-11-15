import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-electron", "release", "node_modules", "src-tauri/target", "src-tauri/gen"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { Buffer: "readonly", URL: "readonly", console: "readonly", process: "readonly" } },
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
        Buffer: "readonly",
        URL: "readonly",
        Response: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
