# Progress Tracker

Updated 2026-11-19 · Grant Block. Where Project Iron stands. Status: ✅ done · 🟡 in progress · ⬜ not started · ⛔ blocked. Problems and decisions waiting on Grant are in `docs/current-issues.md`.

## Summary

| Area | Status | Next |
| --- | --- | --- |
| Setup steps (plan) | ⬜ 0 of 9 | Step 1: prototype review and feature specs |
| Morning report pipeline | 🟡 4 of 6 | Approve `docs/morning-report.md`, then `agents/tester.md` |
| Agent Chat | 🟡 0.3.5 in use | Second computer; firewall; PR into `development` |
| Collide (`products/collide/`) | 🟡 0.1.1 shipped; Run 4 built | Windows checks (Grant); version bump and release |
| Iron build steps | ⬜ 0 of 12 | Gated on setup steps |

## Setup steps for Grant (from the plan)

| # | Step | Status | Notes |
| --- | --- | --- | --- |
| 1 | Prototype review; approve one feature spec per content panel | ⬜ | Specs not drafted yet ([stated] 2026-11-13) |
| 2 | Build-gating decisions RQ11, RQ15, RQ14 | ⬜ | |
| 3 | Service accounts in test mode | ⬜ | |
| 4 | Spending caps | ⬜ | Depends on open question 3 (billing) |
| 5 | Approve the cloud environment | ⬜ | |
| 6 | Protect `development` and `main` | ⬜ | |
| 7 | Approve role files, labels, issue template, CODEOWNERS, coder `CLAUDE.md` | ⬜ | `docs/morning-report.md` drafted for `agents/tester.md` |
| 8 | Dry run: one night, Coder only, Iron step 1 | ⬜ | |
| 9 | Tester and Reviewer on, full schedule, morning report | ⬜ | Report pipeline below is ready ahead of this |

## Morning report pipeline

| # | Item | Status | Date | Notes |
| --- | --- | --- | --- | --- |
| 1 | Decide where the report goes | ✅ | 2026-11-13 | GitHub issue #2 (option C) |
| 2 | Issue #2 "Nightly report" created | ✅ | 2026-11-13 | |
| 3 | Agent Chat pulls report comments from GitHub | ✅ | 2026-11-13 | Checks every 5 min; Menu → Connect |
| 4 | End-to-end test (comment → chat) | ✅ | 2026-11-13 | Test comment showed up in Agent Chat |
| 5 | Report steps and format for Lydia | 🟡 | 2026-11-13 | Draft in `docs/morning-report.md`, waiting on Grant |
| 6 | Lydia's role file with the report step (`agents/tester.md`) | ⬜ | | After 5 is approved |
| — | Phone notification (option A) | ⬜ | | Open decision |

## Agent Chat (`tools/project-chat/`)

| Version | Date | Status | What |
| --- | --- | --- | --- |
| 0.1 | 2026-11-13 | ✅ | Local chat server, report endpoint, project selector |
| 0.2 | 2026-11-13 | ✅ | Desktop app in its own window, tray, single `.exe` |
| 0.2.1 | 2026-11-13 | ✅ | AI replies via the local `claude` CLI |
| 0.3.0 | 2026-11-13 | ✅ | Connect to another computer; chat trimmed to 30 messages |
| 0.3.1–0.3.2 | 2026-11-13 | ✅ | Banner, fixed window size, bottom-anchored chat, colors |
| 0.3.3 | 2026-11-13 | ✅ | Renamed Agent Chat; grouped messages; transparent banner |
| 0.3.4 | 2026-11-13 | ✅ | Menu panel under the banner |
| 0.3.5 | 2026-11-13 | ✅ in use | GitHub report source |
| next | | 🟡 | In source, not built: agent picture (Menu → Projects); reads Lydia's sign-off style reports; Server / Connected switch in Menu → Connect |

| Setup item | Status | Notes |
| --- | --- | --- |
| Server PC running Agent Chat | ✅ | AI replies on |
| `claude` CLI installed and signed in on the server PC | ✅ | |
| GitHub report source set (`GrantBlock/Project_Iron` #2) | ✅ | |
| Firewall allows the chat port on the server PC | ⬜ | Needs admin PowerShell |
| Second computer connected to the server | ⬜ | Needs the current build |
| Agent Chat changes merged into `development` | 🟡 | Up to 0.3.2 via PR #1; later commits waiting |

## Collide (`products/collide/`)

| Item | Status | Notes |
| --- | --- | --- |
| Runs 1 to 3 (`collide/run`: Electron move, prototype layout, `.collide`, storage, PDF) | ✅ | Board done; PR #6 into `development` open for Grant; Windows checks pending |
| Collide 0.1.0 and 0.1.1 | ✅ | Installer, portable exe, web installer, updates from the Cloudflare release folder |
| Improvement plan (`docs/collide-improvement-plan.md`) | 🟡 | Draft; Grant's scope items 1 to 8 recorded 2026-11-19 |
| Run 4 (`RUN4.md`, branch `collide/run-4`) | ✅ Built 2026-11-19 | T41 to T47 Done; Vitest 576, e2e 86, Electron e2e 24; waiting on Grant's Windows checks and a PR |
| Windows checks on 0.1.1 | ⬜ | Grant (`TESTER-NOTES.md`) |
| Lite (`products/lite/`) | 🟡 | Brief merged; run branches (`lite/run`, `task/L*`) not merged |

## Iron build steps (from the plan)

| # | Step | Status |
| --- | --- | --- |
| 1 | Project Setup | ⬜ |
| 2 | Design System | ⬜ |
| 3 | Editor Layout Shell | ⬜ |
| 4 | Sidebar UI | ⬜ |
| 5 | Auth Setup | ⬜ |
| 6 | Database Schema | ⬜ |
| 7–12 | Draft steps | ⬜ |
