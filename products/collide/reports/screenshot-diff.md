# Screenshot diff: prototype vs app (T37)

Date: 2026-11-17 (run on Linux, headless Chromium, `collide/run` at the start of T37)

Tolerance (A): 2% of pixels (ISSUES 23). A pixel differs when any RGBA channel differs by more than 16. Pairs above 2% are listed for Grant; nothing fails.

## How to run

```
cd products/collide/app
pnpm install && pnpm ref          # writes the PNGs to reference-out/screens/{prototype,app}/<spec>/ (gitignored)
node reference/compare-shots.mjs  # prints the % per pair and the summary; add --json for the raw data
```

The PNGs are not committed.

## Summary

- Pairs compared: 102 (1440x860 and 400x800; Dark, Light, Aura (Sage)).
- Above 2%: 93. At or below 2%: 9.
- Size mismatches: 0.
- Unpaired files: 24. In three specs the app could not set a theme (a splash covers Appearance), so it saved "current"-theme files while the prototype saved Dark/Light/Aura files; these have no same-named partner and are not compared (list at the end).
- Worst 5:
  1. markdown-zoom / zoomed-in / light / 400x800: 45.94%
  2. markdown-margin-drawing / rect-from-margin / aura-sage / 400x800: 43.71%
  3. markdown-margin-drawing / rect-from-margin / light / 400x800: 43.67%
  4. markdown-zoom / zoomed-in / aura-sage / 400x800: 43.23%
  5. pen-highlighter-and-page-leaders / page-leaders / light / 400x800: 42.63%

## Results

### callout-numbering

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| fifth-callout | aura-sage | 1440x860 | 14.90% | listed for Grant |
| fifth-callout | aura-sage | 400x800 | 21.79% | listed for Grant |
| fifth-callout | dark | 1440x860 | 9.74% | listed for Grant |
| fifth-callout | dark | 400x800 | 15.94% | listed for Grant |
| fifth-callout | light | 1440x860 | 14.93% | listed for Grant |
| fifth-callout | light | 400x800 | 22.76% | listed for Grant |

### click-outside-returns-to-select

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| note-focused | aura-sage | 1440x860 | 17.99% | listed for Grant |
| note-focused | aura-sage | 400x800 | 42.41% | listed for Grant |
| note-focused | dark | 1440x860 | 15.50% | listed for Grant |
| note-focused | dark | 400x800 | 21.03% | listed for Grant |
| note-focused | light | 1440x860 | 19.00% | listed for Grant |
| note-focused | light | 400x800 | 42.27% | listed for Grant |

### delete-recents-items

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| after-deletes | aura-sage | 1440x860 | 0.96% | ✓ |
| after-deletes | aura-sage | 400x800 | 4.38% | listed for Grant |
| after-deletes | dark | 1440x860 | 1.04% | ✓ |
| after-deletes | dark | 400x800 | 2.20% | listed for Grant |
| after-deletes | light | 1440x860 | 0.76% | ✓ |
| after-deletes | light | 400x800 | 2.18% | listed for Grant |

### esc-returns-to-select

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| snip-after-esc | aura-sage | 1440x860 | 14.55% | listed for Grant |
| snip-after-esc | aura-sage | 400x800 | 22.42% | listed for Grant |
| snip-after-esc | dark | 1440x860 | 9.26% | listed for Grant |
| snip-after-esc | dark | 400x800 | 13.06% | listed for Grant |
| snip-after-esc | light | 1440x860 | 14.79% | listed for Grant |
| snip-after-esc | light | 400x800 | 25.97% | listed for Grant |

### markdown-margin-drawing

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| rect-from-margin | aura-sage | 1440x860 | 19.58% | listed for Grant |
| rect-from-margin | aura-sage | 400x800 | 43.71% | listed for Grant |
| rect-from-margin | dark | 1440x860 | 16.17% | listed for Grant |
| rect-from-margin | dark | 400x800 | 22.13% | listed for Grant |
| rect-from-margin | light | 1440x860 | 20.58% | listed for Grant |
| rect-from-margin | light | 400x800 | 43.67% | listed for Grant |

