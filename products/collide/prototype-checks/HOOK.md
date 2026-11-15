# The test hook: `window.__collide.state()`

RUN3 task T30. The prototype (`../layout-prototype.html`) and the app (`../app/`) expose the same read-only call. Reference specs use it and visible UI only, never `window.S`, `snipOf()` or app internals.

- **Read-only.** It returns a fresh plain JSON object each call and changes nothing.
- **Prototype:** one `<script>` block at the end of `layout-prototype.html`. It reads the prototype's state; no prototype behaviour changed (the 15 scripts in this folder print the same results as before).
- **App:** `app/src/editor/refState.ts` builds it from the app's real state; `EditorShell.tsx` exposes it. Concepts the app does not have yet are `null`, `[]` or `false`.
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

## The app today (before T31 to T34)

The app has one image, no tabs and one editor. Until the layout and the engine are built it reports: `view` `"blank"` or `"snip"`; `tabs` one entry while an image is open (`dirty` always `false`: the app does not track unsaved changes yet); `mode`, `aura`, `bubble`, `points` and `splash` `null`; `theme` `"dark"`; `sidebar.addMode` `"Current"`, `sidebar.collapsed` `false`; item types and colours as the app stores them (hex colours, `callout`, `highlight`, `arrow`, `text`); `hidden.bubble` from the app's "Hide #" toggle. The task that builds each part moves its fields to the prototype's values.
