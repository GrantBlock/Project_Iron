# Collide — Run 2 + 3 Handoff (scheduled run, `collide/run`)

## Run session 2

- Start (UTC): 2026-11-16T22:11Z · Planner (Irileth). Grant: use the remaining usage; when the limit is reached, park and stop (no auto-continue).
- T32 merged 22:40Z. The 5-hour limit hit during T33 (Coder on Opus); T33 parked at 22:51Z and the session stopped (Grant: check only, do not continue).
- Wake (hourly scheduled task) 2026-11-17T07:02Z: resuming at T33.
- T33 parked on `task/T33-canvas-images` (6 commits, not merged, no Reviewer or Tester yet). Planner check at park: lint and build pass; Vitest 388; Electron e2e 15/15; Playwright 47/48: the new `e2e/images.spec.ts:87` (pasted image beside, move, aspect-locked resize, delete, undo) fails, and that spec was committed WIP and unverified. Reference app 5/15 (order-numbers-and-eraser not passing yet). Next: fix images.spec, then Reviewer → Tester → squash.

## Run session 1

- Start (UTC): 2026-11-15T15:38Z · Planner (Irileth). Stop starting new tasks at 19:53Z (4 h 15 min).
- Usage: the 5-hour limit hit three times; each time the agent in flight was resumed, not restarted, after Grant's go-ahead:
  1. about 16:30Z during T15 (reset 18:40Z, resumed 18:41Z);
  2. about 20:40Z during T17 (reset 23:40Z per the limit notice; Grant said it had reset and work resumed about 20:50Z);
  3. during T31, before the Coder committed anything (reset 01:40Z, resumed 01:41Z; T31 restarted from a clean branch);
  4. again during T31, after 5 commits (reset 06:40Z, resumed 06:41Z); T31 merged 06:52Z.
- Session 1 stopped at 06:53Z (2026-11-16) after T31: four limit hits and well past 4 h 15 min, so no new task was started (pacing rule).
  The Fable Coder is the heaviest user: each Coder task cost roughly 120–250k tokens, Reviewer/Tester 70–120k.
- Merged at start (CLAUDE.md step 1): `claude/intelligent-brown-2hlzyu` (Agent Chat 0.4.x, `tools/project-chat/` only).

### Board

| ID | Task | Status | Specs prototype / app |
| --- | --- | --- | --- |
| T13 | Electron shell | Done (Vitest 119, Playwright 45, Electron smoke 3; Windows exe check: manual Grant/Lydia) | n/a (Phase E) |
| T14 | Bridge, capture, crop | Done (Vitest 219, Playwright 45, Electron e2e 6; capture at 100–200% and second monitor: manual Grant/Lydia) | n/a (Phase E) |
| T15 | Snip choreography, settings | Done (Vitest 286, Playwright 45, Electron e2e 13 ×2; TESTER-NOTES 1, 7, 9, real hotkey, overlay DPI: manual Grant/Lydia) | n/a (Phase E) |
| T16 | Local markup storage | Done (Vitest 319, Playwright 45, Electron e2e 15 ×2; real folder dialog, OneDrive/UNC Documents: manual Grant/Lydia) | n/a (Phase E) |
| T17 | Remove Tauri | Done (Vitest 319, Playwright 45 (2 of 3 full runs green, see ISSUES 16), Electron e2e 15; no Rust; Reviewer doc fixes applied by Planner) | n/a (Phase E) |
| T30 | Reference harness | Done (hook in prototype + app; `pnpm ref`; Vitest 327, Playwright 45, Electron e2e 15) | 15 specs: prototype 15/15 ✓ · app 0/15 (expected before T31) |
| T31 | Layout shell | Done (Vitest 368, Playwright 45 ×2, Electron e2e 15; collapsed window size, DPI: manual Grant/Lydia) | prototype 15/15 · app 3/15 (tabs-and-close-splash, delete-recents-items, sidebar-toggles) |
| T32 | Markup engine | Done (Snip; Vitest 376, Playwright 45 ×2, Electron e2e 15) | prototype 15/15 · app 5/15 (+callout-numbering, print-area-and-bubble-stacking; Esc, click-outside, colour memory, pen-highlighter pass their Snip parts and wait for T34; order-numbers waits for T33) |
| T33 | Images on canvas | Done (Vitest 388, Playwright 48 ×2, Electron e2e 16; real Current/Behind capture, DPI: manual Grant/Lydia) | prototype 15/15 · app 5/15 (order-numbers-and-eraser and paste-image now fail only at their Markdown steps → T34) |
| T34 | Markdown editor | To do | |
| T35 | `.collide` files | To do | |
| T36 | Server storage | To do | |
| T38 | PDF | To do | |
| T37 | Handoff | To do | |

### Reference specs (app column)

prototype 15/15 ✓ · app 3/15 ✓ after T31. Passing on the app: tabs-and-close-splash, delete-recents-items, sidebar-toggles. The other 12 wait for T32 (engine), T33 (images and paste), T34 (Markdown) and T35 (`.collide`). Screenshot comparison (2% tolerance (A)) not reported yet; T37 does it.

### Next (for session 2)

- **First:** T34 (Markdown editor). Target: markdown-text-tools, markdown-zoom, markdown-margin-drawing, esc-returns-to-select, click-outside-returns-to-select, pen-colour-and-thickness-memory, pen-highlighter-and-page-leaders, order-numbers-and-eraser, paste-image on the app.
- Then T35; T35, T36, T38 if usage remains; T37 last.
- Run the reference: `cd products/collide/app && pnpm ref` (per spec prototype ✓/✗ · app ✓/✗). Electron e2e needs `xvfb-run -a` in the cloud.
- Pacing: the Fable Coder hit the 5-hour limit in four of eight tasks. Have each Coder commit and push after every step, and resume a stopped agent with SendMessage rather than restarting it.
- Playwright e2e has parallel-run flakes (ISSUES 16): rerun a single failure once before treating it as real.
- Open for Grant: ISSUES 3–5, 8, 9, 11–13, 15, 17–20, 25–30 (25–30 from T31: dirty dot on new snips, splash rules, default theme System or Dark, the reversed frame test and two new bridge keys, what Recents/Add snip/Zip/Markdown tabs do for now, collapse sizing), and 21–24 (RUN3 questions 2–5; the run uses the (A) defaults).
- Windows manual checks (Grant/Lydia): TESTER-NOTES items 1–10 on `pnpm electron:dev`, then `pnpm dist` and the portable `.exe` (items 1, 2, 7, 9 at 100% and 150%); real Ctrl+Alt+S; overlay on a second monitor; real folder dialog and a folder outside Markups.

---

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

1. `cd products/collide/app && pnpm install && pnpm electron:dev` starts the app (since run 2 T17: Electron, no Rust or Tauri prerequisites).
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
