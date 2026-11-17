# Lite: tester notes

## Windows manual checks (Grant/Lydia)

Do these on Windows. Note pass or fail and attach a screenshot for each. Report back on issue #2.

1. In `products/lite/app`: `pnpm install && pnpm dev`. Lite opens in its own window at 1280 × 800 with the sample package and About selected.
2. Click through the tree: each document (Previous/Next, page count), each note, each model. The models show the "Sample model" tag; orbit, zoom, Fit to view and the parts list highlight work.
3. Search this package: type "lockout", then "gearbox"; the tree narrows and matches are highlighted on the page. Clear the search: the full tree returns.
4. Assistant: each of the three suggested questions, then a typed question. Citation chips and source rows open the right page. The Assistant button hides and shows the right side.
5. Narrow the window below 900 px: Files, View and Assistant tabs appear and work; widen it again and the three areas return.
6. Open folder: pick a folder with a PDF, a Markdown file, a text file and a GLB (a sub-folder too). Each opens read-only; search finds words inside the PDF and the Markdown. Afterwards, the files' modified dates are unchanged.
7. Open folder on a OneDrive folder and on a network share path (\\server\share): local OneDrive files open; the network share is refused or not listed.
8. Unplug the network (or turn on airplane mode) and repeat 1–4: everything works offline.
9. `pnpm dist`, then run the portable `.exe` from `release/`. Repeat 1 and 2 at 100% and 150% display scaling.
10. On a PC without a graphics driver (or in a VM without 3D), open a model: the placeholder shows and the parts list still works.

## Known gaps / watch for

- The Electron window uses the normal Windows title bar; the prototype's drawn window buttons are left out until Grant decides (ISSUES 7).
- The prototype's quirks are copied on purpose (ISSUES 1–4). Report them, don't file them as bugs.
- Markdown shows as plain text (ISSUES 9).
- The window does not remember its size; the `.exe` has no icon yet.
