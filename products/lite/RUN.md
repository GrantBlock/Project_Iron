# Lite: run brief (build the P16 prototype as an Electron app, tested against it)

2026-11-17 · Planner (Irileth) with Grant. **Brief approved in scope by Grant 2026-11-17; schedule not set yet** (Grant picks the time after reading this file). Open questions at the bottom use the (A) defaults until Grant answers.

## Goal

Turn the approved Lite prototype (P16, approved by Grant 2026-11-11) into a working Windows desktop app on Electron. Lite is the free local app that opens a package and shows its files, a read-only viewer, search and an Assistant. It runs offline, has no login and never uploads anything (App Plan 3.2).

## The reference

- **`prototype/exports/P16-lite/index.html` is the reference.** It is copied from `GrantBlock/designengineering-ai`, `Builder v0.1/design/exports/P16-lite/` (commit 12163b0, 2026-11-11), with the shared files it loads (`exports/shared/`, the Overpass fonts, the favicon) at the same relative paths, so it opens from disk.
- Where the app and the prototype differ, the prototype wins unless Grant says otherwise. A Grant decision dated after the prototype wins over the prototype.
- **Tested against it** (same method as the Collide run): every acceptance spec runs first against the prototype (it must pass there, which proves the spec describes the prototype), then against the app. A spec that fails on the prototype is a bad spec, not an app bug.
- **Test hook, not internals:** the prototype and the app both get one small read-only test API, `window.__lite.state()`: the selected tree item and its path, which folders are open, the view type (about, document, model, note), the page number and page count, search query and match count, whether the Assistant is shown, the active tab under 900px, and the Assistant's message list. Specs use only this hook and visible UI.
- **Screens:** each spec takes screenshots at 1440 × 860 and 400 × 800. App screenshots are compared with the prototype's; differences above 2% of pixels (A) are listed for Grant, not failed.

## Scope decided by Grant (2026-11-17)

| Area | Decision |
| --- | --- |
| What gets built | The standalone prototype as a working Electron app. No Builder and no package format work: the prototype's sample content is built into the app. |
| Assistant | Canned answers, as in the prototype: the same sample answers, citation chips, source rows that open the page, suggested questions and composer. No on-device model (D12 stays open). |
| 3D viewer | Three.js (D8) GLB viewer: orbit, pan, zoom, fit to view, and a parts list that selects and highlights a part. |
| Sample models | Simple models generated from basic shapes to match the prototype's parts lists, marked as samples. No outside model files. |
| Where it lives | `products/lite/`, its own Electron app on Collide's stack: pnpm, Vite, TypeScript, Vitest, Playwright, ESLint, portable Windows `.exe`. No code shared with Collide yet. |
| Works for real | Search this package (text search over documents and notes, matches highlighted on the page); document pages with Previous and Next; the Files / View / Assistant tabs under 900px; Open a folder from disk (new, not in the prototype). |
| Team | Same roles and task loop as the Collide run (`../collide/SPEC.md`), with the Coder on Opus 5.5. |

## Team and models

| Role | Model | Does |
| --- | --- | --- |
| Planner (Irileth), the session itself | Opus 5.5 | Picks tasks, writes tickets, unblocks, keeps `HANDOFF.md` |
| Coder (Hrongar) | Opus 5.5, high effort (Grant 2026-11-17) | Builds each task with unit tests on `task/Lxx-<slug>` |
| Reviewer (Farengar) | Opus 5.5 | Reviews the diff against the task, the prototype and the rules below |
| Tester (Lydia) | Sonnet 5.5 | Writes the acceptance specs from the prototype first, runs them on both, takes screenshots |
| File searches | Haiku 5.5 | Read-only searches |

Task loop: as in `../collide/SPEC.md` (Coder → Reviewer → Tester, at most 2 review rounds, 2 failed Coder cycles → Blocked with a row in `ISSUES.md`). One integration branch `lite/run`, cut from `development` with this brief merged in. Each task squash-merges into `lite/run`. One pull request from `lite/run` into `development`, a draft until Grant's Windows check. No agent merges into `development` or `main`.

## Task board

