# Full-suite summary — run 1

2026-11-14 · run on `snip-markup/run-1` after T11 merged (Planner).

| Command (in `products/collide/app`) | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm lint` | PASS (0 problems) |
| `pnpm test` (Vitest) | PASS — 103/103, 12 files |
| `pnpm e2e` (Playwright, Chromium) | PASS — 30/30 |
| `pnpm build` | PASS (chunk-size warning only) |
| `cargo test` (`src-tauri`) | PASS — 20/20 |
| `cargo clippy --all-targets -- -D warnings` | PASS |

Per-task reports: `T01.md` … `T11.md` in this folder. T05 failed its first test cycle (a flaky load/seed race in the T03 e2e) and passed after one Coder fix; every other task passed first time.

**Not verifiable in the cloud box** (no display, Linux): a real Tauri window, Windows DPI scaling, real `xcap` capture, the global hotkey from other apps, the transparent topmost overlay, and Tauri fs save/open. These are Grant's Windows checklist in `HANDOFF.md`.
