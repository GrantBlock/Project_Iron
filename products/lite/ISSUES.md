# Lite: issues for Grant

| # | Task | Issue | (A) default used | Status |
| --- | --- | --- | --- | --- |
| 1 | L02 | Prototype quirk: the suggested question "What do I do before servicing the gearbox?" gets the "could not find" answer (keyword is "service") | App copies the prototype | Open: Planner suggests fixing |
| 2 | L02 | Prototype quirk: the oil answer shows 3 citation chips because one citation appears twice | App copies the prototype | Open: Planner suggests keeping |
| 3 | L02 | Prototype quirk: open/closed folders reset when an item is selected or a search runs | App copies the prototype | Open: Planner suggests fixing |
| 4 | L02 | Prototype quirk: search highlights show only after a result is opened, and only on pages with the term | App copies the prototype | Open: Planner suggests keeping |
| 5 | L01 | Renderer is plain TypeScript + DOM (React is not on the dependency allowlist) | Plain TS + DOM | (A) |
| 6 | L01 | Window does not remember its size yet; `.exe` has no icon; `pnpm dist` not run (needs Windows) | Later | (A) |
| 7 | L03 | Frameless window with the prototype's drawn window buttons, or the normal Windows title bar? | Normal Windows title bar; drawn buttons left out in Electron | Open: Planner suggests frameless |
| 8 | L02 | Screenshot pixel counts as different above 2/255 per channel | 2/255 | (A) |
| 9 | L08 | Markdown is shown as plain read-only text (markdown-it is approved for Collide but not on Lite's list) | Plain text | Open: use markdown-it? |
| 10 | L08 | Open folder: other file types and files over 50 MB are listed but not opened; symlinks are not listed; listing stops at 5000 entries and 12 levels (the deepest folder is listed, not opened) | As stated | (A) |
| 11 | L08 | Opening a new folder replaces the previous one; Open folder is in the Electron app only | As stated | (A) |
| 12 | L08 | Search finds text in PDFs but does not highlight it on the PDF page | No PDF highlights | (A) |
