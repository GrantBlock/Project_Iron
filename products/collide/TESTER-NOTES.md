# Collide: notes for Lydia (Tester)

2026-11-14 · From Grant's session `claude/peaceful-babbage-04aj3j`, merged into `development`. These changes came from Grant testing Collide on Windows 11. What is automated is listed under each item; the **Windows** lines are what still needs a real check on Grant's PC (no Windows box in the cloud).

Run: `cd products/collide/app && pnpm install && pnpm test && pnpm e2e --trace off && xvfb-run -a pnpm e2e:electron --trace off` (`xvfb-run -a` on Linux only). Desktop app: `pnpm electron:dev`. At the 2026-11-14 merge: Vitest 117, Playwright 39, `cargo` 20; since T17 (run 2) there is no Rust, and the 20 `cargo` tests are Vitest tests (table in `app/CLAUDE.md`).

## What changed and how to test it

1. **No ghost of the editor in snips.** `hide_editor` moves the editor off-screen before hiding it, so the Windows fade-out isn't captured; wait raised 150 → 300 ms (`src-tauri/src/snip.rs`, `src/snip/tauriDeps.ts`).
   - Windows: Ctrl+Alt+S from another app. The capture has no half-transparent Collide in it. After the snip, the editor comes back in the same place, including when maximized.
2. **Copy to clipboard** (button next to Export, Ctrl+Shift+C). Copies the image plus every annotation and note box, auto-cropped, with a 24 px margin on the canvas background (`#09090B`) when anything spills past the image.
   - Automated: `e2e/fit.spec.ts`. Windows: paste into Paint / Teams / Word. Size and contents match the editor.
3. **Canvas refits and recentres on window resize** while in fit view. After a user zoom, resizing keeps the zoom and the centred point. Ctrl+0 refits (`e2e/fit.spec.ts`).
4. **Callout note boxes outside the image.** Every rectangle, ellipse, filled shape, X mark and point gets a numbered box on the nearest side, stacked so boxes don't overlap, with an arrow to the shape. Drag a box to move it; drag its right edge to resize it; the height fits the text. Double-click to edit on the canvas (Enter saves, Esc cancels), or type in the Callouts panel.
   - An empty note shows as a number chip with an arrow (in Copy/Export too).
   - **Hide #** (per callout, right sidebar) dims the box and arrow in the editor and leaves them out of Copy/Export.
   - Automated: `src/editor/notes.test.ts`, `e2e/fit.spec.ts`.
5. **Toolbar:** Select, Rectangle, Ellipse, Filled rectangle, Filled ellipse, X mark (X), Point (P). The Arrow, Text and Callout tools were removed. Old markups with those shapes still open and display (`e2e/tools.spec.ts`).
6. **Desktop window: one border, one title.** In Tauri, the native Windows title bar is kept and the in-app frame/title row is dropped. The browser build keeps the framed look (`e2e/frame.spec.ts`).
   - Windows: `pnpm electron:dev`. One title bar, no rounded inner panel, no gap at the edges.

7. **A finished snip is copied to the clipboard automatically**, like Snipping Tool. Toast: "Snip copied to clipboard". If the copy fails, the snip still opens and the toast says why (`e2e/snip.spec.ts`).
   - Windows: Ctrl+Alt+S, drag a box, then paste straight into another app without clicking Copy.

8. **Canvas snip** (button next to New snip). Drag a box over the canvas: the area (image + markups + canvas background), at source resolution, is copied to the clipboard and opened as a new markup. A W × H readout shows while dragging; Esc leaves the mode (`e2e/snip.spec.ts`).
   - The current markup is replaced, the same as New snip, so save first if you need it.
9. **Snip delay** (timer picker next to New snip): No delay / 3 s / 5 s / 10 s, as in Snipping Tool. The editor hides, waits the delay, then captures. Applies to Ctrl+Alt+S too (A). Remembered on this computer (`src/snip/flow.test.ts`, `e2e/snip.spec.ts`).
   - Windows: pick 3 s, click New snip, open a menu in another app within 3 s, and check the menu is in the capture.

10. **Right-drag pans the canvas** in every tool (Space + left-drag still works). A right-press never selects, moves or draws, and the browser/WebView context menu is suppressed on the canvas (`e2e/editor.spec.ts`).
   - Windows: right-drag over a shape and over empty canvas with a mouse; also try a touchpad two-finger click.

## Run 2+3 (Electron) — Windows manual checks (Grant/Lydia)

Do these on Windows. Note pass/fail and attach a screenshot for each.

1. In `products/collide/app`: `pnpm install && pnpm electron:dev`. The app opens in an Electron window.
2. Run TESTER-NOTES items 1-10 above on Electron.
3. `pnpm dist`, then run the portable `.exe` from `release/`. Check items 1, 2, 7 and 9 at 100% and at 150% display scaling.
4. Press the real Ctrl+Alt+S from another app (not Collide). The overlay must appear and the snip must open in Collide.
5. Overlay on a second monitor: place it left of or above the primary monitor (negative origin) and use mixed scaling (e.g. 100% and 150%). The capture must match the area you dragged.
6. Add snip, Current and Behind: both toggles, with a snip added to an open markup.
7. Collapse the window in both sizes, windowed and maximized, and check the sidebar and toolbar layout.
8. Open dialogs: the folder Open dialog and the file Open dialog; also open a folder outside Markups.
9. Save as .collide, close, and reopen the file. Markups, notes and order must be unchanged.
10. Markdown in a zip: save a Markdown markup with images and open the zip to check its contents.
11. Settings -> Storage with a retention period set: old items go as set and recent ones stay.
12. Open a real PDF, mark it up, Export PDF, and Copy PNG; paste the PNG into another app.

## Known gaps / watch for

- **Export still saves at the source image size**, so note boxes outside the image are cut off in Export and `export.png`. Grant hasn't decided yet whether Export should crop like Copy. Report it, don't file it as a bug.
- Auto-placed boxes keep their place in shape order. Deleting an early shape can shift the auto-placed boxes after it; boxes the user moved stay where they are.
- All keyboard shortcuts are provisional until the accessibility spec (ISSUES #10).
- `e2e/history.spec.ts` "row and shape selection stay in sync" failed once under a full parallel run and then passed on every rerun. Watch for flakiness.
- The e2e desktop check (`frame.spec.ts`) uses a stub `window.collide` bridge (Tauri until run 2 T17). It proves the layout switch, not the real window.

## Please report back (issue #2 nightly report)

- Windows results for items 1, 2 and 6, with screenshots.
- Any DPI or multi-monitor problem with the note boxes or Copy at 100% and 150% scaling.
