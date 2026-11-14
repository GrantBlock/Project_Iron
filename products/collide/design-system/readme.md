# Collide Design System

Collide is a desktop app for capturing, marking up and asking AI about what's on screen — built for engineers and technicians who document HMI panels, P&IDs and shop-floor photos. The first feature is **Snip & Markup**: snip a region, annotate it with shapes and numbered callouts, then ask an AI (Claude, or offline Ollama) to turn the callouts into punch lists, change requests or layout suggestions.

## Sources
All provided as screenshots in `uploads/` (no codebase, Figma, logo or font files):
- `pasted-1794628183346-0.png` — Phase 1 Snip & Markup concept (three-pane editor + capture overlay). Product structure and copy.
- `pasted-1794628237119-0.png` — inspiration: dark grain, vertical bar line-art, pill outline chips, mono subline.
- `pasted-1794628269551-0.png` — inspiration: floating glass panels, warm copper ambient glow, glass composer.
- `pasted-1794628337860-0.png` — inspiration: Swiss grotesk stacks with a grey second line, dot grids, a single red-orange accent, tick rulers.

## Index
- `styles.css` — entry point (imports only) → `tokens/` fonts, colors, typography, spacing, effects, base
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/` — React primitives: actions (Button, IconButton), forms (Input, Textarea, Select, Checkbox, Switch), display (Icon, Badge, Chip, Kbd, GlassPanel/PanelHeader), navigation (Tabs, NavItem/NavSection), feedback (Tooltip, Toast, Dialog)
- `ui_kits/snip-markup/` — interactive editor + capture overlay + export dialog
- `tools/ds-loader.js` — loads components in plain HTML previews (bundle first, source fallback)
- `SKILL.md` — agent skill entry

Intentional additions: **Icon** (wrapper so Lucide glyphs inherit color), **NavItem**, **PanelHeader**, **Chip**, **Kbd** — all appear in the concept screen.

## Content fundamentals
- **Voice:** a precise colleague. Plain, technical, short. Speaks to the user as *you*; the app never says *I* or *we* in UI chrome. AI replies are direct and numbered.
- **Casing:** Sentence case for buttons, titles and menu items ("New snip", "Export markup"). UPPERCASE only for mono labels with wide tracking ("CALLOUTS", "RECENT", "ESC TO CANCEL · RELEASE TO CROP").
- **Numbers & measurements** are shown raw in mono: `612 × 340`, `2 callouts`, `Ctrl+Alt+S`. Use the × sign, not x.
- **Separators:** middle dot ` · ` between metadata items.
- **Empty states** say what to do next: "Draw on the image to add a callout."
- **Errors** name the cause and the fix: "Ollama isn't running — Start it locally or switch to Claude."
- No emoji. No exclamation marks. No marketing adjectives in product UI.
- Examples: "Turn these into a punch list for the electrician." · "2 items — 1) re-align HMI button to header grid, 2) re-weld guard bracket before next PM." · "3 markups in this project".

## Visual foundations
- **Mood:** quiet luxury instrument. Near-black, warm-neutral ink; detail comes from hairlines and line patterns, not color. Color is rationed.
- **Color:** Ink ramp (#060607 → #F3F2EF). **Signal** red-orange #FF3D1F is the single accent — primary button, active markup, record dot, focus ring; aim for one signal element per view. **Steel** #4C87C4 marks callout numbers, selection and info. **Ember** copper only lives in ambient background light. Moss/amber for status.
- **Type:** Geist for everything UI; Geist Mono for labels, metadata, measurements, shortcuts. Display is Medium with −4.5% tracking and ~1.0 leading; headline stacks often step the second line down to `--text-4` grey. Labels: mono 11px, +0.14em, uppercase.
- **Backgrounds:** `--bg-canvas` + 6% SVG grain + an ember radial glow from the top-left corner (and faint steel from bottom-right). Work areas use a dot grid; image placeholders use a 135° hatch. No full-bleed photography in chrome; user imagery sits on surfaces.
- **Line work:** dots, hatch, vertical bars, tick rulers, 24px grid (`--pattern-*`). Hairlines are white at 6/10/16/28% alpha. Selection/crop uses a 1px dashed white line with square corner handles.
- **Glass borders:** the signature. 1px transparent border with a gradient border-box layer: bright top edge (18%) fading to 3.5%, then 6% at bottom (`--glass-border`). Every elevated surface also has a 1px inner top highlight. Active panels may use `--glass-border-signal`.
- **Transparency & blur:** blur (24px, saturate 140%) only for floating layers — overlays, toasts, dialogs, capture HUD. Docked panes use the near-opaque `--glass-fill-strong` so text stays crisp.
- **Elevation:** shadow-0…3, each with the inner lip, outer shadows are long and soft (32–80px) and pure black. No colored shadows except the signal glow on primary hover.
- **Radii:** 4 (badges, keycaps), 6 (controls), 10 (cards, bubbles), 14 (panels), 20 (app window), 28 (device), pill for chips/outline buttons/switches.
- **Cards:** glass fill + gradient hairline + shadow-2. Never left-border accent stripes.
- **Hover:** surfaces step one ink level lighter or gain 4–8% white; text moves from text-3 to text-1. Primary gains the signal glow. **Press:** scale 0.98 and darker shade. **Focus:** 1px signal hairline + 3px soft signal ring.
- **Motion:** 120/200/360/640ms. `--ease-out` for hovers and menus, `--ease-in-out` for overlays, `--ease-snap` (slight overshoot) only for placing markups and toggles. Fades + 4px translate; no bounces elsewhere.
- **Layout:** desktop app, 14px outer margin around a 20px-radius window. Sidebar 232, inspector 296, toolbar 52, status bar 28. Fixed toolbar and status bar; canvas scrolls.
- **Density:** controls 28/34/42px. 4px base spacing with 2/6 half steps.

## Iconography
- **Lucide** (CDN, `lucide-static@0.460.0`), 1.5–2px stroke outline style, rendered through `<Icon name>` as a CSS mask so it inherits `currentColor`. Sizes 14 (dense) / 16 (default).
- No icon font, no PNG icons, no emoji. Unicode used only for `×`, `·`, `—`.
- Status uses filled dots (6–10px) with a soft glow of the same color, not icons.
- ⚠ Substitution: no icon set was provided; Lucide is the closest match to the concept's thin outline glyphs.

## Logo

**Added 2026-11-14 (Grant):** `assets/logo/collide-icon-512.svg` (512×512 app icon/mark) and `assets/logo/favicon.svg` (browser-tab size) — the signal-red rounded-square glyph. Use these files directly for the app icon, taskbar icon and favicon; never redraw or recolor them. Where a wordmark is needed beside the mark, "Collide" still sets in Geist Semibold, −4–5% tracking, text color `--text-1`.

## Fonts
⚠ Geist / Geist Mono are loaded from Google Fonts as a substitute. Supply licensed font files to replace `tokens/fonts.css`.
