# Morning Report (Lydia)

Updated 2026-11-13 · Grant Block. **Draft (not yet approved by Grant).** When approved, this becomes the "Morning report" section of `agents/tester.md`.

Decided ([stated] 2026-11-13, see `docs/agentic-dev-plan.md`): the morning report is a comment on GitHub issue **#2 "Nightly report"** in this repository, and Agent Chat (`tools/project-chat/`) pulls it into Grant's chat. Only Lydia's report goes to the chat.

## When

After the 5am preview checks, before 6:30am Central. One comment per night, even when nothing happened.

## Steps for Lydia

1. Collect the night's results from GitHub:
   - Pull requests labeled `review-passed` → **Ready to merge**
   - Issues labeled `blocked` → **Blocked** (with the agent's note)
   - Pull requests labeled `changes-requested` → **Changes requested**
   - Your 5am preview checks: tests passed or failed per pull request, with screenshot links
   - Night usage as a percent of the cap (see Usage limit in the plan); if it can't be measured, write `unknown`
2. Pick the status:
   - `PASS`: nothing blocked, nothing failed
   - `PARTIAL`: some work ready, some blocked or failing
   - `FAIL`: nothing ready, or CI or the preview is broken
   - `INFO`: no work ran (no `ready` issues, or the usage cap was reached before work started)
3. Post the comment on issue #2 in the exact format below. Agent Chat reads the first line, `**Status:**`, the counts line and `Summary:`; anything else is shown as the full report.
4. Do not edit or delete earlier report comments. A correction is a new comment with the same first line and `(correction)` after the date.

## Comment format (exact)

```markdown
Lydia (Tester) · Nightly report · YYYY-MM-DD
**Status:** PARTIAL
**Ready to merge:** 2 · **Blocked:** 1 · **Changes requested:** 1 · **Usage:** 62%

Summary: One or two plain sentences: what is ready, what needs Grant.

## Ready to merge
- #12 Design tokens · PR #15 · preview: <link> · tests 14/14

## Blocked
- #14 Sidebar · what was tried · what is needed from Grant

## Changes requested
- PR #16 · Farengar's main point · fix planned for 3am

## Usage
- Night total: 62% of cap · Coder 41% · Reviewer 12% · Tester 9%

## Needs Grant
- Decisions or approvals, one per line, each with its link
```

Rules for the format:

- Line 1 must be `Lydia (Tester) · Nightly report · YYYY-MM-DD` (the date of the morning the report is written, Central time). Agent Chat ignores comments without "Nightly report" on line 1 or signed by another agent.
- Separate the counts with ` · ` and keep each count as `**Label:** value`.
- `Summary:` is one line, at most two sentences.
- Empty sections say `- none`.
- Links only to this repository's issues, pull requests and preview URLs. No secrets, keys, customer data or personal contact details (this repository is public).

## Never

- Post more than one report per night (except a correction).
- Mark a pull request ready to merge unless it has `review-passed` and its preview checks passed.
- Change a test, a label or a decision to make the report look better.

## Open (needs Grant)

- Phone notification at 6:30am (plan option A) alongside the comment: yes or no.
