# Agent Chat (formerly Project Chat)

The app is named **Agent Chat** from 0.3.3. Settings and history stay in `%APPDATA%\Project Chat\`.

Local chat app for talking with your project agents and receiving their nightly feature spec run reports.
Seeded with **Lydia · Project Iron · designengineering.ai Development Team**.

## Desktop app (ProjectChat-x.y.z.exe)
- Double-click the .exe. No install or Node.js needed. It opens in its own window and starts the server.
- Settings and data: `%APPDATA%\Project Chat\` (`config.json`, `data\db.json`). Tray menu → "Open settings folder".
- Closing the window hides it to the system tray so other computers stay connected. Tray → Quit stops it.
- Tray menu also copies the network link and the report token.
- Windows SmartScreen may warn on first run (the .exe isn't code-signed): More info → Run anyway.
- Don't run start.bat at the same time — both use port 3500.

### Using it on a second computer
Run the server on one PC only (the one that stays on overnight). On the other computer:
1. Run the .exe → tray icon → **Connect to another computer…**
2. Enter the server's address, e.g. `100.91.95.74:3500` (Tailscale) → **Test connection** → **Save and restart**.
3. The app now opens the main PC's chat in its own window and stores nothing locally. Closing it quits.

To switch back: tray → **Change connection…** → **Run the server on this computer**. The choice is saved in `%APPDATA%\Project Chat\desktop.json`.

Rebuild the .exe: `npm install` then `npm run dist` (output in `dist/`).

## Run from source (Windows)
1. Install Node.js 18+ (LTS) if needed.
2. Double-click `start.bat` (or run `node server.js`).
3. First run creates `config.json` and prints the URLs and the report token.

```
Project Chat is running
  This computer:   http://localhost:3500
  Other computers: http://192.168.1.25:3500
  Report token:    3f9c...
```

### Open it from other computers
- Use the "Other computers" URL on any device on the same network.
- Allow the port through Windows Firewall once (PowerShell as admin):
  `New-NetFirewallRule -DisplayName "Project Chat" -Direction Inbound -Protocol TCP -LocalPort 3500 -Action Allow -Profile Private`
- Set `accessPassword` in `config.json` to require a password (browser login; any username).
- For access outside your network, use Tailscale or a Cloudflare Tunnel rather than opening a router port.

## config.json
| Key | Purpose |
|---|---|
| `port` / `host` | Default `3500` on `0.0.0.0` (all network interfaces) |
| `reportToken` | Secret agents use to post reports |
| `accessPassword` | Optional password for the chat UI |
| `model` | Claude model for replies (default `claude-sonnet-5-5`) |
| `ownerName` | Your name shown in the chat |
| `maxMessages` | Messages kept per project; older ones are deleted (default `30`) |
| `githubPollMinutes` | How often to check GitHub report sources (default `5`) |
| `githubToken` | Optional GitHub token for private repos or higher rate limits |
| `keepReports` | Newest reports always kept, even past `maxMessages` (default `5`) |

## AI replies

AI replies run through the `claude` CLI (Claude Code) installed on this PC, using
whatever account it's signed into — a Claude subscription's usage, not a metered
Anthropic API key. Install it and run `claude` once interactively to sign in, then
restart Project Chat; the startup log and **Menu → Connect** show whether it found
the CLI.

Without the `claude` CLI on PATH, the chat still receives reports and answers
"latest" and "list reports".

**If the desktop `.exe` can't find `claude` but a terminal can:** a GUI-launched app
on Windows doesn't always inherit the same PATH as a terminal (especially right
after installing the CLI). Add the CLI's install folder to the **System** PATH (not
just your user PATH) and restart Project Chat, or run `start.bat` instead of the
`.exe`.

## GitHub report source (cloud agents)

Cloud agents (Claude Code scheduled sessions) can't reach this PC, so they post the nightly report as a **comment on a GitHub issue** and Agent Chat pulls it in.

**Set up (once per project):** Menu → Connect → GitHub report source → `owner/repo` and the issue number → **Save**. The app checks every 5 minutes (`githubPollMinutes`) and on **Check now**. Public repos need no token; for a private repo or to avoid rate limits, put a fine-grained read-only token in `githubToken` in `config.json`.

**What gets imported:** only new comments whose first line contains "Nightly report" and is signed by the project's agent (for Project Iron, `Lydia`). Other comments are ignored. Each comment is imported once, even after restarts or chat trimming.

**Comment format the agent must post:**

```markdown
Lydia (Tester) · Nightly report · 2026-11-14
**Status:** PARTIAL
**Ready to merge:** 2 · **Blocked:** 1 · **Changes requested:** 1 · **Usage:** 62%

Summary: Two PRs ready; sidebar blocked on a missing design token.

## Ready to merge
- #12 Design tokens — PR #15
## Blocked
- #14 Sidebar — what was tried, what's needed
```

- Line 1: `<Agent> (<Role>) · Nightly report · YYYY-MM-DD`
- `**Status:**` one of `PASS`, `FAIL`, `PARTIAL`, `INFO`
- One line of `**Label:** value` pairs separated by `·` (shown as counts on the card)
- `Summary:` one or two lines (shown on the card)
- Everything after is the full report (shown under "View full report"), with a link back to the comment

## Sending nightly reports
`POST /api/reports` with header `Authorization: Bearer <reportToken>`:

```json
{
  "project": "project-iron",
  "agent": "Lydia",
  "status": "pass | fail | partial | info",
  "title": "Feature spec run #42",
  "summary": "38/40 specs passed. 2 failures in CAD export.",
  "body": "## Failures\n- spec/export_step.feature: timeout\n...",
  "stats": { "passed": 38, "failed": 2, "skipped": 0 },
  "runDate": "2026-11-13",
  "link": "https://github.com/..."
}
```

If `project` doesn't match an existing id or name, a new project is created automatically.

From the agent's last step (PowerShell):
```powershell
$env:PROJECT_CHAT_TOKEN = "<reportToken>"
.\scripts\send-report.ps1 -Status partial -Title "Feature spec run #42" -Summary "38/40 passed" -Passed 38 -Failed 2 -BodyFile .\run-report.md
```
Linux / WSL / Claude Code cloud runner: `scripts/send-report.sh`. A cloud runner needs a reachable URL (Tailscale or a tunnel), since `localhost` is your PC only.

## Using the chat
- **Menu → Projects**: switch projects (grouped by team), see unread badges, add a project.
- **Menu → Reports**: jump to any past report in the current project.
- **Menu → Connect**: LAN URLs, AI status, and the report endpoint.
- Reports show a status chip, stats, summary, and an expandable full report. The assistant answers using the 5 most recent reports.
- New messages update live on every open computer; desktop notifications fire for reports when the tab is in the background.

Data is stored in `data/db.json` (back it up or delete it to reset).
