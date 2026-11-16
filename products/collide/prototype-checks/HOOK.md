# The test hook: `window.__collide.state()`

RUN3 task T30. The prototype (`../layout-prototype.html`) and the app (`../app/`) expose the same read-only call. Reference specs use it and visible UI only, never `window.S`, `snipOf()` or app internals.

- **Read-only.** It returns a fresh plain JSON object each call and changes nothing.
- **Prototype:** one `<script>` block at the end of `layout-prototype.html`. It reads the prototype's state; no prototype behaviour changed (the 15 scripts in this folder print the same results as before).
- **App:** `app/src/editor/refState.ts` builds it from the app's real state; `EditorShell.tsx` exposes it, always. Concepts the app does not have yet are `null` or `[]`.
- **Ids are opaque.** Tab and item ids differ between the prototype and the app. Compare them inside one run (for example `selection` against `items[].id`); never write one into a spec.

## Shape (version 1)

```ts
{
  version: 1,
  view: "blank" | "snip" | "markdown" | "image" | "file" | "settings",  // what the canvas shows
  mode: "edit" | "preview" | null,          // Markdown only
  tabs: [{ id, title, kind, dirty, active }], // left to right; kind is a view name; dirty = unsaved changes
  editor: "snip" | "markdown" | null,       // which markup editor is open
  activeTool: string | null,                // null when no drawing surface is open (Markdown Edit, settings, blank)
  color: "red" | "blue" | "yellow" | "gray" | null, // the pressed colour; null after a draw (nothing pressed)
  stroke: number | null,                    // the line thickness of the open editor
  items: [{                                 // front to back, like the list beside the canvas
    id, type,                               // rect, ellipse, line, cross, point, pen, hl, image
    number: number | null,                  // the display number; null for pens, highlighters and images
    note: string,
    hidden: { text, bubble, outline },      // the three card toggles
    fill: number,                           // percent, 0 to 100
    color: string | null, stroke: number | null,
    x, y, w, h,                             // image pixels (Snip) or page pixels (Markdown), 2 decimals
    points: number | null,                  // pen and highlighter: how many points the stroke has
    bubble: { x, y, w, h, moved } | null,   // the note bubble as placed; moved = the user dropped it there
  }],
  selection: [ids],                         // selected items
  zoom: { percent, fit } | null,            // percent as the status bar shows it; fit = fitted to the window
  theme: "system" | "light" | "dark" | "aura",
  aura: string | null,                      // the Aura ground ("sage"), only when theme is "aura"
  sidebar: { delay, addMode, collapsed },   // "No delay" | "3 s" | "5 s" | "10 s"; "Current" | "Behind"
  splash: { kind: "close" | "delete", title } | null, // the ask-first screen and what it is about
}
```

## What is not in it (use the visible UI)

Recents and the file tree, the Markdown source text, toasts, the status bar, the print-area frame and its size, the image size. Find these by role, label or text.

## The app today (after T31, before T32 to T34)

The layout shell is built: tabs, views, themes, the sidebar choices and the two splash screens report the prototype's values. The markup engine inside a Snip tab is still the old one.

| Field | The app today |
| --- | --- |
| `view`, `tabs`, `splash`, `theme`, `aura`, `sidebar` | as the prototype (T31) |
| `editor` | `"snip"` or `"markdown"` for the tab in front, else `null` |
| `mode` | `"edit"` on a Markdown tab (a read-only placeholder until T34), else `null` |
| `activeTool`, `color`, `stroke` | a Snip tab: the toolbar's values as the app stores them (the colour is a design-system token); `null` elsewhere |
| `items` | a Snip tab: the shapes front to back; `type` and `color` as stored (`callout`, `highlight`, `arrow`, `text`; hex colours); `number` from the callout number; `hidden.bubble` from "Hide #"; `fill` 0 or 100; `points` and `bubble` `null`. `[]` on a Markdown tab |
| `zoom` | a Snip tab: the status bar's percent and whether the view is fitted |

**After T32 (the markup engine, Snip):** a Snip tab reports as the prototype: `activeTool` (select, rect, ellipse, line, cross, point, pen, hl, eraser), `color` (one of the four, `null` after a draw), `stroke`; `items` with `type` as the prototype's, `number` counted from the back (`null` for pens and highlighters), `hidden` from the card toggles (an old "Hide #" reads as `bubble`), `fill` in percent (an old filled shape reads as 30), `color` as stored (a role, or an old markup's hex), `points` for strokes and `bubble` as laid out (`moved` when dropped by the user). Sizes are image pixels; bubble sizes scale with the image (one unit per 640 px of width, as in the prototype).

The reference fixture opens the app with `?sample`, which loads the prototype's sample Recents (`app/src/shell/sample.ts`, dev and test only). The task that builds each remaining part moves its fields to the prototype's values. The app's `window.__collide` also has older helpers (`openImage`, `seedShape`, `getState`, `getDoc`, ...) used by `app/e2e/`; reference specs never call them.
