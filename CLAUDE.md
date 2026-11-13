# CLAUDE.md — Project Iron

Owner: Grant Block (Block Concepts LLC). This repository runs the agentic build of Design Engineering AI. Grant is the Planner; agents never merge.

## Start of every session
1. Run `git fetch --all`, merge every remote branch with unmerged work from Grant's sessions into your session branch, and tell Grant in one line what you merged. Never reset, force-push or delete branches.
2. Read `docs/agentic-dev-plan.md`. If you are running as an agent (Irileth, Lydia, Hrongar or Farengar), also read your role file in `agents/`.
3. Product questions: the App Plan, the prototype and the design system are in `GrantBlock/designengineering-ai`, folder `Builder v0.1/`. Its `CLAUDE.md` working rules apply here too.

## Working rules
- Direct, concise, structured. Propose, get Grant's answer, then edit. End replies with the questions that need Grant's input.
- Never change a decision, price, level or number on your own. Mark assumptions (A), placeholders [brackets], and unapproved ideas `Draft (not yet approved by Grant):`.
- Record each approved decision as a dated line in `docs/agentic-dev-plan.md`, Decided so far: `- [stated] YYYY-MM-DD: <decision>`. Never delete earlier lines.
- **This repository is public.** Never commit secrets, keys, customer data, personal contact details, or the business plan's financials. Keys live in Cloudflare secrets, GitHub Actions secrets and the cloud environment's credentials.

## Branches
- `main` is for live releases only. Work goes to a session or agent branch, then a pull request into `development`. Grant merges.
