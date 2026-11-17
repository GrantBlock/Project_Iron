# Collide — Run 2 brief: straight move from Tauri/Rust to Electron/Node

2026-11-15 · Grant decided, Claude wrote. **Redone from the last merge** (PR #5 into `development`, `186564b`). This replaces the 2026-11-14 brief (Electron, then Collide Chat, then Collide Editor); that version is in git history.

The Planner reads this file, `SPEC.md` (run 1's team, task loop and rules), `HANDOFF.md` and `TESTER-NOTES.md`, then runs the team against this brief.

## Decisions (Grant, 2026-11-15)

- **No agent chat in Collide for now.** A project-based agent chat may come later. Agents are worked on separately from Collide. Agent Chat (`tools/project-chat/`) stays its own app, untouched.
- **Collide is Collide Snip plus the Zip editor, with storage on the server.** The layout for that is agreed in `layout-prototype.html`. It is built in later runs, not this one.
- **This run is a straight move:** the Rust shell becomes Electron with Node in the main process. **Nothing the user sees or does changes.**

## Scope

| In this run | Not in this run (later runs, below) |
| --- | --- |
| Electron shell, preload bridge, snip choreography, global shortcut, settings, clipboard, local markup storage, removing Tauri and Rust, a Windows build | Server and Connected modes, storage on the server, the new layout (blank canvas, Recents, one open item, collapse), themes (Light, Aura), the Zip editor, Markdown callouts, access code, any chat |

Markups still save to `Documents/Collide/Markups` this run, exactly as today.

## What moves where

The Rust shell (`app/src-tauri/`, 20 `cargo` tests) and the Tauri calls in the frontend map one to one.

| Today (Tauri/Rust) | After (Electron/Node) | Tests |
| --- | --- | --- |
| `capture.rs`: `capture_monitor` with `xcap`; captures the display under the cursor as a PNG, stores the frame | Main process: `screen.getCursorScreenPoint()` → `screen.getDisplayNearestPoint()`; `desktopCapturer` at full physical size (display size × `scaleFactor`); PNG kept for the crop | 3 Rust tests → Vitest with a fake capturer (success, typed error with the fix message, state unchanged on failure) |
| `crop.rs`: `crop_capture` (scale factor, outward rounding, clamping, typed errors) | `src/snip/crop.ts`: the same maths in TypeScript; main process crops the stored frame | All 9 Rust tests → Vitest, plus 100/125/150/200% scaling, negative monitor origins, zero-size boxes |
| `settings.rs`: `settings.json` in the app config folder, hotkey parse, defaults, Win+Shift+S rejected | `src/native/settings.ts` (pure, tested) + main process reads `app.getPath('userData')/settings.json` | 5 Rust tests → Vitest (missing file, custom hotkey, invalid hotkey message, corrupt JSON, Win+Shift+S) |
| `snip.rs`: `hide_editor` (moved off-screen, then hidden, so no ghost), `show_editor`, `show_overlay`, `hide_overlay` | Main process: `setOpacity(0)`, move off-screen, hide; restore position, size, maximized state and opacity; overlay `BrowserWindow` (transparent, frameless, always on top, skip taskbar) placed on the captured display's bounds | Electron e2e with a fake capture |
| `lib.rs`: global shortcut emits `collide:snip-request`; fs scoped to `Documents/Collide/Markups`; app name test | `globalShortcut.register` from settings → IPC `snip-request`; every file path checked against the Markups folder in the main process | 3 Rust tests → Vitest (path scope, app name, capture-then-crop chain) |
| `snip/tauriDeps.ts` (`invoke`, `emit`, `listen`, `isTauri`) | `snip/electronDeps.ts` with the same `SnipDeps` interface; `isDesktop()` replaces `isTauri()` | `flow.test.ts` passes **unchanged**; `tauriDeps.test.ts` → `electronDeps.test.ts` |
| `io/tauriStore.ts` (`plugin-fs`, `plugin-dialog`) | `io/electronStore.ts`: same `MarkupStore` interface; fs and `dialog.showOpenDialog` in the main process over IPC | `markupStore.test.ts` passes unchanged; save → close → open e2e identical |
| `overlay/main.tsx` Tauri events | Same events over the preload bridge | `bridge.test.ts`, `box.test.ts` pass unchanged |
| Native Windows title bar, no in-app frame (`frame.spec.ts` stub) | `BrowserWindow` with the native frame; `frame.spec.ts` stubs `window.collide` instead | `frame.spec.ts` |
| Copy and auto-copy through the web clipboard | Same; add `copyImage(png)` with Electron `clipboard.writeImage` and use it when the web clipboard is refused | `fit.spec.ts`, `snip.spec.ts` |
| `tauri.conf.json`, icons, app id `com.blockconcepts.collide` | `electron-builder` config, same app id, icons from `design-system/assets/logo/`, portable `.exe` like Agent Chat | Build runs in CI (no Windows run in the cloud) |

**Preload bridge `window.collide`** (`contextIsolation` on, `sandbox` on, no Node in the page): `captureMonitor()`, `cropCapture(box, scale)`, `hideEditor()`, `showEditor()`, `showOverlay(bounds)`, `hideOverlay()`, `copyImage(png)`, `settingsStatus()`, `onSnipRequest(cb)`, `markups.save / open / pick / list`, and the overlay events. Nothing else is exposed.

## Task board

T13–T17 are **must** and run in order. T18 runs last.

| ID | Task | Acceptance check | Depends on |
| --- | --- | --- | --- |
| T13 | Electron shell in `products/collide/app/`: `electron/main` + `electron/preload` load the Vite build (dev: the Vite server). Scripts `pnpm electron:dev` and `pnpm dist` (portable `.exe`). App id `com.blockconcepts.collide`, icons from `design-system/assets/logo/`. Tauri still present. | `pnpm electron:dev` opens the editor; every existing `pnpm test` and `pnpm e2e` passes unchanged | — |
| T14 | Bridge, capture and crop: `window.collide` as above; capture in the main process; `crop.rs` and `capture.rs` logic and **all** their tests ported to TypeScript. | Crop tests at 100/125/150/200%, negative origins and zero-size boxes pass in Vitest; capture tests pass with a fake capturer | T13 |
| T15 | Snip choreography and settings: hide without a ghost, restore exactly, overlay on the captured display, `Ctrl+Alt+S` from `settings.json`, snip delay, auto-copy. `settings.rs` ported with its tests. `tauriDeps.ts` → `electronDeps.ts`; `flow.ts` unchanged. | `flow.test.ts` passes unchanged; Electron e2e with a fake capture: New snip → overlay → crop → editor → clipboard; settings tests pass | T14 |
| T16 | Local markup storage: `electronStore.ts` with fs and dialogs in the main process, scoped to `Documents/Collide/Markups`; the path-scope test ported from `lib.rs`. | `markupStore.test.ts` passes; save → close → open round-trip e2e identical; a path outside the folder is refused | T13 |
| T17 | Remove Tauri: delete `src-tauri/`, `@tauri-apps/*` and the `tauri` script; update `app/CLAUDE.md` (commands, no Rust or `xcap` prerequisites), `SPEC.md` Tech stack (Electron + Node), README run steps. | Full suite green; `grep -ri tauri src e2e` finds nothing; no Rust toolchain needed | T14–T16 |
| T18 | Handoff: `HANDOFF.md`, test summary, Windows manual checks for Grant and Lydia in `TESTER-NOTES.md` (items 1–10 again on Electron), next steps. | Matches the final board | All attempted |

**Test count:** the last merge had Vitest 117, Playwright 39 and `cargo` 20. After the run, `cargo` is 0 and every one of the 20 Rust tests has a Vitest equivalent, so Vitest is at least 137.

## Dependencies approved for this run

- `electron` and `electron-builder` at the same majors as Agent Chat (`tools/project-chat/package.json`: electron ^33, electron-builder ^25).
- Removed: `@tauri-apps/api`, `@tauri-apps/cli`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, and the Rust crates (`tauri-*`, `xcap`, `image`).
- The main process uses only Node's and Electron's own modules. Anything else needs a row in `PLAN.md` and a line in `ISSUES.md` for Grant.

## Rules (in addition to SPEC.md's)

- **Nothing that works today may regress.** Every behaviour in `TESTER-NOTES.md` items 1–10 must still work after T17.
- Move code, don't redesign it: no UI, layout, token or copy changes in this run.
- Windows behaviour (capture, DPI, multi-monitor, global shortcut, ghost-free hide) can't run in the cloud. Mark those checks "manual: Grant/Lydia" with exact steps; never mark them as passed.
- No secrets, tokens or addresses in the repository (it is public).

## Branches

- Integration branch **`collide/run-2`**, cut from `development` after this brief is merged. Task branches `task/Txx-<slug>` are cut from it and squash-merged back after the Tester passes.
- The Planner opens **one** pull request from `collide/run-2` into `development`. Grant merges. Nothing pushes to `development` or `main`.

## Later runs (Draft, not yet approved by Grant: order and split)

Built from `layout-prototype.html` and Grant's 2026-11-15 decisions in `../../docs/agentic-dev-plan.md`.

1. **Layout shell:** blank canvas home, Recents (snips, zips, tags), one open item with Save and Close, collapse to the right (windowed and maximized), Dark, Light and Aura themes, angled callout arrows.
2. **Server and storage:** one Node server (port 3500), Server and Connected modes, storage on the server PC with automatic deletion after [number of files], a Connected PC holds new work only until it reaches the server.
3. **Zip editor:** open a zip of any files with a folder tree, edit text and code, Markdown in Preview (with box and circle callouts) or Code + preview, Canvas snip saves a marked-up area as a markup, Insert snip, repack (`fflate` and `markdown-it` were approved 2026-11-14).
4. **Access code** for other computers, phones and browsers.

## Grant: morning test on Windows

1. `cd products/collide/app && pnpm install && pnpm electron:dev`, then repeat items 1–10 in `TESTER-NOTES.md`.
2. `pnpm dist`, run the portable `.exe`, and repeat items 1, 2, 7 and 9 (capture, Copy, auto-copy, delay) at 100% and 150% scaling.
