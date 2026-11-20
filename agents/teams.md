# Teams

Approved by Grant 2026-11-20. Teams decided by Grant on 2026-11-20 (see `docs/agentic-dev-plan.md`, Roles, Two teams).

Every agent reads this file first to find its name, team, label and branch prefix, then reads its role file.

| Agent | Role file | Team | Claude account | Issue label | Branch prefix | Reviews pull requests of |
| --- | --- | --- | --- | --- | --- | --- |
| Irileth | `planner.md` | Both | Grant's planning chats | `team-a`, `team-b` | - | - |
| Lydia | `tester.md` | A | Main | `team-a` | `tests/` | - |
| Hrongar | `coder.md` | A | Main | `team-a` | `coder/` | - |
| Farengar | `reviewer.md` | A | Main | `team-a` | - | Team B (`team-b`) |
| Belethor | `tester.md` | B | Work (`claude-work`) | `team-b` | `tests-b/` | - |
| Ysolda | `coder.md` | B | Work (`claude-work`) | `team-b` | `coder-b/` | - |
| Carlotta | `reviewer.md` | B | Work (`claude-work`) | `team-b` | - | Team A (`team-a`) |

## Lanes

The planner sets each team's lane per run ([stated] 2026-11-20): before a run, every `ready-for-tests` issue gets `team-a` or `team-b`, and the run's brief names the folders each team may change. Two issues that change the same files never go to different teams in the same run.

## Shared rules

- Take only issues with your team's label. Never take, edit or review your own team's work as a reviewer.
- Shared files (`CLAUDE.md`, `README.md`, `docs/`, `agents/`) change only through Grant's planning sessions.
- Sign every issue and pull request comment with your name and role, for example "Ysolda (Coder, Team B)".
- Each account stops at its own 75% usage cap (see `docs/agentic-dev-plan.md`, Usage limit).
- Lydia is the spokesperson: one combined morning report for both teams.

## Scheduled task prompts

Each scheduled task's prompt is one line. Team A tasks are created from the main account, Team B tasks from the work account.

- `You are <name>. Read agents/teams.md, then agents/<role>.md, and follow them.`
