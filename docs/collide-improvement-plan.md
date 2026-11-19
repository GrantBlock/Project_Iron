# Collide: improvement plan

Updated 2026-11-19 · **Draft (not yet approved by Grant)** except Grant's scope in the last section, which Run 4 builds. Nothing here changes a decision, price or number. Items marked (A) are assumptions; items in `[brackets]` are placeholders.

Source: `products/collide/` on `claude/modest-euler-bucvr2` (Collide 0.1.1, published to the Cloudflare release folder, 2026-11-17). That branch already contains `collide/run` (Runs 1 to 3) and Grant's `claude/intelligent-brown-2hlzyu`. The Collide docs (`ISSUES.md`, `HANDOFF.md`, `TESTER-NOTES.md`, `RUN2.md`, `RUN3.md`) are the record of what is open.

## 1. Where Collide stands

- **Shipped to Grant's release folder:** Windows installer (per-user NSIS), portable `.exe`, web installer, auto-updates from Cloudflare R2, Settings → Updates.
- **Built and tested in the cloud:** Snip (global Ctrl+Alt+S, overlay, crop, delay, Copy and auto-copy), markup engine (rectangle, ellipse, filled shapes, X, point, numbered callouts, notes, hide #), images on canvas (Add snip Current/Behind, Crop), Markdown editor (in memory), `.collide` files, server-side storage settings with retention, PDF (open, mark up per PDF point, Export PDF, Copy PNG).
- **Test coverage at the last handoff:** Vitest 480, Playwright 56, Electron e2e 21, reference specs 15/15 on the prototype and the app.
- **Not built yet:** zip open and save (Markdown is in memory only), Insert snip picker, Connected mode and the network server (port 3500), access code, Recents thumbnails, Light and Aura themes, the new layout shell (blank canvas home, one open item, collapse), angled callout arrows.
- **Never checked on Windows from the cloud:** every Windows item in `TESTER-NOTES.md` ("Run 2+3 (Electron)", items 1 to 12). This is the first thing to close.
- **Known flakes:** Playwright under a full parallel run (ISSUES 16); `history.spec.ts` once in a full run.

## 2. Decisions Grant still owes (from ISSUES.md)

These block or shape the work. Each needs a yes, a no, or a different answer before a coder touches it.

| Group | ISSUES # | Question |
| --- | --- | --- |
| Callouts | 3 | On delete, renumber callouts or keep gaps? |
| Markup picker | 4, 5 | Add a markup picker or Save As? Let Open read a folder outside `Documents\Collide\Markups`? (Electron currently refuses it; ISSUES 15 asks the same) |
| Overlay | 8, 9, 11, 12 | Does a plain click cancel? Is the overlay created at startup? Alt+F4 on the overlay? |
| Settings | 13 | Migrate the old Tauri hotkey setting, or reset? |
| Export | 24, 34, 43 | Export at source size (today) or the print area or crop like Copy? Does Export move side bubbles onto the page (PDF too)? |
| Snip content | 33 | Add snip Current: capture Collide, or the app behind it? |
| Markdown | 35, 36 | Keep the in-memory storage? Keep "Insert image" instead of "Insert snip"? Keep the HTML-under-canvas copy behaviour? |
| Storage | 21, 39, 40, 41 | Storage folder (today `Documents\Collide\Markups`); retention default (none today); confirm the server stays in the main process when Connected mode is built |
| Themes | 27 | System or Dark as default until Light is approved? |
| Shortcuts | 10, 19, 20, 31, 32 | Accessibility spec for shortcuts; does Enter delete; does the Markdown toolbar hide; new callout takes the cursor; bubble size per 640 px |
| Prototype | 17, 18 | Fix the prototype's tab-bar redraw and "Close without saving" behaviour too? |
| Frame | 28 | Accept the test changes for the removed in-app frame? |
| PDF | 43 | OK for the smallest PDF version? |

## 3. Work tracks (proposed order)

Tracks are proposals. Each becomes one or more issues only after Grant approves its scope.

**Track A: Windows check and fixes (first; Grant's hours)**
1. Grant runs the Windows list in `TESTER-NOTES.md` (items 1 to 12) on `pnpm electron:dev` and on the portable `.exe`, at 100% and 150%, with a second monitor.
2. Each failure becomes an ISSUES row with a screenshot. No code change before the row exists.

**Track B: Decisions and open-row cleanup**
1. Grant answers section 2 in batches. Each answer is logged as a dated `[stated]` line in `docs/agentic-dev-plan.md`.
2. Resolved rows are marked Resolved with how, never deleted.

**Track C: Test hygiene (cheap, do early)**
1. Fix the waits behind the flakes (ISSUES 16, `history.spec.ts`) so the full parallel run is green. Do not skip or weaken a test to get green.
2. Tidy the e2e temp-folder leak to the real `~/.config/Collide` (ISSUES 42b).
3. Tidy retention counting empty folders (ISSUES 42a).

**Track D: Export and markup quality** (depends on Track B decisions 24, 34, 43)
- Export and Copy agree on what is in the picture.
- Callout numbering on delete (ISSUES 3), and the callout arrow and bubble rules that follow from it.

**Track E: Later runs from `RUN2.md` (Draft there; order to confirm)**
1. Layout shell: blank canvas home, Recents, one open item, collapse, Dark and Light themes.
2. Server and storage: Node server on port 3500, Server and Connected modes, retention.
3. Zip editor: open and save real zips, Markdown in Preview with callouts, Insert snip, repack (`fflate` and `markdown-it` already approved).
4. Access code for other computers and phones.

Track E is the largest. Grant should decide whether it comes before or after Track A's Windows results.

## 4. Rules for this work

- Propose, get Grant's answer, then edit. One coder at a time; one issue per pull request into `development`.
- Acceptance tests are written before code and are not weakened to pass.
- New dependencies need Grant's approval, logged in `PLAN.md`.
- No secrets, no personal contact details in the repository (the repository is public). The install page's download links are already public.
- Agents never merge.

## 5. How to send Grant's improvements

For each improvement, one line in this format is enough:

| # | Improvement | Why (what goes wrong today) | Grant's answer needed? |
| --- | --- | --- | --- |
| I-01 | [short title] | [the problem, from Grant's use] | [yes / no / which option] |

Grant can add rows here or in the session. Each row gets an ID and a track in the next revision of this file.

## Open questions for Grant

1. Which Windows checks from `TESTER-NOTES.md` have you already run on 0.1.1, and what passed?
2. Track order: Track A first, or Track E in parallel?
3. The improvements you want to make: send them as rows in section 5.
4. Lite (`claude/practical-newton-utto9s`, `lite/run`, `task/L*`) is a separate product and has unmerged work. It was not merged into this session branch. Should it be?

---

## Session log and scope from Grant's testing (2026-11-18 to 2026-11-19)

Status: **nothing below is built.** The app source is at the pre-coding state (`68af7b2`) after a revert, so the Collide code is what it was before testing began. Every item is a requested change, confirmed by Grant in this session.

### What happened in this session
- Collide improvement plan written (Draft) and merged with the Collide release branch (0.1.1).
- Grant tested the built app and sent requests. Two rounds of code were written by a Haiku session (commits `f318f73` and `22352dc`, covering the tab header, toolbar and sidebar). Grant asked for a revert, and both commits were reverted (`794cd28`, `ff832c6`). Nothing from that coding is in the source.
- Grant's answers to the open questions are recorded in the scope below.

### Scope (Grant's answers)

**1. Snip capture**
- 1.1 Starting crosshair gets more contrast so the start point is easy to see. Drag box unchanged.
- 1.2 After a delayed snip, the delay drops back to 0s. Today it stays at 10s.

**2. Add snip**
- 2.1 An added snip is the same size as the original, measured on screen.

**3. Callout list**
- 3.1 The first snip appears as "image 1", with no delete button.
- 3.2 Each Add snip image appears as its own entry.
- 3.3 Every callout has a delete button that removes that callout. Delete acts at once, with Undo, and no confirmation.
- 3.4 Each image entry has a Crop button.

**4. Autosave and closing**
- 4.1 The first snip is saved automatically to `Documents\Collide\Markups`, with no name prompt.
- 4.2 "Close without saving" appears for marked-up images, not for autosaved originals.

**5. Header and sidebar**
- 5.1 The Connected pill appears at top left only when Connected settings are enabled. It reads "Connected". Green light = server reached. Off light = not connected.
- 5.2 Collapse view shows New snip, delay, Add snip, Open and New file. Search and the Recents list are hidden. The tab-header collapse button stays removed.
- 5.3 The Current/Behind switch stays.
- 5.4 New file is a button directly below Open, in Open's style, also shown in the collapse view. It creates Markdown files only.

**6. Toolbars**
- 6.1 The toolbar expands and contracts with the window. The scroll bar appears only when the window is too narrow to show all the icons.
- 6.2 Text editing uses a double-row toolbar, with the text tools on the second row. Markdown only. No text editing on PDFs or images.
- 6.3 Copy to clipboard is in the header on every tab type. It copies a PNG of the print area. For a long PDF, the PNG is the current page that fills most of the view area.
- 6.4 Save buttons are in the header, after the Saved / Unsaved indicator. "Save source" saves as `.collide`. "Save as" saves PNG, JPEG, TXT, MD or PDF. The save tools are removed from the callout toolbar.
- 6.5 The callout toolbar is the same on every tab type.
- 6.6 "Add border" adds a coloured border around the main image's print area. It works like a rectangle callout. Added images get no border.

**7. Line callouts**
- 7.1 Line callouts get endpoint handles, so the angle can be changed. Arrows are unchanged.

**8. Known problems (reported by Grant)**
- 8.1 Switching a rectangle callout to a line makes it disappear from the canvas. Expected: an adjustable rectangle becomes a 2-point line, and a line switched back becomes the default rectangle. The number, note and position are kept in both directions.
- 8.2 Saving a file that was opened does not add it to Recents. Expected: every file that was opened and saved appears in Recents.

### Open for the coder agent
- Items 1 to 8 are not started. Each needs its own test before it is built.
- The Windows checks from `TESTER-NOTES.md` still need Grant's run on the installed build.

### Grant's answers, 2026-11-19
Logged as dated `[stated]` lines in `docs/agentic-dev-plan.md` and in `products/collide/RUN4.md`. Run 4 builds items 1 to 8 in the order T41 to T46; T41 to T43 are must-haves. 5.1: Connected mode is not built; Settings gets an Enable Connected mode button and the pill follows it. 4.1: autosave only inside `Documents\Collide\Markups`.

### Status after the answers (2026-11-19)
- Run 4 brief: `products/collide/RUN4.md`; tickets `products/collide/tickets/T41.md` to `T47.md`; board in `products/collide/PROGRESS.md`; scheduled 2:45 AM Central 2026-11-20.
- New assumptions for Grant to confirm: `products/collide/ISSUES.md` rows 44 to 47.
- Open question 3 above is answered (the scope). Questions 1, 2 and 4 are still open: Windows checks run so far, Track A before Track E, and whether to merge the Lite branches (`docs/current-issues.md` items 9 and 11).
- Section 2 groups not covered by items 1 to 8 stay open (ISSUES 3 without Undo, 4, 5, 8, 9, 11 to 13, 21, 24, 33 to 36, 39 to 43).