| ID | Task | Acceptance check | Depends on |
| --- | --- | --- | --- |
| L01 | Scaffold: `products/lite/app/` with Electron + Vite + TypeScript, pnpm, ESLint, Vitest, Playwright (Chromium for UI specs, Electron for app specs), `pnpm dist` for a portable `.exe`, an app `CLAUDE.md`. Offline by design: content security policy allows only local files, no remote fonts, no update checks, no telemetry. | `pnpm dev` opens an empty Lite window; `pnpm test`, `pnpm lint`, `pnpm e2e` pass; an e2e test blocks all network requests and finds none | — |
| L02 | Reference harness: add `window.__lite.state()` to the prototype copy (read-only, no behaviour change) and to the app. `pnpm ref` runs each spec against `file://…/prototype/exports/P16-lite/index.html` and against the app, and reports prototype ✓ / app ✓ ✗ per spec, plus the screenshot comparison. Lydia writes the first specs from the prototype. | Every spec passes on the prototype; the app column is the work list | L01 |
| L03 | Layout shell: title bar with the Assistant button that hides and shows the right side; left side with package name and client, Search this package, and the tree (About this package, one folder per project with its documents, models and notes, collapsible and selectable, steel-blue left edge on the selected row); center with path bar and Read only tag; right side with the Assistant (On this computer). Under 900px: Files, View and Assistant tabs. Design tokens and fonts as in the prototype. | Shell and tabs specs pass on both, at desktop and phone width | L02 |
| L04 | Views: About (signed and verified notice and package details, as in the prototype); documents as page sheets with Previous and Next and the page count; notes as read-only text. The prototype's sample content is built into the app as data. | View specs pass on both | L03 |
| L05 | Search this package: real text search over documents and notes; the tree and the results show matching items; matches highlighted on the page; clearing the search restores the tree. | Search specs pass on both; unit tests for matching (case, several words, no results) | L04 |
| L06 | 3D viewer: Three.js renders a GLB in the model view with orbit, pan, zoom and fit to view; the parts list selects and highlights a part. A build script generates simple sample GLBs from basic shapes to match the prototype's parts lists, marked as samples. The prototype keeps its placeholder; specs check the parts list on both and the viewer on the app only. | Parts list specs pass on both; app e2e: the model renders (non-blank canvas), fit to view works, selecting a part highlights it | L04 |
| L07 | Assistant (canned): the prototype's sample answers, numbered citation chips and source rows that open the cited page, three suggested questions, composer. No model, no network. | Assistant specs pass on both, including a citation opening the right document page | L04 |
| L08 | Open a folder (not in the prototype): Open folder picks a folder on disk and shows it in the tree as a new package next to the sample: PDF (pdf.js, pages with Previous and Next), Markdown and text (read-only), GLB (the L06 viewer). Search covers its text files and PDF text. Read only: Lite never writes to or uploads the folder. Lydia writes the specs from this row with a fixture folder (PDF, Markdown, GLB). | Fixture folder opens, each file type shows, search finds text in the PDF and Markdown; nothing in the folder changes | L05, L06 |
| L09 | Handoff: `HANDOFF.md` (board, specs prototype / app, blocked items, usage, next task), screenshot differences in `reports/screenshot-diff.md`, Windows manual checks in `TESTER-NOTES.md`, pull request description. | Matches the final board | All attempted |

L01–L05 and L07 are **must**; L06 and L08 run if usage remains; L09 always runs last.

## Follow-up L10 (Grant 2026-11-17)

| ID | Task | Acceptance check |
| --- | --- | --- |
| L10 | Grant's decisions after the run: frameless window with the prototype's drawn buttons (minimize, maximize/restore, close, drag region); fix ISSUES 1 (the "servicing" question gets its real answer) and ISSUES 3 (folders keep their open/closed state on select and search); Markdown formatted with markdown-it, raw HTML off. | Updated specs for ISSUES 1 and 3 pass on the app and are listed as "Grant 2026-11-17 overrides the prototype" in the prototype column; frameless and Markdown e2e pass; all other specs still 47-way green |

## Rules (in addition to `../collide/SPEC.md`)

- Never change the prototype's behaviour to make a spec pass; only L02's read-only test hook may be added to it.
- No spec is weakened, skipped or deleted to get green.
- Lite makes no network requests. No sign-in, accounts, analytics or update checks.
- Lite is read-only: it never changes, moves or uploads a file it opens.
- New dependencies only from this list without asking: electron, electron-builder, vite, typescript, vitest, @playwright/test, eslint, three, pdfjs-dist (same version as Collide, 4.10.38), markdown-it (Grant 2026-11-17; same version as Collide if it has one). Anything else is a row in `ISSUES.md` for Grant.
- No real customer content, names or contact details: this repository is public. Sample content stays the prototype's.
- Pacing as in the Collide run: write the start time in `HANDOFF.md`, commit and push after every task, check push access before starting, and at a usage-limit stop park the task, update `HANDOFF.md` and push.

## Open questions for Grant (the run uses the (A) default until answered)

1. Window size: 1280 × 800 default, resizable, remembers its size (A).
2. The signed and verified notice on About: shown as sample text only, no real signature check, since there is no package format in this run (A).
3. Open folder: one folder at a time, sub-folders shown as a tree; files other than PDF, Markdown, text and GLB are listed but not opened (A).
4. Windows only for now (A; App Plan 3.2 open question).
5. App name in the title bar and the `.exe`: "Lite" with the Design Engineering mark, as in the prototype (A).
