# Lite reference specs

Acceptance specs for Lite, written from the P16 prototype only. Target-agnostic: they test whatever `LITE_TARGET_URL` points at, using visible UI and `window.__lite.state()` (see `HOOK.md`).

## Run against the prototype

```
cd products/lite/reference
pnpm install
pnpm exec playwright test
```

Uses `/opt/pw-browsers/chromium` when present, otherwise Playwright's own Chromium (`pnpm exec playwright install chromium`).

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `LITE_TARGET_URL` | `file://…/prototype/exports/P16-lite/index.html` | Page under test |
| `LITE_TARGET_NAME` | `prototype` | Names the screenshot folder |
| `LITE_SHOTS_DIR` | `products/lite/reference/shots/<target>/` (gitignored) | Where 1440x860 and 400x800 screenshots go |

Example: `LITE_TARGET_URL=http://localhost:5173 LITE_TARGET_NAME=app pnpm exec playwright test`

Rule: a spec that fails on the prototype is a bad spec. Do not edit the prototype to make a spec pass.

## Grant overrides

A Grant decision dated after the prototype wins over it. These tests assert the decided behaviour, carry a `grant-override` annotation and a " [Grant 2026-11-17]" title suffix, and use `test.fail(target === 'prototype', ...)`: on the prototype they are expected to fail (the run stays green; if the prototype ever passes one, Playwright reports an error). On the app they must pass.

| Test | Decision |
| --- | --- |
| `assistant.spec.ts` › assistant › suggested question 2 gives the canned answer [Grant 2026-11-17] | ISSUES 1: "What do I do before servicing the gearbox?" gets the lockout answer with 1 citation, not the fallback |
| `tree.spec.ts` › tree › a closed folder stays closed when an item is selected [Grant 2026-11-17] | ISSUES 3: folder open/closed state survives selecting an item |
| `search.spec.ts` › search › a closed folder stays closed while searching and after clearing [Grant 2026-11-17] | ISSUES 3: folder state survives a search and clearing it |
