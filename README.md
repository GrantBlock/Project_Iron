# Project Iron

Agentic build of **Design Engineering AI** (designengineering.ai), a Block Concepts LLC product. Owner: Grant Block.

Four agents build the app overnight from approved feature specs, and Grant plans, tries the results and merges during business hours (Central time).

| Agent | Role | Runs |
| --- | --- | --- |
| Irileth | Planner (Grant, with planning chats) | Business hours |
| Lydia | Tester: acceptance tests before code, preview checks, morning report | 6pm and 5am |
| Hrongar | Coder: one issue per pull request | 8pm and 3am |
| Farengar | Reviewer: checks each pull request against the spec, design system and plan | 1am |

## Where things are

| Path | What |
| --- | --- |
| `docs/agentic-dev-plan.md` | The plan: decisions, roles, agent identities, feature specs, schedule, usage limit, setup steps, Iron process |
| `agents/` | Role files, one per agent (added after Grant approves each) |
| `CLAUDE.md` | Rules for every Claude session in this repository |

The product plan, the clickable prototype and the design system live in `GrantBlock/designengineering-ai` (folder `Builder v0.1/`).

## Status

Setup. Grant is reviewing the prototype and the plan. No application code yet.
