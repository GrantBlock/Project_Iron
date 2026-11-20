# Lite: issues for Grant

| # | Task | Issue | (A) default used | Status |
| --- | --- | --- | --- | --- |
| 1 | L02 | Prototype quirk: the suggested question "What do I do before servicing the gearbox?" gets the "could not find" answer (keyword is "service") | App copies the prototype | Decided 2026-11-17: fix (Grant) |
| 2 | L02 | Prototype quirk: the oil answer shows 3 citation chips because one citation appears twice | App copies the prototype | Decided 2026-11-17: keep (Grant) |
| 3 | L02 | Prototype quirk: open/closed folders reset when an item is selected or a search runs | App copies the prototype | Decided 2026-11-17: fix (Grant) |
| 4 | L02 | Prototype quirk: search highlights show only after a result is opened, and only on pages with the term | App copies the prototype | Decided 2026-11-17: keep (Grant) |
| 5 | L01 | Renderer is plain TypeScript + DOM (React is not on the dependency allowlist) | Plain TS + DOM | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 6 | L01 | Window does not remember its size yet; `.exe` has no icon; `pnpm dist` not run (needs Windows) | Later | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 7 | L03 | Frameless window with the prototype's drawn window buttons, or the normal Windows title bar? | Normal Windows title bar; drawn buttons left out in Electron | Decided 2026-11-17: frameless with drawn buttons (Grant) |
| 8 | L02 | Screenshot pixel counts as different above 2/255 per channel | 2/255 | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 9 | L08 | Markdown is shown as plain read-only text (markdown-it is approved for Collide but not on Lite's list) | Plain text | Decided 2026-11-17: markdown-it, raw HTML off (Grant) |
| 10 | L08 | Open folder: other file types and files over 50 MB are listed but not opened; symlinks are not listed; listing stops at 5000 entries and 12 levels (the deepest folder is listed, not opened) | As stated | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 11 | L08 | Opening a new folder replaces the previous one; Open folder is in the Electron app only | As stated | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 12 | L08 | Search finds text in PDFs but does not highlight it on the PDF page | No PDF highlights | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 13 | L10 | Frameless window: minimum size, and the prototype's backdrop margin and rounded frame in the app | Minimum 400 × 500 (the phone-width tabs still fit); in the Electron app the window edge is the frame (no backdrop margin, no rounded corners), and the window buttons show under 900px too (the prototype hides its drawn ones there); the web build is unchanged | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
| 14 | L10 | Markdown details not in the decision | Headings shifted down one level (the file name is the view's h1); images: png, jpg, gif, webp inside the opened folder only (others, SVG, remote and data: show the alt text); links show as link text, never open; search looks through the visible text | Decided 2026-11-19: keep the (A) default (Grant, "approve on everything") |
