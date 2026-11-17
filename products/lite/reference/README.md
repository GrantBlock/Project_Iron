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
