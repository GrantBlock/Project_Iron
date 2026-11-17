# Lite run handoff (`lite/run`)

## Run session 1

- Start (UTC): 2026-11-17T16:24Z · Planner (Irileth). Started on Grant's request ("run this now"). **No auto-resume after a usage reset** (Grant 2026-11-17): at a limit stop, park, push and stop.
- Open questions use the (A) defaults in `RUN.md`.
- Finished 17:46Z (2026-11-17). Every board task Done; nothing Blocked; no usage-limit stop in this session.

### Board

| ID | Task | Status | Specs prototype / app |
| --- | --- | --- | --- |
| L01 | Scaffold | Done (Vitest 12, Playwright 2, Electron e2e 6; Reviewer fix: UNC paths blocked; plain TS + DOM, no React (A)) | n/a |
| L02 | Reference harness | Done (47 specs; `pnpm ref`; screenshot diff report) | prototype 47/47 · app 19/47 |
| L03 | Layout shell | Done (Vitest 39, e2e 13; Electron keeps the system title bar for now, ISSUES 7) | shell 7/7 · tree 6/6 · tabs 4/7 |
| L04 | Views | Done (Vitest 44, e2e 15; About signed notice is sample text (A)) | views 7/7 · app total 29/47 |
| L05 | Search | Done (Vitest 54, e2e 16; generic search module for L08) | search 9/9 · app total 35/47 |
| L06 | 3D viewer | Done (three 0.187.0; sample GLBs via pnpm models; Vitest 71, e2e 25; Reviewer fixes: WebGL disposal, no-WebGL and 40-switch tests) | ref 47/47 (parts list both; viewer app-only e2e) |
| L07 | Assistant (canned) | Done (Vitest 61, e2e 17; answer engine behind an interface; offline test flake fixed) | assistant 11/11 · app total 47/47 |
| L08 | Open a folder | Done (pdfjs-dist 4.10.38; read-only, path checks, one-handle reads, 50 MB cap, 5000-entry cap; Vitest 95, e2e 27; Reviewer fixes: read race, listing cap) | ref 47/47; app-only fixture e2e |
| L09 | Handoff | Done (this file, `reports/screenshot-diff.md`, `TESTER-NOTES.md`, draft pull request) | — |

### Reference specs and tests (final, on `lite/run`)

- `pnpm ref`: prototype 47/47 · app 47/47 (shell 7, tree 6, views 7, search 9, assistant 11, tabs 7). Screenshots: 24 pairs at 1440 × 860 and 400 × 800, 0 above 2% (`reports/screenshot-diff.md`).
- Vitest 95 · Playwright (Chromium + Electron) 27 · lint and build clean. Electron e2e needs `xvfb-run -a` in the cloud (`pnpm e2e` does this).
- The 3D viewer (L06) and Open a folder (L08) have no prototype equivalent; they are covered by app-only e2e (viewer: render, fit, part highlight, no-WebGL, 40 model switches; folder: each file type, search, refused escape paths, files byte-identical afterwards).

### Review history

Every task went Coder → Reviewer (Farengar) → merge. Reviewer fixes applied: L01 UNC file paths blocked; L03 tree selector escaped; L06 WebGL disposal, stray screenshots, two tests; L08 one-handle reads (race), listing cap. The flaky Electron offline test (1 run in 4 since L03) was fixed in L07 without weakening it.

### Next (for Grant)

- **Pull request** `lite/run` → `development`: draft until Grant's Windows pass.
- **Windows manual checks:** `TESTER-NOTES.md`. Nothing Windows-only was checked from the cloud; `pnpm dist` has not been run.
- **Open for Grant:** ISSUES 1–4 (prototype quirks), 7 (frameless window), 9 (Markdown as plain text), and the (A) defaults in ISSUES 5, 6, 8, 10–12.
- **Not built (by design this run):** on-device AI (D12), real package format and signature check (App Plan 3.2, Builder), window size memory, `.exe` icon.
