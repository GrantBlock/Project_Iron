# Collide — Progress Tracker

Live status board for `snip-markup/run-1`, kept current by the **Planner** as the run goes — this reflects right now, not history. `HANDOFF.md` (written at the end) and `reports/` are the historical record; don't duplicate their detail here.

**Status (Run 1, `snip-markup/run-1`):** Stopped — all tasks Done, pull request open · **Last updated:** 2026-11-14 by Planner

**Run 4 (`collide/run-4`):** Scheduled for 2:45 AM Central, 2026-11-20 · **Current task:** none yet · **Last updated:** 2026-11-19 by Planner (board below; Runs 2 and 3 are on `collide/run`, see `HANDOFF.md`)

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
| T43 | Autosave and Recents (4.1, 4.2, 8.2) | Must | Not started |
| T44 | Sidebar and Connected (5.1 to 5.4) | If usage remains | Not started |
| T45 | Header and toolbars (6.1 to 6.6) | If usage remains | Not started |
| T46 | Image list (2.1, 3.1 to 3.4) | If usage remains | Not started |
| T47 | Handoff | Always last | Not started |

## Usage

- Session time used tonight: not measurable from inside the cloud session (A) — see HANDOFF.md, Usage
- Stopped early? No — stopped because all must + stretch tasks are Done
