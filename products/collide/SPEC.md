# Collide — Feature Spec

Nov 13, 2026 · Grant. **Named 2026-11-14:** the app is called **Collide**; Snip & Markup is its first feature, not the product name.

## Goal

Collide is a local-only Windows desktop tool to snip a screen region or open a PDF, mark it up with boxes, circles, arrows and numbered callouts, and use an AI side panel to turn those markups into action items. No cloud sync and no Liveblocks: every file stays on this PC.

**Success criteria**

- Hotkey to cropped image in the editor in under 1 second
- Markups stay editable after saving (shapes stored as data, not burned into the image)
- PDF markups export as real annotations that open in Acrobat or Bluebeam
- AI panel reads the image plus the callout list and returns a punch list or change request
- Works fully offline when the local AI model is selected

## Workflow

A snip goes from hotkey to saved markup in five steps; a PDF skips the capture and starts at step 3.

1. **Start a snip.** Click New or press the global hotkey. Rust captures the full monitor under the cursor immediately (frozen frame).
2. **Drag the region.** A transparent, fullscreen, topmost overlay shows the frozen frame dimmed. Drag a box; the size readout updates live. Release crops the frozen frame to the box (multiplied by the display scale factor). Esc cancels.
3. **Annotate.** The crop (or PDF page) opens in the editor as a locked background. Draw boxes, ellipses, arrows, text and numbered callouts on a layer above it. Each callout can carry a note.
4. **Save.** Writes the source, the shapes as JSON and a flattened export to the markup folder, and indexes it in SQLite.
5. **Ask the AI.** The side panel sends the flattened image plus the callout list. Typical asks: punch list, change request, layout suggestions. The chat is saved with the markup.

**PDF path:** File → Open PDF renders pages with pdf.js. Shapes are stored per page in PDF points so they stay aligned at any zoom. Export writes native PDF annotations (Square, Circle, FreeText) or a flattened copy.

## UI

