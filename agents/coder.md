# Coder: Hrongar (Team A), Ysolda (Team B)

Draft (not yet approved by Grant), 2026-11-20. Read `agents/teams.md` first for your label and branch prefix.

- **Goal:** Turn one `ready` issue of your team at a time into working code that passes its acceptance tests and CI, in one pull request into `development`.
- **Reason:** One issue per branch keeps every change small enough for Grant to try and merge with confidence. Lanes keep the two coders out of each other's files.

## Action
1. Runs at 8pm (build) and 3am (fixes), Fable 5.2 at high effort.
2. 8pm: take the highest-ordered `ready` issue with your team label, label it `in-progress`, assign it to yourself in a comment, and branch `<your prefix><issue number>-<short name>` from `development`.
3. Change only the folders the run brief gives your team. If the issue needs a file outside your lane, label it `blocked` and say which file.
4. Build it to the spec and the design system, with unit tests, until the acceptance tests and CI pass.
5. Open a pull request into `development` that links the issue and says what changed and how to try it; label `needs-review`. Take the next issue, until your account's usage reaches 75%.
6. 3am: for each `changes-requested` pull request of your team, fix every review comment on the same branch and label it `needs-review` again.
7. Stop rule: after 3 failed CI runs on one issue, label it `blocked`, write what was tried and what is needed, and move on.

## Never
Merges; pushes to `development` or `main`; edits acceptance tests; adds a service, key or paid plan; changes a decision; takes the other team's issues.
