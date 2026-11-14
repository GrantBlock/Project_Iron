# Current Issues

Updated 2026-11-13 · Grant Block. Open problems and decisions waiting on Grant. Close an item by moving it to Resolved with the date. Progress lives in `docs/progress-tracker.md`.

## Waiting on Grant (decisions and approvals)

| # | Item | What's needed | Link |
| --- | --- | --- | --- |
| 1 | Morning report draft | Review and approve `docs/morning-report.md`; then it becomes the "Morning report" section of `agents/tester.md` | `docs/morning-report.md` |
| 2 | Phone notification (option A) | Yes or no to a 6:30am phone notification alongside the issue #2 comment | Plan, open question 1 |
| 3 | Business hours | Confirm 7am to 6pm Central | Plan, open question 2 |
| 4 | Usage billing | Are Claude Code sessions on a subscription or an API key? Decides the usage backstop | Plan, open question 3 |
| 5 | Agent Chat branch | `claude/intelligent-brown-2hlzyu` has 5 Agent Chat commits since PR #1 (0.3.3 to the icons). Open a pull request into `development`? | Branch |
| 6 | `snip-markup/run-1` branch | Separate app (Collide spec, design system, mockups). Not merged into the Agent Chat branch; decide where it merges and when | Branch |
| 7 | Setup steps 1 to 9 | None started; step 1 (prototype review and feature specs) comes first | Plan, Setup steps |

## Agent Chat (known problems)

| # | Problem | Impact | Next step |
| --- | --- | --- | --- |
| 1 | Server PC firewall: allowing port 3500 needs an admin PowerShell | Other computers can't connect until it's allowed | Run the firewall command as administrator (README) |
| 2 | Second computer not yet on the current build or in "Connect to another computer" mode | It runs its own separate chat | Install the latest build there and connect it to the server PC |
| 3 | Agent picture (Lydia) is in the source but not in the installed 0.3.5 | Lydia still shows initials | Next approved build, then Menu → Projects → Choose picture |
| 4 | The `.exe` file's own icon in File Explorer is the default Electron icon (`signAndEditExecutable` is off) | Cosmetic | Try enabling it in the next approved build |
| 5 | Windows-only behavior not tested by Claude (builds are checked on Linux): GitHub polling on the work PC's network, tray icons, window size lock | Possible surprises on first run | Grant checks after each build |
| 6 | GitHub polling is unauthenticated (60 requests per hour per IP) | Fine at one check every 5 minutes; a token is needed only for private repos or many projects | Add `githubToken` to `config.json` if it ever hits the limit |

## Resolved

| Date | Item |
| --- | --- |
| 2026-11-13 | Collide icon was added to Agent Chat by mistake: reverted; Agent Chat keeps the 0.3.5 icons |
| 2026-11-13 | Cloud sessions can't reach the PC over Tailscale: reports now go through GitHub issue #2 and Agent Chat pulls them in |
| 2026-11-13 | `claude` CLI not found: installed the standalone CLI and added it to PATH; AI replies on |
| 2026-11-13 | Agent Chat on Windows couldn't start `claude.cmd`: launch through a shell on Windows |
| 2026-11-13 | Two computers each ran their own chat: one server PC; others use "Connect to another computer" |
| 2026-11-13 | Open menu showed the chat through the banner gaps: menu panel slides under the banner (0.3.4) |
