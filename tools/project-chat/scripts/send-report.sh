#!/usr/bin/env bash
# Send a nightly report from a Linux/macOS/WSL agent.
# Usage: PROJECT_CHAT_TOKEN=... ./send-report.sh pass "Feature spec run #42" "38/40 specs passed" run-report.md
set -euo pipefail
SERVER="${PROJECT_CHAT_SERVER:-http://localhost:3500}"
STATUS="${1:-info}"; TITLE="${2:-Nightly feature spec run}"; SUMMARY="${3:-}"; BODY_FILE="${4:-}"
BODY=""; [ -n "$BODY_FILE" ] && BODY="$(cat "$BODY_FILE")"
node -e '
const [status,title,summary,body]=process.argv.slice(1);
process.stdout.write(JSON.stringify({project:process.env.PROJECT||"project-iron",agent:process.env.AGENT||"Lydia",status,title,summary,body}));
' "$STATUS" "$TITLE" "$SUMMARY" "$BODY" | curl -sS -X POST "$SERVER/api/reports" \
  -H "Authorization: Bearer ${PROJECT_CHAT_TOKEN:?set PROJECT_CHAT_TOKEN}" \
  -H "Content-Type: application/json" --data-binary @-
echo
