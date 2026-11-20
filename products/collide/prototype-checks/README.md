# Collide prototype checks

These scripts drive `../layout-prototype.html` in Chromium (Playwright) and print what they find as JSON. Claude used them to check each prototype change on 2026-11-15. Every script passed against the prototype on the commit that added this folder.

They are the starting point for the **reference tests** in `../RUN3.md`. They are not acceptance tests yet: they print results instead of asserting them, they reach into the prototype's own state (`window.S`, `snipOf()`), and some use screen positions. Lydia (Tester) turns each one into an asserting Playwright spec that runs against both the prototype and the app (RUN3 task T30).

## Run one

```bash
cd products/collide/prototype-checks
node tabs-and-close-splash.js "$(realpath ../layout-prototype.html)" /tmp
```

The first argument is the prototype file, as an absolute path. The second is a folder for screenshots (some scripts save PNGs there). In the cloud box Playwright's Chromium is already installed; do not run `playwright install`.

## What each one covers

| Script | Prototype behaviour |
| --- | --- |
| `tabs-and-close-splash.js` | Tabs keep their own edits; closing a changed tab shows the splash; Esc keeps it; Close without saving; last tab closed shows the blank canvas |
| `print-area-and-bubble-stacking.js` | Bubbles stack beside each other; a dropped bubble snaps beside another; Copy takes the print area with a tight margin |
| `click-outside-returns-to-select.js` | A click outside the canvas or page (not the toolbar) goes back to Select and still lands |
| `delete-recents-items.js` | Delete a snip or zip from Recents with the splash; Esc keeps it; its tabs close |
| `markdown-text-tools.js` | Heading, Table, Num list, Label; unsaved mark; hide toolbar; full width; tables in the preview |
| `pen-colour-and-thickness-memory.js` | No colour stays selected after a draw; picking a tool restores the last colour and thickness, per editor, after a reload |
| `sidebar-toggles.js` | Snip delay and Add snip Current / Behind toggles, remembered after a reload |
| `pen-highlighter-and-page-leaders.js` | Pen and Highlighter strokes; resizing a stroke; Markdown bubbles, leaders and cards; Export from the page |
| `order-numbers-and-eraser.js` | List front to back; pens, highlighters and images without numbers or bubbles; eraser removes strokes only; reorder |
| `paste-image.js` | Paste into Snip (beside the image), into Markdown Edit and Preview (saved to images/ and linked), with nothing open (new snip); text paste untouched |
| `markdown-zoom.js` | Ctrl + wheel zooms around the cursor; drawing still lines up; Ctrl+0 fits |
| `markdown-margin-drawing.js` | Shapes and strokes can start in the margin beside the page |
| `save-collide-file.js` | Save as .collide from Snip and from Markdown |
| `callout-numbering.js` | A new callout takes the next number; existing numbers stay |
| `esc-returns-to-select.js` | Esc returns to Select in both editors, also from a note box |
| `add-snip-drag-box-and-crop.js` | Add snip shows the drag box (a click alone is not a snip, Esc cancels) and adds the box beside the image; the image card's Crop re-crops from the whole capture, keeps scale and position, Reset, Esc keeps it, undo |

## The reference harness (T30)

The asserting specs live in `../app/reference/specs/`, one per script above, same name with `.spec.ts`. Each runs twice: against the prototype, then against the app. The test hook both expose is in [`HOOK.md`](HOOK.md).

```bash
cd products/collide/app
pnpm ref              # both: builds the app (vite build), serves it, runs every spec on each
pnpm ref:prototype    # the prototype only: no build, no server
pnpm ref:app          # the app only
pnpm ref:prototype tabs        # one spec file (anything after the script name goes to Playwright)
REF_SHOTS=0 pnpm ref:prototype # skip the screenshots
```

The run ends with one line per spec, `prototype ✓/✗ · app ✓/✗`, and the totals; the same is written to `app/reference-out/report.json`. Screenshots go to `app/reference-out/screens/<prototype|app>/<spec>/<name>-<theme>-<size>.png` (`reference-out/` is not committed). The exit code is not 0 while any spec fails on either one.

Status: all 15 scripts are converted (`tabs-and-close-splash` is the example); every spec passes on the prototype.

### Writing a spec

- Import `test` and `expect` from `../fixture`. It gives `open()` (load the target fresh), `reload()` (keep what was saved), `state()` (`window.__collide.state()`) and `shots(name)` (1440 × 860 and 400 × 800 in Dark, Light and Aura Sage).
- Use the visible UI only: `getByRole`, `getByLabel`, `getByText`. No CSS classes, ids, `data-` attributes, `window.S`, `snipOf()` or app hooks other than `state()`. A drag on the canvas starts from a visible element's box (`locator.boundingBox()`), never from fixed screen numbers.
- Ids from `state()` are different in the prototype and the app: compare them inside one run, never write one into a spec.
- Wait with assertions that retry (`await expect(locator)…`, `await expect.poll(async () => (await state()).view).toBe("snip")`), not fixed sleeps.
- A spec must pass on the prototype. If it fails there, the spec is wrong (RUN3). If the prototype itself looks wrong, keep the spec as the prototype behaves and add a row to `../ISSUES.md`.
- Every test also fails on an uncaught error in the page (the scripts printed these as `errs`).
- What differs between the prototype and the app (how each is loaded, how a theme is set for a screenshot) goes in `fixture.ts`, not in a spec.
