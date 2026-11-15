# CLAUDE.md — Collide app

Tauri v2 + React 18 + TypeScript (strict) + Vite. Package manager: pnpm. Run all commands from this folder.

## Commands
- `pnpm install` — install deps
- `pnpm dev` — Vite dev server on :1420 (browser)
- `pnpm tauri dev` — native window (needs webkit2gtk-4.1 on Linux; needs a display)
- `pnpm electron:dev` — Electron window on the Vite dev server (needs a display; as root on Linux add `--no-sandbox`)
- `pnpm dist` — build + portable Windows `.exe` in `release/` (electron-builder)
- `pnpm build` — typecheck + production build to `dist/`, then `pnpm build:electron`
- `pnpm build:electron` — main-process bundle: `src/native/` + `src/snip/crop.ts` → `dist-electron/native.cjs` (`electron/main.cjs` loads it; `pnpm electron:dev` builds it first)
- `pnpm lint` — ESLint (flat config, typescript-eslint)
- `pnpm test` — Vitest (jsdom), files `src/**/*.test.ts(x)`
- `pnpm e2e` — Playwright, chromium only, starts the dev server; uses `/opt/pw-browsers/chromium` if present. Do not run `playwright install` in the cloud box.
- `pnpm e2e:electron` — build + Electron shell smoke test (`e2e-electron/`); on Linux run `xvfb-run -a pnpm e2e:electron`
- `cd src-tauri && cargo test` — Rust tests

## Linux prerequisites
`xcap` (screen capture) needs these on Debian/Ubuntu: `apt-get install -y libpipewire-0.3-dev libxcb1-dev libxrandr-dev libdbus-1-dev libgbm-dev libclang-dev libegl1-mesa-dev` (plus webkit2gtk-4.1 for the Tauri shell). Tests use a fake capturer and need no display.

## Layout
- `src/` — React frontend (`main.tsx` imports `../../design-system/styles.css`)
- `e2e/` — Playwright specs
- `electron/` — Electron shell: `main.cjs` (thin: windows, protocol, wiring), `preload.cjs` (`window.collide`; self-contained, a sandboxed preload can only require `electron`), `icons/` (same files as `src-tauri/icons/`)
- `src/native/` — main-process logic in TypeScript, unit-tested with fakes (Electron modules are passed in, never imported): capture, IPC table, shell guards; `bridge.ts` is the type of `window.collide`
- `src-tauri/` — Rust shell (`lib.rs` has `run()`), `tauri.conf.json`, `icons/` (generated from `../design-system/assets/logo/`)
- `../design-system/` — tokens and components (source of truth)

## Rules
- Use design-system tokens only (`var(--...)`); no hardcoded colors, fonts, spacing, radii or motion values. Never redraw the logo.
- No new dependencies without Planner approval logged in `../PLAN.md`.
- Every task ships with tests. Commit messages start with the task ID (`T04: ...`).
- Never commit secrets, `node_modules`, `dist`, `dist-electron` or `target`.
