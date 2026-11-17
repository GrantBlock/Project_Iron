# CLAUDE.md — Lite app

Electron (Node main process) + plain TypeScript and DOM renderer (strict) + Vite. Package manager: pnpm. Run all commands from this folder. The brief, the board and the rules are in `../RUN.md`; the reference is `../prototype/exports/P16-lite/index.html`.

## Commands
- `pnpm install` — install deps (downloads Electron)
- `pnpm dev` — builds the main-process bundle, starts the Vite dev server on :1430 and opens it in the Lite window (needs a display; on Linux without one: `xvfb-run -a pnpm dev`; as root on Linux the script adds `--no-sandbox`)
- `pnpm dev:web` — the Vite dev server only, in a browser
- `pnpm build` — typecheck + renderer build to `dist/` + main-process bundle to `dist-electron/native.cjs` (`pnpm build:native`)
- `pnpm test` — Vitest (Node), files `src/**/*.test.ts`
- `pnpm lint` — ESLint (flat config, typescript-eslint)
- `pnpm e2e` — builds, then Playwright, two projects: `chromium` (UI specs in `e2e/` against the build under `vite preview` on :4330; uses `/opt/pw-browsers/chromium` if present — do not run `playwright install` in the cloud box) and `electron` (app specs in `e2e-electron/`, Playwright's `_electron` on the built app, each launch with its own empty user-data folder). `scripts/e2e.mjs` wraps the run in `xvfb-run -a` on Linux without a display. Extra arguments go to Playwright: `pnpm e2e --project=electron`
- `pnpm dist` — build + portable Windows `.exe` in `release/` (electron-builder, `Lite-<version>.exe`, no publishing, no update files). Build it on Windows; the cloud box builds and tests on Linux only

## Layout
- `index.html` — the page, with the content security policy in a `<meta>` tag
- `src/renderer/` — the renderer: `main.ts` (entry: styles, then `mountApp`), `app.ts` (`mountApp`: the Lite window; L01 an empty canvas, later tasks add the title bar, the three panes and the phone tabs as modules here), `bridge.ts` (type of `window.lite`), `styles/` (`tokens.css` copied from the prototype's `:root` with shell.css's contrast lift, `fonts.css` bundling Overpass from `../prototype/system-kit/fonts`, `base.css`)
- `electron/` — `main.cjs` (thin: window, `lite://app/` protocol, request guard, navigation guards), `preload.cjs` (sandboxed; exposes `window.lite` and nothing else; can only require `electron`)
- `src/native/` — main-process decisions in TypeScript, unit-tested in Node (Electron's modules are passed in, never imported), bundled to `dist-electron/native.cjs`: `shell.ts` (name, window options, dev URL check, `lite://` → `dist/` mapping), `csp.ts` (the policy; `csp.test.ts` checks `index.html` has the same), `network.ts` (`isLocalRequest`, the request guard)
- `e2e/` — Chromium specs; `e2e-electron/` — Electron specs (`launch.ts` starts the built app)

## Offline by design
- The build is served from `lite://app/` (a privileged local scheme), with the CSP as a header too. CSP: `'self'`, `data:`, `blob:` only; no remote scripts, styles, fonts, images or connections; inline styles allowed, inline scripts not.
- Every request of every session goes through `session.webRequest.onBeforeRequest`: `lite:`, `data:`, `blob:`, `devtools:` and local `file:///` pass (not `file://server/share`); the Vite dev server passes in dev only. Anything else is cancelled and logged as `[lite] blocked non-local request: METHOD URL (type)`.
- Pages cannot open windows, webviews or navigate off the app. Spellcheck is off (it downloads dictionaries on Linux). No update checks, no telemetry, no crash reporting, no remote fonts.

## Rules (from `../RUN.md`)
- Lite makes no network requests: no sign-in, accounts, analytics or update checks.
- Lite is read-only: it never changes, moves or uploads a file it opens.
- Never change the prototype's behaviour to make a spec pass; only L02's read-only `window.__lite.state()` hook may be added to it. No spec is weakened, skipped or deleted to get green.
- Dependencies only from this list without asking: electron, electron-builder, vite, typescript, vitest, @playwright/test, eslint, three, pdfjs-dist (4.10.38, as Collide), plus their type packages and the lint tooling Collide uses (`@eslint/js`, `typescript-eslint`, `@types/node`). Versions match Collide's lockfile. Anything else is a row in `../ISSUES.md` for Grant.
- Use the prototype's tokens (`var(--bc-...)`), never hardcoded colors, fonts, spacing or radii. No real customer content, names or contact details: this repository is public. Sample content stays the prototype's.
- Every task ships with tests. Commit messages start with the task ID (`L03: ...`). Never commit `node_modules`, `dist`, `dist-electron` or `release`.
