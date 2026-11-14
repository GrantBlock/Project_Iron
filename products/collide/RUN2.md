# Collide — Run 2 brief: Electron, then Collide Chat

2026-11-14 · Grant decided, Claude wrote. The Planner reads this file, `SPEC.md` (run 1's team, task loop and rules), `../../docs/unified-app-plan.md` and `HANDOFF.md`, then runs the team against this brief.

**What Collide is (Grant):** a hosted chat and product editor, custom built for Grant's multi-PC, multi-chat-session workflow in AI development.

## Decisions (Grant, 2026-11-14)

- **One app, called Collide.** Its sections are **Collide Snip** (today's editor), **Collide Chat** (today's Agent Chat) and **Collide Editor** (zip of Markdown + images, below). Future features become more sections.
- **Order:** first move Collide from Tauri to **Electron + Node** with no change in what it does; then move Agent Chat into Collide as Collide Chat.
- **Works like Agent Chat:** one Node server on **port 3500**; Server and Connected modes; a Connect screen; a tray icon; closing the window in Server mode hides it to the tray and keeps serving.
- **Server PC:** markups save automatically as you edit. The Save (push) button is greyed out there.
- **Connected PC:** sessions stay in **local storage**, listed in the **left sidebar**, each with a **save-to-server (cloud) icon**. Local storage is only for holding work until it is pushed to the server. If the server is off, unsent work stays local and retries automatically.
- **Single user:** Grant talking with Claude, plus snip storage, plus future features. No per-person logins. A required access code still protects the server, because screenshots can hold customer data.
- **AI:** chat replies run through the `claude` CLI on the server PC, at most **2 at a time**.
- **Then Collide Editor:** unpack a `.zip`, open and edit its Markdown (`.md`) files with their images, add images from snip saves, and repack the zip.
- **Phones and browsers** can open `http://<server>:3500` (view, chat, mark up; no screen capture).
- RealVNC stays for admin on the server; laptops use Connected mode for daily work.

## Branches

- Integration branch: **`collide/run-2`**, cut from `development` after this brief is merged. Task branches `task/Txx-<slug>` are cut from it and squash-merged back after the Tester passes.
- The Planner opens **one** pull request from `collide/run-2` into `development` in the morning. Grant merges. Nothing pushes to `development` or `main`.

## Dependencies approved for this run

- `electron` and `electron-builder`: the same majors as Agent Chat (`tools/project-chat/package.json`: electron ^33, electron-builder ^25). Electron has a built-in clipboard, so the Tauri clipboard plugin is **not** needed.
- Removed when T17 is done: `@tauri-apps/*`, `src-tauri/` (Rust crates `xcap`, `image`, `tauri-*`).
- The Node server uses only Node's own modules (no Express), like Agent Chat.
- Anything else needs a row in `PLAN.md` and a line in `ISSUES.md` for Grant.
- Phase D: `fflate` (zip read/write) and `markdown-it` (Markdown preview, raw HTML off) — **approved by Grant 2026-11-14**. Code files are edited as plain monospace text; no code-editor or syntax-highlight library tonight.

## Task board

Phase E (Electron, **must**) runs first. Phase C (Collide Chat, **must**) starts only when Phase E is Done. Phase D (Collide Editor) and then Phase S (stretch) run only if usage remains. T24 always runs last.

| ID | Phase | Task | Acceptance check | Depends on |
| --- | --- | --- | --- | --- |
| T13 | E | Electron shell in `products/collide/app/`: `electron/main.js` + `electron/preload.js` load the Vite build (dev: Vite server). Scripts `pnpm electron:dev`, `pnpm dist` (portable `.exe`, like Agent Chat). App id `com.blockconcepts.collide`, icons from `design-system/assets/logo/`. | `pnpm electron:dev` opens the editor; every existing `pnpm test` and `pnpm e2e` passes unchanged | — |
| T14 | E | Native bridge `window.collide` (preload, `contextIsolation` on, no Node in the page): `captureMonitor()` (desktopCapturer, display under the cursor, full physical resolution), `cropCapture(box, scale)` (move the Rust crop math and **all** `crop.rs` tests to TypeScript), `copyImage(png)` (Electron clipboard). Replace `isTauri()` with `isDesktop()` everywhere. | Crop unit tests at 100/125/150/200% scaling, negative monitor origins and zero-size boxes pass in Vitest; Copy writes an image in the Electron e2e | T13 |
| T15 | E | Snip choreography in the main process: editor hide without a ghost (`setOpacity(0)` then hide; restore position and opacity), overlay window sized to the captured display, `Ctrl+Alt+S` global shortcut from `settings.json` in the app data folder, snip delay, auto-copy after a snip. `src/snip/flow.ts` and its tests stay as they are; only `tauriDeps.ts` becomes `electronDeps.ts`. | `flow.test.ts` passes unchanged; an Electron e2e with a fake capture runs New snip → overlay → crop → editor → clipboard | T14 |
| T16 | E | Markup storage via Node `fs` in `Documents/Collide/Markups` (Open/Save dialogs via Electron `dialog`), same `MarkupStore` interface (`tauriStore.ts` → `electronStore.ts`). | `markupStore.test.ts` passes; save → close → open round-trip e2e is identical | T13 |
| T17 | E | Remove Tauri: delete `src-tauri/` and `@tauri-apps/*`, update `app/CLAUDE.md`, `SPEC.md` Tech stack (Electron + Node), and the README run steps. | Full suite green with no Tauri left (`grep -ri tauri src` is empty apart from the change log) | T14–T16 |
| T18 | C | Collide server (Node `http`, port 3500) started by Electron in Server mode. It serves the built UI at `/` and ports Agent Chat's API from `tools/project-chat/server.js`: projects, messages, `/api/events` (SSE), `/api/reports` (report-token auth), GitHub issue #2 polling, `/api/health`, `/api/info`, claude CLI replies with a **2-at-a-time queue**. Data lives in `%APPDATA%\Collide\`. | Ported Agent Chat API tests (write them from the current behaviour first) pass; two parallel asks plus a third show "queued" | T17 |
| T19 | C | First-run import from `%APPDATA%\Project Chat\`: `db.json` (projects, messages, reports), `config.json` (report token, GitHub token, poll minutes, keep-reports, owner name), the agent picture. Never deletes the old folder. If Agent Chat is still running on 3500, say "Close Agent Chat first" with the fix. | Import test with a fixture copy of an Agent Chat data folder: every message and report appears; the report token still works | T18 |
| T20 | C | **Collide Chat** UI in React with the design system: a left rail switches **Collide Snip / Collide Chat**; projects, messages, report cards, composer, typing indicator, live updates, agent picture, notifications. Feature parity with Agent Chat 0.3.6. | e2e: send a message, see the queued and typing states, receive a reply (fake CLI); a report posted to `/api/reports` appears live | T18 |
| T21 | C | Server/Connected modes like Agent Chat's `main.js`: `desktop.json`, Connect screen (design system), Test connection, Save and restart; tray (Open, Copy network link, Copy report token, Open settings folder, Connect to another computer…, Quit); close-to-tray in Server mode. A Connected window loads `http://<server>:3500` and keeps the local bridge (snip, clipboard) from T14. | e2e with two app instances (server and connected on different ports in tests): the connected one shows the server's chats; its snip uses the local capture | T19, T20 |
| T25 | D | **Collide Editor: open a zip.** Unpack a `.zip` of **any file types** (for example a zipped VS Code project) into a working folder on the server (`%APPDATA%\Collide\editor\<name>\`); show a **folder tree** in the left sidebar with sub-folder navigation (expand/collapse, breadcrumb, new file/folder, rename, move, delete). Open by type: text and code files (`.md`, `.ts`, `.json`, `.py`, `.txt`, …) in the editor; images in a viewer; any other binary shows its name, size and Download/Replace. Reject paths that escape the folder (`../`), absolute paths and oversized files (limits (A): 200 MB unpacked, 5,000 files). | Fixture zips: normal, nested folders, a `../` entry (refused with a clear message), a non-UTF-8 name | T18 |
| T26 | D | **Edit files; Markdown with images.** Every text/code file is editable (monospace, tabs kept, line endings and encoding preserved). Markdown gets a split view: text editor and live preview. Relative image links (`![](images/a.png)`) resolve inside the zip. Rename or delete images, with a warning listing the `.md` files that link to them. Autosave in the working folder (server) or local storage (Connected), like Snip. | Edit → preview updates; renaming an image warns about the links; reopen shows the edits | T25 |
| T27 | D | **Insert from snip saves.** An "Insert snip" picker lists saved markups (export PNG + name). Choosing one copies its `export.png` into the zip's `images/` folder with a unique name and inserts `![<markup name>](images/<file>.png)` at the cursor. Callout notes can go in as a numbered list under the image (option). | Insert puts the file in `images/` and the link in the `.md`; the preview shows the image | T26, T22 if done (else local `Documents/Collide/Markups`) |
| T28 | D | **Repack.** Build a new `.zip` with the same folder layout; untouched files are kept byte-for-byte; download or save-as. The original zip is never overwritten without "Replace original?". | Unpack → repack with no edits gives the same file list and identical file bytes; edited and added files are included | T25 |
| T22 | S | Markups on the server: storage API with versions; autosave on the server; on a Connected PC, a **Local** list in the left sidebar with a cloud-save icon per session, automatic retry while the server is off, and a "changed on the server" choice (open theirs / save yours as a copy) on conflicts. | Laptop snip → cloud icon → visible on the server and in a second client; conflict test | T21 |
| T23 | S | Required access code: the server generates a code; each device enters it once and gets a device token; tray **Devices…** to name and revoke. Phones and browsers ask for the code once. | Revoked token can't load or save; the report token is unchanged | T21 |
| T24 | — | Handoff: `HANDOFF.md`, test summary, Windows manual checks for Grant and Lydia (`TESTER-NOTES.md`), next steps. | Matches the final board | All attempted |

## Collide Editor: the case it must handle (Grant)

Zip a VS Code project on the server PC → leave → at a coffee shop, open Collide on a laptop (Connected over Tailscale, or a browser) → open that zip, go into its sub-folders, edit a feature spec (`.md`), insert a snip of a prototype that was just generated → repack the zip → import it into a new chat session. Phase D's end-to-end test replays this flow with a fixture project zip.

## Rules (in addition to SPEC.md's)

- **Nothing that works today may regress.** Every behaviour in `TESTER-NOTES.md` items 1–10 must still pass after Phase E.
- Agent Chat (`tools/project-chat/`) stays untouched and usable until Grant has tried Collide Chat; retiring it is a later decision.
- No secrets, tokens, access codes or IP addresses in the repository (it is public). Tests use fixtures and fake tokens.
- Windows behaviour (capture, DPI, tray, global shortcut) can't run in the cloud. Mark those checks "manual: Grant/Lydia" with exact steps; never mark them as passed.

## Grant: morning test on Windows

1. `cd products/collide/app && pnpm install && pnpm electron:dev`; then repeat items 1–10 in `TESTER-NOTES.md`.
2. Close Agent Chat, start Collide: your chats, projects and reports are all in Collide Chat; a nightly report still arrives.
3. On a laptop: install the portable `.exe`, Menu → Connect → your server address (Tailscale 100.x), then check that a snip and Copy on the laptop use the laptop's own screen and clipboard.