### markdown-zoom

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| zoomed-in | aura-sage | 1440x860 | 41.28% | listed for Grant |
| zoomed-in | aura-sage | 400x800 | 43.23% | listed for Grant |
| zoomed-in | dark | 1440x860 | 24.39% | listed for Grant |
| zoomed-in | dark | 400x800 | 28.69% | listed for Grant |
| zoomed-in | light | 1440x860 | 41.33% | listed for Grant |
| zoomed-in | light | 400x800 | 45.94% | listed for Grant |

### order-numbers-and-eraser

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| list-front-to-back | aura-sage | 1440x860 | 14.33% | listed for Grant |
| list-front-to-back | aura-sage | 400x800 | 17.79% | listed for Grant |
| list-front-to-back | dark | 1440x860 | 10.21% | listed for Grant |
| list-front-to-back | dark | 400x800 | 13.11% | listed for Grant |
| list-front-to-back | light | 1440x860 | 14.24% | listed for Grant |
| list-front-to-back | light | 400x800 | 20.02% | listed for Grant |

### paste-image

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| pasted-into-markdown | aura-sage | 1440x860 | 19.44% | listed for Grant |
| pasted-into-markdown | aura-sage | 400x800 | 19.80% | listed for Grant |
| pasted-into-markdown | dark | 1440x860 | 17.61% | listed for Grant |
| pasted-into-markdown | dark | 400x800 | 18.93% | listed for Grant |
| pasted-into-markdown | light | 1440x860 | 18.54% | listed for Grant |
| pasted-into-markdown | light | 400x800 | 20.21% | listed for Grant |
| pasted-into-snip | aura-sage | 1440x860 | 16.09% | listed for Grant |
| pasted-into-snip | aura-sage | 400x800 | 18.09% | listed for Grant |
| pasted-into-snip | dark | 1440x860 | 10.49% | listed for Grant |
| pasted-into-snip | dark | 400x800 | 11.80% | listed for Grant |
| pasted-into-snip | light | 1440x860 | 16.00% | listed for Grant |
| pasted-into-snip | light | 400x800 | 20.58% | listed for Grant |

### pen-colour-and-thickness-memory

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| no-colour-after-draw | aura-sage | 1440x860 | 14.55% | listed for Grant |
| no-colour-after-draw | aura-sage | 400x800 | 21.51% | listed for Grant |
| no-colour-after-draw | dark | 1440x860 | 9.49% | listed for Grant |
| no-colour-after-draw | dark | 400x800 | 15.74% | listed for Grant |
| no-colour-after-draw | light | 1440x860 | 14.71% | listed for Grant |
| no-colour-after-draw | light | 400x800 | 22.52% | listed for Grant |

### pen-highlighter-and-page-leaders

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| page-leaders | aura-sage | 1440x860 | 17.79% | listed for Grant |
| page-leaders | aura-sage | 400x800 | 40.08% | listed for Grant |
| page-leaders | dark | 1440x860 | 15.31% | listed for Grant |
| page-leaders | dark | 400x800 | 19.95% | listed for Grant |
| page-leaders | light | 1440x860 | 18.70% | listed for Grant |
| page-leaders | light | 400x800 | 42.63% | listed for Grant |
| pen-resized | aura-sage | 1440x860 | 13.47% | listed for Grant |
| pen-resized | aura-sage | 400x800 | 17.70% | listed for Grant |
| pen-resized | dark | 1440x860 | 9.03% | listed for Grant |
| pen-resized | dark | 400x800 | 12.45% | listed for Grant |
| pen-resized | light | 1440x860 | 13.89% | listed for Grant |
| pen-resized | light | 400x800 | 21.07% | listed for Grant |

