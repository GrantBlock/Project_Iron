# Collide — Run 4 brief: improvements from Grant's testing

2026-11-19 · Draft written by Claude from Grant's answers; approved by Grant in session 2026-11-19. Scope source: `docs/collide-improvement-plan.md`, section "Session log and scope from Grant's testing" (items 1 to 8). This brief only orders the work and records Grant's answers.

The Planner reads this file, `SPEC.md` (team, task loop, rules), `HANDOFF.md`, `ISSUES.md`, `TESTER-NOTES.md` and the decisions dated 2026-11-19 in `../../docs/agentic-dev-plan.md`.

## Grant's answers (2026-11-19)

- **Connected mode (items 5.1):** the Server / Connected layout is already in Settings, but Connected mode is not built (ISSUES 41; no network server). Add an **Enable Connected mode** button in Settings. The top-left "Connected" pill shows only when it is enabled. Off light = not connected. Green light = server reached. Assumed (A): "reached" is a simple reachability check of the address saved in Settings; with no address, or no answer, the light is off. No server or port is built in this run.
- **Save as (6.4):** TXT and MD are for Markdown tabs only; PDF is for every tab (ISSUES 43 stays open; keep the smallest PDF export).
- **Delete callout with Undo (3.3):** Undo restores the callout with its original number (A: not a renumber; ISSUES 3 stays open for the delete-without-undo case).
- **Copy on a PDF tab (6.3):** the PNG is the page nearest the centre of the view.
- **Autosave (4.1):** autosave re-saves only inside `Documents\Collide\Markups`. Never autosave onto a source file opened from elsewhere (a PDF, an image, a `.collide` file outside the folder); those need Save or Save as.
- Order and size: must-have T41 to T43 first; T44 to T46 if usage remains (A: Grant's "yes" read as approving the order proposed). The Coder is Opus 5.5.

## Rules (in addition to SPEC.md's and RUN3.md's)

- Each task gets its acceptance test first (Lydia), written from the scope item and not weakened to pass; no test is skipped.
- The app source starts at the pre-coding state; the earlier Haiku commits (`f318f73`, `22352dc`) were reverted and must not be re-applied as they were. Re-implement from the scope.
- Windows-only behaviour (crosshair look, delay, DPI, collapse sizes) is marked "manual: Grant/Lydia" with steps.
- No new dependency without a row in `PLAN.md`. No secrets, no addresses in the repository (public repository).
- Agents never merge. One pull request from `collide/run-4` into `development`.

## Task board

| ID | Task | Items | Acceptance check | Level |
| --- | --- | --- | --- | --- |
| T41 | Callout fixes | 8.1, 7.1 | Rectangle to line gives an adjustable 2-point line and back to the default rectangle; number, note and position kept both ways; line endpoint handles change the angle; arrows unchanged | Must |
| T42 | Snip capture | 1.1, 1.2 | Crosshair has more contrast (drag box unchanged); after a delayed snip the delay returns to 0s | Must |
| T43 | Autosave and Recents | 4.1, 4.2, 8.2 | First snip saves itself to `Documents\Collide\Markups` without a prompt; re-saves only inside that folder; every opened-and-saved file appears in Recents; "Close without saving" only for marked-up images | Must |
| T44 | Sidebar and Connected | 5.1 to 5.4 | New file under Open, Markdown only, also in the collapse view; collapse view shows New snip, delay, Add snip, Open, New file (no Search, no Recents); Current/Behind switch stays; Enable Connected mode button and the pill as above | If usage remains |
| T45 | Header and toolbars | 6.1 to 6.6 | Copy in the header on every tab type; Save source (`.collide`) and Save as (PNG, JPEG, TXT, MD, PDF) after the Saved/Unsaved indicator, removed from the callout toolbar; one callout toolbar for all tab types; Markdown double-row text toolbar; toolbar scrolls only when the window is too narrow; Add border on the main image only | If usage remains |
| T46 | Image list | 2.1, 3.1 to 3.4 | First snip listed as "image 1" with no delete; each Add snip image its own entry with Crop; an added snip has the original's size on screen; every callout has a delete that acts at once with Undo | If usage remains |
| T47 | Handoff | all | `HANDOFF.md`, ISSUES rows for anything new, Windows checks for Grant in `TESTER-NOTES.md`; matches the final board | Always last |

## Branches

Integration branch `collide/run-4`, cut from `claude/hopeful-rubin-82u2jg`; task branches `task/T4x-<slug>`; one pull request into `development`. Grant merges.

## Pacing

Write the start time in `HANDOFF.md`; commit and push after every task. From 4 h 15 min after the start, or at the first usage warning, start no new task: finish or park the current one, update `HANDOFF.md`, push, and post the night's report as a comment on issue #2 signed "Irileth (Planner)". Last session a Coder task cost about 200 to 350k tokens and Reviewer or Tester about 70 to 110k.
