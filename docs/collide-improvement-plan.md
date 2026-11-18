# Collide: improvement plan

Updated 2026-11-18 · **Draft (not yet approved by Grant).** Nothing here changes a decision, price or number. Items marked (A) are assumptions; items in `[brackets]` are placeholders.

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