Two screens: a snip overlay for capture and a three-pane editor for markup and AI review.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Toolbar: New snip · Open PDF · Box · Ellipse · Arrow · Text · Callout │
│          · Color · Save · Export                                      │
├────────────┬──────────────────────────────┬──────────────────────────┤
│ Library    │ Canvas                       │ AI side panel            │
│ Recent     │ Snip or PDF page, locked     │ Callout list with notes  │
│ Tags       │ Shape layer: box, ellipse,   │ Quick asks               │
│ Search     │ arrow, text, callouts 1,2,3  │ Chat thread              │
│            │                              │ Model: Ollama or Claude  │
└────────────┴──────────────────────────────┴──────────────────────────┘
```

**Snip overlay** — fullscreen, topmost, frozen frame dimmed ~50%; the dragged box shows at full brightness with a `W × H` readout; Esc cancels, release crops.

**Editor**

- **Toolbar:** New snip, Open PDF, shape tools, color/stroke, Save, Export (PNG / PDF)
- **Library (left):** recent markups, tags/projects, note search
- **Canvas (center):** locked background + editable shape layer; select, move, resize, delete; zoom/pan; page thumbnails for PDFs
- **AI side panel (right):** callout list with notes, quick-ask buttons, chat thread, model picker (Ollama or Claude), collapsible

## Tech stack

Tauri v2 with a React frontend; every library below is free for commercial use. tldraw is excluded because production use needs a paid commercial license.

| Layer | Choice | Role |
| --- | --- | --- |
| App shell | Tauri v2 (Rust + React/TypeScript) | Native window, global hotkey, file system access |
| Capture | `xcap` crate | Full-monitor capture for the frozen frame |
| Crop | `image` crate | Crop the frozen frame to the dragged box, encode PNG |
| Canvas | react-konva | Shapes, drag/resize (`Transformer`), flatten via `stage.toDataURL()` |
| PDF view | pdf.js | Render pages to canvas under the annotation layer |
| PDF export | pdf-lib | Write native annotations or flatten |
| Storage | Local folders + SQLite (`tauri-plugin-sql`) | Files per markup; index, tags, search, chat history |
| AI (offline) | Ollama + a vision-capable model | Private, free, lower quality |
| AI (cloud, optional) | Claude API | Better output; images leave the PC |

## Design system

**Added 2026-11-14 (Grant):** Collide has its own visual identity, separate from Block Concepts' brand — built from a screenshot of the Phase 1 concept mockup plus three mood references, no codebase/Figma/logo/font files provided. Lives in `design-system/` in this folder:

- `design-system/readme.md` — the full brand book: voice and copy rules, color, type, backgrounds, line work, glass borders, elevation, radii, motion, layout, density, iconography
- `design-system/tokens/*.css` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`, `base.css`; import via `design-system/styles.css`
- `design-system/components/` — React primitives: actions (Button, IconButton), forms (Input, Textarea, Select, Checkbox, Switch), display (Icon, Badge, Chip, Kbd, GlassPanel), navigation (Tabs, NavItem), feedback (Tooltip, Toast, Dialog)
- `design-system/guidelines/*.card.html` — foundation specimen cards (colors, type, spacing, glass, motion, etc.)
- `design-system/ui_kits/snip-markup/` — a working click-through of the Phase 1 editor and capture overlay already restyled in Collide (Toolbar, Sidebar, Canvas, Inspector, CaptureOverlay) — **read this before building T03–T11**; it answers most layout questions the task board doesn't spell out
- `design-system/uploads/` — the 4 source screenshots it was built from

**Identity, in brief:** near-black ink ramp (`--ink-975` to `--ink-50`), one red-orange **signal** accent (`--signal-500 #FF3D1F`) rationed to roughly one per view, **steel** blue (`--steel-500 #4C87C4`) for callout numbers/selection/info, ember copper for ambient background glow only. Geist / Geist Mono (Google Fonts substitute — ⚠ not licensed; replace `tokens/fonts.css` if real font files arrive). Signature glass-border panels, dot-grid canvas, hairlines at low alpha, square-cornered dashed selection boxes, Lucide icons (⚠ substitute, no icon set was provided). Full rules, exact values and copy voice are in `design-system/readme.md` — read it rather than this summary before implementing UI.

**Supersedes** `concept-mockup.html` in this folder (the Block Concepts-styled version made before Collide's own identity existed) — kept for history, not a build reference. `design-system/ui_kits/snip-markup/index.html` is the current one.

**Still not decided** (unchanged from Open questions below, and explicitly left out of the design system on purpose): single- vs. all-monitor capture, default AI (offline Ollama vs. Claude), and whether exports carry branding.

## Data model and storage

One folder per markup plus a single SQLite index; nothing leaves the PC unless the cloud AI option is used.

```
/Markups/2026-11-13_conveyor-hmi/
   source.png  (or source.pdf)
   annotations.json
   export.png  (or export-marked.pdf)
   chat.json
markups.db   ← title, tags, project, dates, full-text search of notes
```

Each shape in `annotations.json`:

```json
{ "id": "a1", "type": "ellipse", "page": 1, "x": 412, "y": 188, "w": 140, "h": 60,
  "stroke": "#E53935", "strokeWidth": 3, "callout": 1,
  "note": "Button misaligned with header grid" }
```

`type` = rect | ellipse | arrow | text | callout | highlight. Image coordinates are pixels; PDF coordinates are PDF points with a `page` number.

## Build phases

Five phases, each usable on its own; phase 1 runs in a browser before any desktop code exists.

| Phase | Deliverable | Done when |
| --- | --- | --- |
| 1. Editor | react-konva editor: open an image, draw shapes and callouts, save/load JSON | Markup reopens fully editable |
| 2. Snip | Tauri app, hotkey, frozen-frame overlay, drag-to-crop | Crop is pixel-accurate at 100% and 150% scaling |
| 3. PDF | pdf.js viewer + pdf-lib export | Annotations open as comments in Acrobat |
| 4. AI panel | Chat with image + callout list; Ollama and Claude API options | Returns a usable punch list from a real markup |
| 5. Library | SQLite index, tags, project filter, search | Find any markup by note text in under 2 seconds |

**Out of scope (v1):** real-time collaboration, cloud sync, video capture, auto-crop / content detection, mobile.

**Open questions**

- [ ] Capture one monitor (under cursor) or all monitors at once?
- [ ] Default AI: offline Ollama or Claude API?
- [ ] Should exports carry the Block Concepts title block / branding?

# Tonight's run — Planner brief

This section is the Planner agent's operating instructions for the overnight build. The Planner reads the whole spec above, then runs the team against this brief.

**Amended 2026-11-14 (Claude, approved by Grant):** the original brief had the task loop squash-merging straight to `main`. Project Iron's `CLAUDE.md` says agents never merge and `main` is live-releases only — Grant merges, after a pull request. This run follows that rule instead: task branches merge into this run's own integration branch, `snip-markup/run-1`, and the Planner opens one pull request from it into `development` for Grant to review in the morning. Nothing in this run pushes to `development` or `main` directly, and nothing merges without Grant. (`snip-markup/run-1` is this run's branch name only, kept as-is for continuity — the app itself is named **Collide**, per the Design system section above.)

## Mission and defaults

Ship Phase 1 (editor) as a must and Phase 2 (snip) as a stretch, with passing tests, merged into the `snip-markup/run-1` branch by morning, with one pull request open from `snip-markup/run-1` into `development` for Grant to review. Phases 3–5 (PDF, AI panel, library) are out of scope tonight.

**Priority order:** T01–T07 must finish before any Phase 2 task starts. If usage runs short, a finished Phase 1 beats a half-built Phase 2.

**Defaults for tonight** (settle the open questions until Grant says otherwise):

- Capture the monitor under the cursor only
- Global hotkey `Ctrl+Alt+S`, configurable in a settings file (avoid `Win+Shift+S`, owned by Windows)
- No AI panel code tonight; leave an empty right-side pane as a placeholder
- No branding on exports
- Target OS: Windows 11; code must also build on macOS/Linux so agents can run tests anywhere
- Package manager `pnpm`; TypeScript strict mode; no dependencies beyond the Tech stack table plus test tooling (Vitest, Playwright, `cargo test`) without Planner approval

## Team

Opus plans and unblocks; Sonnet does the volume. Every task passes Coder → Reviewer → Tester before it merges into `snip-markup/run-1`.

| Role | Model | Owns | Output |
| --- | --- | --- | --- |
| Planner | Opus 5.5 | Task order, assignments, scope calls, blockers, status board | `PLAN.md`, `HANDOFF.md`, task tickets, keeps `PROGRESS.md` current |
| Coder | Sonnet 5.5 | Implementation + unit tests for its task, on a task branch | Commits on `task/Txx-*`; logs a row in `ISSUES.md` if stuck on something only Grant can answer |
| Reviewer | Sonnet 5.5 | Diff review against acceptance criteria, the rules below, and `design-system/` (tokens, components, `ui_kits/snip-markup/`) | Approve, or a numbered fix list; logs a row in `ISSUES.md` for anything that blocks merge rather than a normal fix (a design conflict, a scope question) |
| Tester | Sonnet 5.5 (low effort) | Full test suite + the task's acceptance check; e2e tests with Playwright | Pass/fail report in `reports/Txx.md`; updates that task's row in `PROGRESS.md`'s task board |

**Task loop**

1. Planner picks the next unblocked task, writes a ticket (goal, files in scope, acceptance criteria copied from the board), and marks it "In progress" in `PROGRESS.md`.
2. Coder implements on `task/Txx-<slug>` (branched from `snip-markup/run-1`) with unit tests, then hands to Reviewer.
3. Reviewer approves or returns a fix list. Maximum 2 review rounds.
4. Tester runs `pnpm test`, `pnpm e2e` and `cargo test`, plus the task's acceptance check, and records the result in `PROGRESS.md`.
5. Pass → squash-merge the task branch into `snip-markup/run-1`, Planner marks Done in both the task board and `PROGRESS.md`. Fail → back to Coder.
6. After 2 failed Coder cycles on one task, Planner marks it Blocked in `PROGRESS.md`, adds a row to `ISSUES.md` saying what was tried and what's needed, logs the same in `HANDOFF.md`, and moves to the next independent task.

## Task board

12 tasks: T01–T07 are Phase 1 (must), T08–T11 are Phase 2 (stretch), T12 always runs last. A task is Done only when its acceptance check passes on `snip-markup/run-1`.

| ID | Phase | Task | Acceptance check | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| T01 | 1 | Repo scaffold: Tauri v2 + React + TS (Vite), pnpm, ESLint, Vitest, Playwright, `CLAUDE.md` | `pnpm tauri dev` opens an empty window; `pnpm test` and `cargo test` pass | — | Done |
| T02 | 1 | Shape model: TS types + zod schema for `annotations.json` (rect, ellipse, arrow, text, callout, highlight) | Save → load round-trip unit test; invalid JSON rejected with a clear error | T01 | Done |
| T03 | 1 | Editor canvas: image as locked background, zoom (wheel) and pan (space-drag) | Playwright loads a fixture PNG; zoom and pan do not move shapes relative to the image | T01 | Done |
| T04 | 1 | Drawing tools: rect, ellipse, arrow, text, numbered callout; select, move, resize (`Transformer`), delete | e2e draws one of each; resulting JSON matches expected types and bounds within ±2 px | T02, T03 | Done |
| T05 | 1 | Callout notes panel + undo/redo (Ctrl+Z / Ctrl+Y, 50 steps) | Note edits persist in JSON; undo/redo e2e covers draw, move, delete, note edit | T04 | Done |
| T06 | 1 | Save/open markup folder (`source.png`, `annotations.json`, `export.png`) via Tauri fs | Reopened markup is fully editable and identical to what was saved | T04 | Done |
| T07 | 1 | Export flattened PNG via `stage.toDataURL()` at source resolution | Export dimensions equal the source image; snapshot test passes | T04 | Done |
| T08 | 2 | Rust `capture_monitor`: `xcap` capture of the monitor under the cursor, held in app state | Returns PNG with monitor dimensions; error path tested when capture fails | T01 | Done |
| T09 | 2 | Rust `crop_capture(x, y, w, h, scale)` with scale factor and monitor offset | Unit tests at 100/125/150/200% scaling, negative monitor origins, and zero-size boxes | T08 | Done |
| T10 | 2 | Overlay window: transparent, fullscreen, topmost, dimmed frozen frame, drag box, `W × H` readout, Esc cancels | Overlay page runs in a browser with a fixture image; e2e drags in all 4 directions and gets a normalized box | T08 | Done |
| T11 | 2 | Wire-up: New button + `Ctrl+Alt+S` → overlay → crop → editor opens with the crop | Automated: command chain integration test. Manual: Grant on Windows | T05–T07, T09, T10 | Done |
| T12 | — | Handoff: `HANDOFF.md`, test summary, known issues, next steps | File exists on `snip-markup/run-1` and matches the board's final state | All attempted | In progress |

## Rules of engagement

The run stays on Pro limits: protect `snip-markup/run-1`, finish what you start, and leave a written trail before any limit hits.

**Code and branches**

- `snip-markup/run-1` is this run's integration branch and is always green; work only on `task/Txx-<slug>` branches cut from it, one task per branch, squash-merge back into `snip-markup/run-1` after Tester passes
- Never push to `development` or `main` directly, and never merge into either — the Planner only opens a pull request from `snip-markup/run-1` into `development`; Grant merges it
- Commit messages start with the task ID (`T04: add ellipse tool`)
- Every task ships with its tests; no task is Done on "it works on my run"
- Keep the stack from the Tech stack table; any new dependency needs Planner approval logged in `PLAN.md`
- Any UI task (T03–T05, T10, T11) uses the tokens and components in `design-system/` — colors, type, spacing, radii, motion — rather than inventing styles; `design-system/ui_kits/snip-markup/` already shows the intended look for the editor and capture overlay

**Usage budget (Pro: 5-hour session limit + weekly limit)**

- Planner uses Opus only for the initial plan, ticket writing and unblocking; everything else runs on Sonnet
- Check `/status` before starting each task; do not start a task that cannot finish in the remaining window
- Before the window runs out: commit work in progress to its branch, update `HANDOFF.md` with the board state and the next step, then stop cleanly
- Do not enable usage credits or switch to API billing

**Stop conditions** (log the reason in `HANDOFF.md`, then stop)

- All must + stretch tasks Done, and the pull request into `development` is open
- Usage limit reached
- 3 tasks Blocked in a row
- Any step would delete files outside the repo, push to a remote other than the project repo, push or merge into `development` or `main`, or need credentials

## Morning handoff

By morning `snip-markup/run-1` holds working code, a pull request from it into `development` is open for Grant to review, the board above reflects reality, and `HANDOFF.md` says exactly what to test first. Reporting for this run is GitHub only tonight — a comment on [issue #2 "Nightly report"](https://github.com/GrantBlock/Project_Iron/issues/2), signed "Lydia (Tester)" per the dev plan's agent-signature rule, not Project Chat (no bridge from the cloud build to the local app yet, and all Project Iron work reports through the same Lydia thread there, not a separate Collide project).

**The team leaves**

- `HANDOFF.md`: final board state, what merged, what's blocked and why, the next 3 tasks
- `reports/`: one Tester report per task + a full-suite summary
- `PLAN.md`: the Planner's plan with any scope changes or approved dependencies
- Status column on this board updated to match
- One pull request open: `snip-markup/run-1` → `development`

**Grant tests on Windows 11** (things agents can't verify)

- [ ] `pnpm install && pnpm tauri dev` starts the app
- [ ] Draw, move, resize and delete each shape on a real screenshot; save, close, reopen
- [ ] `Ctrl+Alt+S` opens the overlay on the monitor under the cursor (if T11 merged)
- [ ] Crop lines up with what was dragged at 100% and 150% display scaling
- [ ] Two-monitor check: snip on the second screen crops the right area
- [ ] Esc cancels cleanly; no leftover overlay window