### print-area-and-bubble-stacking

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| snapped-bubble | aura-sage | 1440x860 | 16.18% | listed for Grant |
| snapped-bubble | aura-sage | 400x800 | 22.38% | listed for Grant |
| snapped-bubble | dark | 1440x860 | 12.48% | listed for Grant |
| snapped-bubble | dark | 400x800 | 16.25% | listed for Grant |
| snapped-bubble | light | 1440x860 | 15.25% | listed for Grant |
| snapped-bubble | light | 400x800 | 23.14% | listed for Grant |
| stacked-bubbles | aura-sage | 1440x860 | 16.15% | listed for Grant |
| stacked-bubbles | aura-sage | 400x800 | 22.85% | listed for Grant |
| stacked-bubbles | dark | 1440x860 | 12.46% | listed for Grant |
| stacked-bubbles | dark | 400x800 | 17.79% | listed for Grant |
| stacked-bubbles | light | 1440x860 | 15.35% | listed for Grant |
| stacked-bubbles | light | 400x800 | 22.96% | listed for Grant |

### save-collide-file

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| saved-from-snip | aura-sage | 1440x860 | 12.30% | listed for Grant |
| saved-from-snip | aura-sage | 400x800 | 18.11% | listed for Grant |
| saved-from-snip | dark | 1440x860 | 8.15% | listed for Grant |
| saved-from-snip | dark | 400x800 | 12.17% | listed for Grant |
| saved-from-snip | light | 1440x860 | 12.03% | listed for Grant |
| saved-from-snip | light | 400x800 | 20.98% | listed for Grant |

### sidebar-toggles

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| delay-5s-behind | aura-sage | 1440x860 | 0.80% | ✓ |
| delay-5s-behind | aura-sage | 400x800 | 1.42% | ✓ |
| delay-5s-behind | dark | 1440x860 | 0.87% | ✓ |
| delay-5s-behind | dark | 400x800 | 1.63% | ✓ |
| delay-5s-behind | light | 1440x860 | 0.58% | ✓ |
| delay-5s-behind | light | 400x800 | 1.56% | ✓ |

### tabs-and-close-splash

| Shot | Theme | Size | % different | Result |
|---|---|---|---|---|
| four-tabs | aura-sage | 1440x860 | 12.66% | listed for Grant |
| four-tabs | aura-sage | 400x800 | 23.12% | listed for Grant |
| four-tabs | dark | 1440x860 | 9.68% | listed for Grant |
| four-tabs | dark | 400x800 | 12.69% | listed for Grant |
| four-tabs | light | 1440x860 | 13.25% | listed for Grant |
| four-tabs | light | 400x800 | 22.16% | listed for Grant |

## Unpaired (not compared)

- app/delete-recents-items/delete-splash-current-1440x860.png
- app/delete-recents-items/delete-splash-current-400x800.png
- prototype/delete-recents-items/delete-splash-aura-sage-1440x860.png
- prototype/delete-recents-items/delete-splash-aura-sage-400x800.png
- prototype/delete-recents-items/delete-splash-dark-1440x860.png
- prototype/delete-recents-items/delete-splash-dark-400x800.png
- prototype/delete-recents-items/delete-splash-light-1440x860.png
- prototype/delete-recents-items/delete-splash-light-400x800.png
- app/markdown-text-tools/full-width-table-current-1440x860.png
- app/markdown-text-tools/full-width-table-current-400x800.png
- prototype/markdown-text-tools/full-width-table-aura-sage-1440x860.png
- prototype/markdown-text-tools/full-width-table-aura-sage-400x800.png
- prototype/markdown-text-tools/full-width-table-dark-1440x860.png
- prototype/markdown-text-tools/full-width-table-dark-400x800.png
- prototype/markdown-text-tools/full-width-table-light-1440x860.png
- prototype/markdown-text-tools/full-width-table-light-400x800.png
- app/tabs-and-close-splash/close-splash-current-1440x860.png
- app/tabs-and-close-splash/close-splash-current-400x800.png
- prototype/tabs-and-close-splash/close-splash-aura-sage-1440x860.png
- prototype/tabs-and-close-splash/close-splash-aura-sage-400x800.png
- prototype/tabs-and-close-splash/close-splash-dark-1440x860.png
- prototype/tabs-and-close-splash/close-splash-dark-400x800.png
- prototype/tabs-and-close-splash/close-splash-light-1440x860.png
- prototype/tabs-and-close-splash/close-splash-light-400x800.png
