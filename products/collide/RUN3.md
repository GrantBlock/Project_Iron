# Collide — Run 3 brief: build the prototype on Electron/Node, tested against it

Draft (not yet approved by Grant), 2026-11-15. Grant asked for a scheduled run that turns `layout-prototype.html` into the real app on Electron/Node and tests the app against the prototype. Nothing here runs until Grant approves this brief and the schedule in `../../docs/agentic-dev-plan.md` (Scheduled run: Collide prototype).

The Planner reads this file, `SPEC.md` (team, task loop, rules), `RUN2.md`, `HANDOFF.md`, `TESTER-NOTES.md`, the decisions dated 2026-11-15 in `../../docs/agentic-dev-plan.md`, and opens `layout-prototype.html` (its **Draft layout · notes** panel lists every behaviour).

## The reference

- **`layout-prototype.html` is the reference.** Where the app and the prototype differ, the prototype wins unless Grant says otherwise. A Grant decision dated after the prototype commit wins over the prototype.
- **Tested against it:** every acceptance spec runs twice, first against the prototype (it must pass there, which proves the spec describes the prototype), then against the app. A spec that fails on the prototype is a bad spec, not an app bug.
- **Seed:** `prototype-checks/` holds the scripts used to check the prototype. They print results; T30 turns them into asserting specs.
- **Test hooks, not internals:** both the prototype and the app expose the same small read-only test API, `window.__collide.state()` (open tabs, active tool, items in front-to-back order with type, display number and note, selection, zoom). Specs use it and visible UI only, never `window.S` or app internals.
- **Screens:** each spec also takes screenshots at 1440 × 860 and 400 × 800 in Dark, Light and Aura (Sage). The app's screenshots are compared with the prototype's; differences above [tolerance] (A: 2% of pixels) are listed for Grant, not auto-failed.

## Depends on

- **Run 2 must be merged first** (`RUN2.md`: the straight move from Tauri/Rust to Electron/Node). Run 3 builds on its Electron shell, preload bridge and Node main process.
- Answers from Grant before the first night (see Questions).

## Task board

| ID | Task | Acceptance check | Depends on |
| --- | --- | --- | --- |
| T30 | Reference harness: add `window.__collide.state()` to the prototype (read-only, no behaviour change) and to the app; a Playwright project that runs each spec against `file://…/layout-prototype.html` and against the app (Electron via Playwright's Electron support; the Vite build in Chromium for UI-only specs). Turn every `prototype-checks/` script into an asserting spec. | Every spec passes on the prototype; the harness reports per spec: prototype ✓ / app ✓ ✗ | Run 2 merged |
| T31 | Layout shell: sidebar (New snip + delay toggle, Add snip + Current/Behind toggle, Open, Search, Recents, tags), blank canvas home, tabs with changed/saved dot, close splash, delete with splash, collapse (windowed and maximized), themes Dark/Light/Aura, themed scroll bars, settings (storage, this computer, links, access password). | Shell specs pass on both | T30 |
| T32 | Markup engine (one engine for Snip and Markdown): tools Select, Rectangle, Ellipse, Line, X mark, Point, Pen, Highlighter, Eraser; 4 material colours and stroke, remembered per editor; colour deselects after a draw; resize handles (Shift keeps aspect); Esc and click-outside to Select; note bubbles with angled leaders, stacking and snapping; callout cards (type, hide text/bubble/outline, Fill %, grip reorder); front-to-back list; numbers count from the back; print area with tight margin; undo/redo; Copy. | Engine specs pass on both, in Snip | T31 |
| T33 | Images on the canvas: Add snip (Current: the open program; Behind: like New snip) and paste place images beside the base image, the canvas grows; images move, resize with aspect locked, reorder, delete. | Image and paste specs pass | T32 |
| T34 | Markdown editor: Edit (text tools: Heading, List, Table, Label, Num list, Bold, Link; live preview) and Preview (the T32 engine on the page, margins usable, Ctrl + wheel zoom, keep scroll); Insert image and paste into `images/`; Copy PNG and Export of the visible page; unsaved mark, full width, hide toolbar. | Markdown specs pass on both | T32 |
| T35 | `.collide` files: save and open, sources in their own formats plus every item and the order; reopens editable. Package layout per Grant's answer. | Round trip: save → open gives the same `__collide.state()` and the same screenshot | T33, T34 |
| T36 | Storage on the server PC (Server mode): the Node server keeps snips, zips, callouts and `.collide` files in [storage folder], deletes the oldest after [number of files]. Connected mode stays for a later run. | Storage specs pass in the app (prototype shows the settings only) | T31 |
| T38 | PDF (Grant 2026-11-15, smallest version): Open a `.pdf`; each page renders with pdf.js as a page in the T32 canvas (page tabs or arrows), marked up with the same tools, callouts and cards; Save keeps the PDF and the markup together in a `.collide`; Export writes a PDF (pdf-lib, markup drawn on each page) and Copy gives the page as PNG. No PDF text editing, forms or OCR. Specs: no prototype for PDF, so Lydia writes them from this row with a 2-page fixture PDF. | Open → mark up page 2 → save → reopen gives the same state; exported PDF has the same pages with the markup | T32, T35 |
| T37 | Handoff: `HANDOFF.md`, reference report (per spec: prototype / app), screenshot differences for Grant, Windows manual checks in `TESTER-NOTES.md`. | Matches the final board | All attempted |

T30–T34 are **must**; T35, T36 and T38 run if usage remains; T37 always runs last.

## Rules (in addition to SPEC.md's)

- Never change the prototype's behaviour to make a spec pass; only T30's read-only test hook may be added to it.
- Never weaken or skip a reference spec. If the prototype itself looks wrong, log it in `ISSUES.md` for Grant and keep the spec as the prototype behaves.
- Agent chat stays out of Collide (Grant 2026-11-15).
- Windows-only behaviour (capture, DPI, global shortcut, tray, collapse window sizes) is marked "manual: Grant/Lydia" with steps, never passed from the cloud.
- No secrets, tokens or addresses in the repository.

## Branches

Integration branch `collide/run-3`, cut from `development` after Run 2 is merged; task branches `task/Txx-<slug>`; one pull request from `collide/run-3` into `development`. Grant merges.

## Questions for Grant before the first night

1. Approve this brief, the task split and the schedule?
2. Storage: server-only, [number of files] to keep, and the folder ([storage folder], A: `%APPDATA%\Collide\`)?
3. `.collide` package layout: `manifest.json`, `sources/`, `preview.png`?
4. Screenshot tolerance: list differences above 2% of pixels (A), or fail the spec?
5. Export: source size as today, or the print area?
6. PDF: is T38's scope right (open, mark up pages, save, export PDF; no text editing or OCR)?
