# Snip & Markup — UI kit

Click-through recreation of the Phase 1 Snip & Markup concept (uploads/pasted-1794628183346-0.png), restyled in Collide.

Screens
- **Editor** — three panes: Recent/Tags sidebar · canvas · Callouts + AI chat inspector. Toolbar on top, status bar below.
- **Capture overlay** — press `Ctrl+Alt+S` or *New snip*; drag a region, release to crop, `Esc` to cancel.
- **Export dialog** + toasts.

Interactions: pick Rect / Ellipse / Arrow and drag on the canvas to add a markup (each adds a numbered callout); suggestion chips and the composer send to the fake AI; switch files in Recent.

Files: `index.html` (app shell + state), `Toolbar.jsx`, `Sidebar.jsx`, `Canvas.jsx`, `Inspector.jsx`, `CaptureOverlay.jsx`. All primitives come from the Collide components (loaded via `tools/ds-loader.js`).

Not decided in the spec, so left out on purpose: single vs. all-monitor capture, default AI (offline Ollama vs Claude — shown as a picker), export branding.
