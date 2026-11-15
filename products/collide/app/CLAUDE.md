# CLAUDE.md — Collide app

Electron (Node main process) + React 18 + TypeScript (strict) + Vite. Package manager: pnpm. Run all commands from this folder.

## Commands
- `pnpm install` — install deps
- `pnpm dev` — Vite dev server on :1420 (browser)
- `pnpm electron:dev` — Electron window on the Vite dev server (needs a display; as root on Linux add `--no-sandbox`)
- `pnpm dist` — build + portable Windows `.exe` in `release/` (electron-builder)
- `pnpm build` — typecheck + production build to `dist/`, then `pnpm build:electron`
- `pnpm build:electron` — main-process bundle: `src/native/` + `src/snip/crop.ts` → `dist-electron/native.cjs` (`electron/main.cjs` loads it; `pnpm electron:dev` builds it first)
- `pnpm lint` — ESLint (flat config, typescript-eslint)
- `pnpm test` — Vitest (jsdom), files `src/**/*.test.ts(x)`
- `pnpm e2e` — Playwright, chromium only, starts the dev server; uses `/opt/pw-browsers/chromium` if present. Do not run `playwright install` in the cloud box.
- `pnpm e2e:electron` — build + Electron e2e (`e2e-electron/`: shell, bridge, the snip with a fake capture, markup save and open); on Linux run `xvfb-run -a pnpm e2e:electron`. Each test starts the app with its own empty user-data folder and its own Documents folder (set with Electron's `app.setPath`; the folder dialog is replaced from the test, so the app has no test hook for either). `COLLIDE_FAKE_CAPTURE=1` (ignored by a packaged app) swaps the screen grab for a fixed four-colour frame
- `pnpm ref` — the reference harness (RUN3 T30): every spec in `reference/specs/` runs against `../layout-prototype.html` and against the app (the Vite build under `vite preview`, port 4173), then prints per spec `prototype ✓/✗ · app ✓/✗`. `pnpm ref:prototype` and `pnpm ref:app` run one side. How to write a spec: `../prototype-checks/README.md`; the test hook: `../prototype-checks/HOOK.md`

## Prerequisites
Node and pnpm only. No Rust toolchain, no `xcap` and no extra system packages: `pnpm install` downloads Electron. Vitest and `pnpm e2e` need no display; `pnpm electron:dev` and `pnpm e2e:electron` need one (`xvfb-run -a` on Linux).

## Layout
- `src/` — React frontend (`main.tsx` imports `../../design-system/styles.css`)
- `e2e/` — Playwright specs
- `reference/` — the reference harness: `playwright.config.ts` (projects `prototype` and `app`), `fixture.ts` (`open`, `reload`, `state`, `shots`), `reporter.ts`, `specs/`; output in `reference-out/` (not committed)
- `src/editor/refState.ts` — what `window.__collide.state()` returns, the read-only test hook the prototype has too
- `electron/` — Electron shell: `main.cjs` (thin: windows, protocol, wiring), `preload.cjs` (`window.collide`; self-contained, a sandboxed preload can only require `electron`), `icons/` (generated from `../design-system/assets/logo/`)
- `src/native/` — main-process logic in TypeScript, unit-tested with fakes (Electron modules are passed in, never imported): capture, IPC table, shell guards, the snip's window moves (`windows.ts`), `settings.json` and the global hotkey (`settings.ts`; the file is in Electron's user-data folder), `copyImage` (`clipboard.ts`), markup folders and the Open dialog (`markups.ts`: every path is resolved and checked against `Documents/Collide/Markups`, anything outside is refused); `bridge.ts` is the type of `window.collide`
- `src/io/` — markup storage behind the `MarkupStore` interface: `electronStore.ts` (the Electron app, over `window.collide.markups`), the memory store in `markupStore.ts` (browser, e2e)
- `src/snip/electronDeps.ts` — the snip flow's wiring to `window.collide`; `isDesktop()` is true in the Electron app
- `../design-system/` — tokens and components (source of truth)

## Rules
- Use design-system tokens only (`var(--...)`); no hardcoded colors, fonts, spacing, radii or motion values. Never redraw the logo.
- No new dependencies without Planner approval logged in `../PLAN.md`.
- Every task ships with tests. Commit messages start with the task ID (`T04: ...`).
- Never commit secrets, `node_modules`, `dist`, `dist-electron` or `release`.

## Rust tests → Vitest (T17)
The Rust shell (`src-tauri/`) was removed in T17. Each of its 20 `cargo` tests has a Vitest test with the same name, in a `describe` named after the Rust file ("`<file>.rs` tests, ported"). A leftover local `src-tauri/` folder (build output) can be deleted.

| # | Rust file | Rust test | Vitest file |
| --- | --- | --- | --- |
| 1 | `capture.rs` | `success_returns_png_of_monitor_size_and_stores_frame` | `src/native/capture.test.ts` |
| 2 | `capture.rs` | `failure_returns_typed_error_and_leaves_state_unchanged` | `src/native/capture.test.ts` |
| 3 | `capture.rs` | `error_serializes_to_cause_and_fix_message` | `src/native/capture.test.ts` |
| 4 | `crop.rs` | `integer_boxes_at_each_scale` | `src/snip/crop.test.ts` |
| 5 | `crop.rs` | `fractional_logical_coords_round_outward` | `src/snip/crop.test.ts` |
| 6 | `crop.rs` | `zero_or_negative_size_is_an_error` | `src/snip/crop.test.ts` |
| 7 | `crop.rs` | `invalid_numbers_are_errors` | `src/snip/crop.test.ts` |
| 8 | `crop.rs` | `partially_outside_box_clamps` | `src/snip/crop.test.ts` |
| 9 | `crop.rs` | `fully_outside_box_errors` | `src/snip/crop.test.ts` |
| 10 | `crop.rs` | `monitor_origin_does_not_affect_local_coordinates` | `src/snip/crop.test.ts` |
| 11 | `crop.rs` | `no_capture_held_errors_with_fix` | `src/snip/crop.test.ts` |
| 12 | `crop.rs` | `end_to_end_capture_then_crop_takes_pixels_from_the_right_region` | `src/snip/crop.test.ts` |
| 13 | `lib.rs` | `fs_capability_is_scoped_to_markups_folder` | `src/native/markups.test.ts` (the scope is now code: every fs call of the store is checked against `Documents/Collide/Markups`) |
| 14 | `lib.rs` | `app_name_is_collide` | `src/native/lib.test.ts` |
| 15 | `lib.rs` | `command_chain_capture_then_crop_yields_expected_png` | `src/native/lib.test.ts` |
| 16 | `settings.rs` | `missing_file_is_created_with_defaults` | `src/native/settings.test.ts` |
| 17 | `settings.rs` | `valid_custom_hotkey_is_used` | `src/native/settings.test.ts` |
| 18 | `settings.rs` | `invalid_hotkey_falls_back_with_fix_message` | `src/native/settings.test.ts` |
| 19 | `settings.rs` | `corrupt_json_falls_back` | `src/native/settings.test.ts` |
| 20 | `settings.rs` | `win_shift_s_is_rejected` | `src/native/settings.test.ts` |
