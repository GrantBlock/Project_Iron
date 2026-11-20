# CLAUDE.md — Collide app

Electron (Node main process) + React 18 + TypeScript (strict) + Vite. Package manager: pnpm. Run all commands from this folder.

## Commands
- `pnpm install` — install deps
- `pnpm dev` — Vite dev server on :1420 (browser)
- `pnpm electron:dev` — Electron window on the Vite dev server (needs a display; as root on Linux add `--no-sandbox`)
- `pnpm dist` — build + the Windows **web installer** (`release/nsis-web/Collide-Setup-<version>.exe`, under 1 MB: it downloads `collide-<version>-x64.nsis.7z` from the update feed and installs per-user, no admin), `latest.yml` (the update feed file) and the portable `release/Collide-<version>-portable.exe` (electron-builder). `pnpm dist:offline` builds a self-contained installer instead (no download, no updates).
- `pnpm release` — upload the `pnpm dist` output to Cloudflare R2 (bucket `collide-releases`, folder `windows/`, public at `build.publish[0].url`): package and installers first, `latest.yml` last, plus stable `Collide-Setup.exe` and `Collide-portable.exe`. Needs `CLOUDFLARE_API_TOKEN` (R2 Edit); in the Project_Iron cloud environment the proxy adds it: `NODE_USE_ENV_PROXY=1 CLOUDFLARE_API_TOKEN=proxy-injected pnpm release`. **Bump `version` in package.json first**, or installed copies see nothing new. The installed app checks the feed on start and every 6 hours (Settings → Updates; `src/native/updates.ts`, electron-updater in `dist-electron/updater.cjs`); the portable exe and dev builds do not update. From Linux it needs Wine (`apt-get install -y wine64 wine`) so the exe gets Collide's icon, name and version; unsigned (Windows shows "Windows protected your PC" → More info → Run anyway). What to send coworkers: `../INSTALL.md`
- `pnpm build` — typecheck + production build to `dist/`, then `pnpm build:electron`
- `pnpm build:electron` — main-process bundle: `src/native/` + `src/snip/crop.ts` → `dist-electron/native.cjs` (`electron/main.cjs` loads it; `pnpm electron:dev` builds it first)
- `pnpm lint` — ESLint (flat config, typescript-eslint)
- `pnpm test` — Vitest (jsdom), files `src/**/*.test.ts(x)`
- `pnpm e2e` — Playwright, chromium only, starts the dev server; uses `/opt/pw-browsers/chromium` if present. Do not run `playwright install` in the cloud box.
- `pnpm e2e:electron` — build + Electron e2e (`e2e-electron/`: shell, bridge, the snip with a fake capture, markup save and open, storage and retention); on Linux run `xvfb-run -a pnpm e2e:electron`. Each test starts the app with its own empty user-data folder and its own Documents folder (set with Electron's `app.setPath`; the folder dialog is replaced from the test, so the app has no test hook for either). `COLLIDE_FAKE_CAPTURE=1` (ignored by a packaged app) swaps the screen grab for a fixed four-colour frame
- `pnpm ref` — the reference harness (RUN3 T30): every spec in `reference/specs/` runs against `../layout-prototype.html` and against the app (the Vite build under `vite preview`, port 4173), then prints per spec `prototype ✓/✗ · app ✓/✗`. `pnpm ref:prototype` and `pnpm ref:app` run one side. How to write a spec: `../prototype-checks/README.md`; the test hook: `../prototype-checks/HOOK.md`

## Prerequisites
Node and pnpm only. No Rust toolchain, no `xcap` and no extra system packages: `pnpm install` downloads Electron. Vitest and `pnpm e2e` need no display; `pnpm electron:dev` and `pnpm e2e:electron` need one (`xvfb-run -a` on Linux).

## Layout
- `src/` — React frontend (`main.tsx` imports `../../design-system/styles.css`)
- `e2e/` — Playwright specs
- `reference/` — the reference harness: `playwright.config.ts` (projects `prototype` and `app`), `fixture.ts` (`open`, `reload`, `state`, `shots`), `reporter.ts`, `specs/`; output in `reference-out/` (not committed)
- `src/shell/` — the layout shell (RUN3 T31, after `../layout-prototype.html`): `Shell.tsx` (tabs, Recents, splash screens, toasts, keys, the `window.__collide` hook), `Sidebar.tsx`, `parts.tsx` (tab bar, tab header, blank canvas, splash, Settings, file tab), `tabs.ts`, `prefs.ts` (theme, delay, Add snip choice, collapsed: localStorage), `recents.ts`, `sample.ts` (the prototype's sample Recents, loaded only with `?sample`: the reference fixture passes it), `shell.css` (app tokens per theme: Light, Dark, Aura; maps the design-system names so the editor follows the theme) and `aura.css` (the 14 Aura grounds)
- `src/editor/EditorShell.tsx` — `SnipEditor`, the editor inside a Snip tab. Each tab's document, undo steps, zoom and save folder live in its `SnipSession`, owned by the shell; only the tab in front is mounted
- `src/markdown/` — the Markdown editor (RUN3 T34): `MarkdownEditor.tsx` (T49: one view, the live CodeMirror 6 page as the `Canvas`'s `underlay`; with Select the text takes the pointer except over a callout), `livePage.ts` (the CodeMirror setup: marks dimmed in place, styled headings, bold, code, pictures under their links), `cmTools.ts` (the text tools as CodeMirror transactions over `text.ts`), `text.ts` (text tools, pure), `render.ts` (markdown-it, no raw HTML; pictures only from the zip; the page drawn for Copy and Export), `page.ts` (page size, Fit, Ctrl + wheel zoom, scroll), `pagePicture.ts` (the page as a picture for Copy PNG and Export). Each tab's text, markup and view live in its `MdSession`, owned by the shell; zip files are kept in memory this session
- `src/pdf/` — the PDF editor (RUN3 T38, smallest version): `PdfEditor.tsx` (each page drawn by pdf.js as the `Canvas`'s `underlay`, page arrows and Page Up/Down, markup per page in PDF points; Save is Save as .collide; Copy PNG gives the page in front), `pdfjs.ts` (pdf.js loaded on first use, its worker bundled by Vite: no CDN, works offline and under `collide://`), `coords.ts` (PDF points ↔ canvas ↔ PDF user space through CropBox and /Rotate), `exportPdf.ts` (pdf-lib: the original PDF with each page's markup drawn on it; bubbles beside the page are moved onto it). Fixture: `tests/fixtures/two-pages.pdf` from `scripts/make-pdf-fixture.mjs`
- `src/editor/refState.ts` — what `window.__collide.state()` returns, the read-only test hook the prototype has too
- `electron/` — Electron shell: `main.cjs` (thin: windows, protocol, wiring), `preload.cjs` (`window.collide`; self-contained, a sandboxed preload can only require `electron`), `icons/` (generated from `../design-system/assets/logo/`)
- `src/native/` — main-process logic in TypeScript, unit-tested with fakes (Electron modules are passed in, never imported): capture, IPC table, shell guards, the snip's window moves (`windows.ts`), the collapsed window's size (`collapse.ts`), `settings.json` and the global hotkey (`settings.ts`; the file is in Electron's user-data folder), `copyImage` (`clipboard.ts`), markup folders and the Open dialog (`markups.ts`: every path is resolved and checked against `Documents/Collide/Markups`, anything outside is refused; `remove` deletes only Save's three files and then the folder); `bridge.ts` is the type of `window.collide`
- `src/io/` — markup storage behind the `MarkupStore` interface: `electronStore.ts` (the Electron app, over `window.collide.markups`), the memory store in `markupStore.ts` (browser, e2e); `collideFile.ts` (RUN3 T35: the `.collide` package, fflate zip: `manifest.json` checked with zod, `sources/`, `preview.png`; entry names checked before unpacking)
- `src/native/storage.ts` — RUN3 T36: storage on the server PC (Server mode; the main process is the Node side, no port): the storage folder (`Documents/Collide/Markups`, ISSUES 39) with its item count and size, "keep the newest N" in `storage.json` in user data (off by default), and `prune(open)` after each save: the oldest beyond N go, never an open item, a link or a folder with files Collide did not write; each deletion is logged to `storage.log`. Settings → Storage shows it in the Electron app (`window.collide.storage`)
- `src/native/collideFiles.ts` — RUN3 T35: `.collide` files in the main process, scoped to `Documents/Collide/Markups` like the markups, and the Open dialog (a `.collide` file or a markup's `annotations.json`)
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
