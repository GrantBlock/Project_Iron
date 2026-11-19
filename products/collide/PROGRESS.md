# Collide — Progress Tracker

Live status board for `snip-markup/run-1`, kept current by the **Planner** as the run goes — this reflects right now, not history. `HANDOFF.md` (written at the end) and `reports/` are the historical record; don't duplicate their detail here.

**Status (Run 1, `snip-markup/run-1`):** Stopped — all tasks Done, pull request open · **Last updated:** 2026-11-14 by Planner

**Run 4 (`collide/run-4`):** Built 2026-11-19, T41 to T47 Done · **Current task:** none · **Last updated:** 2026-11-19 by Planner (board below; Runs 2 and 3 are on `collide/run`, see `HANDOFF.md`)

## Task board

Mirrors `SPEC.md`'s table; update the Status column here as it changes, in sync with the Planner's board there.

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
| T11 | Wire-up | Done (automated); manual pending Grant |
| T12 | Handoff | Done |

## Run 4 board (`RUN4.md`)

Scope: Grant's testing, items 1 to 8 in `../../docs/collide-improvement-plan.md`. Update the Status column as each task moves.

| ID | Task | Level | Status |
| --- | --- | --- | --- |
| T41 | Callout fixes (8.1, 7.1) | Must | Done (Hrongar, `task/T41-callout-fixes`): Vitest 507 → 515 (+8), e2e 56 → 58 (+2), ref 15/15 app; Windows look not checked from the cloud |
| T42 | Snip capture (1.1, 1.2) | Must | Done (Hrongar, `task/T42-snip-capture`): Vitest 515 → 530 (+15), e2e 58 → 59 (+1), Electron e2e 21 → 22 (+1), ref 15/15 app; crosshair look and delay on Windows are manual (TESTER-NOTES Run 4 items 1, 2); (A) choices in ISSUES 49 |
| T43 | Autosave and Recents (4.1, 4.2, 8.2) | Must | Done (Hrongar, `task/T43-autosave-recents`): Vitest 530 → 532 (+2), e2e 59 → 66 (+7), Electron e2e 22 → 24 (+2), ref 15/15 app; Windows Documents folder, Explorer and Recents on the installed build are manual (TESTER-NOTES Run 4 items 3 to 5); (A) choices in ISSUES 50 |
| T44 | Sidebar and Connected (5.1 to 5.4) | If usage remains | Done (Hrongar, `task/T44-sidebar-connected`): Vitest 532 → 546 (+14), e2e 66 → 68 (+2), Electron e2e 24 → 24, ref 15/15 app; collapse window sizes and the look on Windows are manual (TESTER-NOTES Run 4 items 7, 8); (A) choices in ISSUES 51 |
| T45 | Header and toolbars (6.1 to 6.6) | If usage remains | Done (Hrongar, `task/T45-header-toolbars`): 6.1 to 6.6 built; Vitest 546 → 565 (+19), e2e 68 → 82 (+14), Electron e2e 24 → 24, ref app 15/15 → 12/15 (three reference specs click the old toolbar's Export, Copy and Save as .collide: not edited, ISSUES 53); Windows look and the desktop Save dialog are manual (TESTER-NOTES Run 4 items 9, 10); (A) choices in ISSUES 52 |
| T46 | Image list (2.1, 3.1 to 3.4) | If usage remains | Done (Hrongar, `task/T46-image-list`): 2.1 and 3.1 to 3.4 built (Crop on image 1 included); Vitest 565 → 576 (+11), e2e 82 → 86 (+4), Electron e2e 24 → 24, ref app 12/15 (unchanged, ISSUES 53); DPI, second monitor and the Windows look are manual (TESTER-NOTES Run 4 items 11, 12); (A) choices and changed assertions in ISSUES 54 |
| T47 | Handoff | Always last | Done (Planner): `HANDOFF.md` Run 4 section, ISSUES 44 to 54, Windows checks in `TESTER-NOTES.md` |

## Usage

- Session time used tonight: not measurable from inside the cloud session (A) — see HANDOFF.md, Usage
- Stopped early? No — stopped because all must + stretch tasks are Done
