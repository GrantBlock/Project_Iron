# Collide — Run 1 Handoff

2026-11-14 · Planner. Branch `snip-markup/run-1` → pull request into `development` (Grant reviews and merges; no agent merged into `development` or `main`).

## Final board

| ID | Task | Status |
| --- | --- | --- |
| T01 | Repo scaffold | Done |
| T02 | Shape model | Done |
| T03 | Editor canvas | Done |
| T04 | Drawing tools | Done |
| T05 | Callout notes + undo/redo | Done |
| T06 | Save/open markup folder | Done |
| T07 | Export flattened PNG | Done |
| T08 | Rust capture_monitor | Done |
| T09 | Rust crop_capture | Done |
| T10 | Overlay window | Done |
| T11 | Wire-up | Done (automated); manual check pending Grant on Windows |
| T12 | Handoff | Done |

**Stop reason:** all must + stretch tasks Done; pull request open. Nothing Blocked.

## What merged

Each task squash-merged into `snip-markup/run-1` after Coder → Reviewer → Tester. The app is in `products/collide/app/` (how to run it: `app/CLAUDE.md`).

- **Phase 1 (editor):** Tauri v2 + React + TS scaffold; zod-validated `annotations.json` model; react-konva canvas with locked image, wheel zoom, space-drag pan; rect/ellipse/arrow/text/callout tools with select, move, corner resize, delete; Callouts panel with notes; 50-step undo/redo; save/open a markup folder (`source.png`, `annotations.json`, `export.png`) through Tauri fs scoped to `Documents/Collide/Markups`; flattened PNG export at source resolution.
- **Phase 2 (snip):** `capture_monitor` (xcap, monitor under the cursor); `crop_capture` with scale factor, outward rounding and clamping; capture overlay page (dimmed frozen frame, `W × H` readout that matches the crop exactly, Esc cancels); New snip and `Ctrl+Alt+S` (from `settings.json` in the app config dir) → capture → overlay → crop → editor.
- **Design system:** UI uses `design-system/` tokens; components ported to `app/src/ds/` with values unchanged; layout follows `ui_kits/snip-markup/`. Lucide icons are bundled locally so the app works offline.
- **Also on this branch:** Grant's `claude/intelligent-brown-2hlzyu` (Agent Chat 0.3.x and docs) was merged in at session start, per `CLAUDE.md` step 1, so the pull request includes those commits too.

Tests at the end: Vitest 103, Playwright 30, cargo 20, clippy clean (`reports/summary.md`).

## Planner calls made tonight (all logged in `PLAN.md`)

- App folder `products/collide/app/`; T07 ran before T06 (order only).
- Dependencies approved: zod, Tauri fs/dialog/global-shortcut plugins, xcap, image, lucide-static@0.460.0 (bundled for the offline criterion), plus test/lint tooling, `@tauri-apps/api`, `@types/*`; `base64`/`serde`/`serde_json` as direct Rust deps (already transitive via Tauri). TypeScript pinned to 5.x (typescript-eslint does not support TS 7).
- Ellipse hotkey `O`, following the UI kit (ISSUES #2).
- T11 used both review rounds; Reviewer round 2 found a hidden-window ack stall and a stale-event race. The Planner had one more Coder pass fix both and checked the diff before testing.

## Blocked

None.

## Usage

`/status` can't be read from inside a cloud session (the dev plan's Usage-limit section already flags this). The run went one task at a time on Sonnet subagents with Opus for planning and unblocking, and hit no usage warning or rate limit. The real numbers are in Grant's usage page.

## Grant: test first on Windows 11

1. `cd products/collide/app && pnpm install && pnpm tauri dev` starts the app (Linux needs the -dev packages in `app/CLAUDE.md`; Windows needs the standard Tauri prerequisites).
2. Open an image, draw, move, resize and delete each shape, add notes, undo/redo; Save (Ctrl+S), close, Open — all still editable.
3. Export PNG — same size as the source.
4. `Ctrl+Alt+S` from another app opens the overlay on the monitor under the cursor; the editor is not in the frame.
5. Crop matches the drag at 100% and 150% display scaling; the readout matches the result's size.
6. Two monitors: a snip on the second screen crops the right area (including a monitor left of/above the primary).
7. Esc cancels cleanly; no leftover overlay window.

## Open questions for Grant (`ISSUES.md`)

- #3 Renumber callouts on delete, or keep gaps?
- #4 Add a markup picker / Save As, or keep "save under Markups, open via dialog"?
- #5 Allow opening markups outside `Documents/Collide/Markups` (dialog widens scope), or restrict?
- #8 Plain click on the overlay: no-op (now) or cancel? Enable macOS transparency (`macOSPrivateApi`)?
- #9 T11 notes: overlay positioned on the monitor (not OS fullscreen); editor hides 150 ms before capture — confirm on Windows.
- Still open from the spec: export branding (none tonight), default AI (no AI code tonight).

## Next 3 tasks

1. Grant's Windows pass above; fix what it finds (especially DPI/multi-monitor crop alignment and the overlay on a second monitor).
2. Phase 3 (PDF): pdf.js page view under the shape layer with PDF-point coordinates, then pdf-lib export of native annotations.
3. Answer ISSUES #3–#5 and #8, then a small polish task (callout renumbering, Save As / markup picker), ahead of Phase 5's library.
