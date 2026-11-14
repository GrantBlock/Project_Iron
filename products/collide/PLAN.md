# Collide — Run 1 Plan (Planner)

2026-11-14 · Planner (Opus). Follows `SPEC.md` → "Tonight's run — Planner brief". Anything not in the spec is marked `Draft (not yet approved by Grant):` or (A).

## Order

T01 → T02 → T03 → T04 → T05 → T06 → T07 (Phase 1, must) → T08 → T09 → T10 → T11 (Phase 2, stretch) → T12.
T02 and T03 are independent after T01, but run one at a time (one Coder at a time).

## Layout

- (A) App lives in `products/collide/app/` (Vite + React + TS frontend, `src-tauri/` Rust). pnpm commands run from that folder.
- (A) Tickets: `products/collide/tickets/Txx.md`. Tester reports: `products/collide/reports/Txx.md`.
- (A) Design system is consumed from `../design-system/` (tokens via `styles.css`; components ported to TSX in `app/src/ds/` where the run needs them, values unchanged).

## Dependencies approved by the Planner

Beyond the Tech stack table and test tooling:
- `zod` — named by T02 on the task board.
- `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog` (+ Rust crates) — T06 "via Tauri fs" needs them.
- `@tauri-apps/plugin-global-shortcut` (+ Rust crate) — T11 global hotkey.
- ESLint + typescript-eslint, `@vitejs/plugin-react`, `jsdom`/`@testing-library/react` — T01 tooling.
- `konva`, `react-konva`, `xcap`, `image` — in the Tech stack table.
- `@tauri-apps/api`, `@types/node`, `@types/react`, `@types/react-dom`, `@eslint/js`; TypeScript pinned 5.x (typescript-eslint does not support TS 7) — T01 tooling, approved 2026-11-14.
- `lucide-static@0.460.0` — bundled locally so icons work offline (SPEC success criterion); replaces the design system's CDN load. Approved 2026-11-14 (T03).
- `xcap` 0.9, `image` 0.25 (png only) — Tech stack table; `base64`, `serde` as direct Rust deps (already transitive via Tauri). Approved 2026-11-14 (T08). Linux build needs extra -dev packages (listed in `app/CLAUDE.md`).
- Fonts: Geist via Google Fonts link, as the design system's `tokens/fonts.css` does (⚠ substitute, per readme).

## Usage budget

- (A) `/status` is an interactive command; a cloud session cannot read the Pro usage meter from inside (the dev plan already flags this). The run instead: one task at a time, WIP committed to the task branch before each next step, `HANDOFF.md` kept current, and stops at the first usage warning or rate-limit error.

## Scope changes

- 2026-11-14: order change only — T07 (export) runs before T06 (save/open) so T06 writes `export.png` with the real `flatten()` instead of a stub. Both depend only on T04.
