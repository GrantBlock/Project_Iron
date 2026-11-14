# CLAUDE.md — Collide app

Tauri v2 + React 18 + TypeScript (strict) + Vite. Package manager: pnpm. Run all commands from this folder.

## Commands
- `pnpm install` — install deps
- `pnpm dev` — Vite dev server on :1420 (browser)
- `pnpm tauri dev` — native window (needs webkit2gtk-4.1 on Linux; needs a display)
- `pnpm build` — typecheck + production build to `dist/`
- `pnpm lint` — ESLint (flat config, typescript-eslint)
- `pnpm test` — Vitest (jsdom), files `src/**/*.test.ts(x)`
- `pnpm e2e` — Playwright, chromium only, starts the dev server; uses `/opt/pw-browsers/chromium` if present. Do not run `playwright install` in the cloud box.
- `cd src-tauri && cargo test` — Rust tests

## Layout
- `src/` — React frontend (`main.tsx` imports `../../design-system/styles.css`)
- `e2e/` — Playwright specs
- `src-tauri/` — Rust shell (`lib.rs` has `run()`), `tauri.conf.json`, `icons/` (generated from `../design-system/assets/logo/`)
- `../design-system/` — tokens and components (source of truth)

## Rules
- Use design-system tokens only (`var(--...)`); no hardcoded colors, fonts, spacing, radii or motion values. Never redraw the logo.
- No new dependencies without Planner approval logged in `../PLAN.md`.
- Every task ships with tests. Commit messages start with the task ID (`T04: ...`).
- Never commit secrets, `node_modules`, `dist` or `target`.
