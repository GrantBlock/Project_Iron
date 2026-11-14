# One server app: Agent Chat + Collide

Draft (not yet approved by Grant): 2026-11-14. Working name **[App name]**. Nothing in this plan is built yet.

**What Collide is (Grant):** a hosted chat and product editor, custom built for Grant's multi-PC, multi-chat-session workflow in AI development.

**Approved by Grant 2026-11-14:** the app is **Collide**, with sections **Collide Snip**, **Collide Chat** and **Collide Editor** (unpack a zip, edit its Markdown files with images from snip saves, repack). Order: P0 (Electron) first, then P1. Port 3500. Autosave on the server. Laptops keep local sessions in the left sidebar with a save-to-server (cloud) icon, and retry automatically. Single user. AI queue: 2. Tonight's run brief: `products/collide/RUN2.md`. Where this file says [App name], read Collide.

## Goal

Grant uses one main PC (the **server**) and connects from several laptops with RealVNC. Agent Chat and Collide are separate apps today. This plan merges them into **one desktop app with one server**. The server holds the chats, agent reports and markups, and runs the AI. Every laptop opens the same chats and markups, captures its own screen, and copies to its own clipboard.

## How it works

```
 Laptop A (Connected)        Laptop B (Connected)        Phone / any browser
 Electron window             Electron window             http://server:3500
   + local snip, clipboard     + local snip, clipboard     (view, chat, mark up)
   + outbox (unsaved work)     + outbox
            \                        |                        /
             \___________ LAN or Tailscale (100.x) __________/
                                     |
                     Server PC (Server mode, tray)
                     Node server, one port (3500)
                       /chat     Agent Chat (projects, messages, nightly reports)
                       /markups  Collide (markup folders, index, export)
                       /api/ai   claude CLI on the server, queued
                     Data: %APPDATA%\[App name]\  (chats, markups, config)
```

- **Same pattern as Agent Chat:** Electron + a plain Node server with no extra packages, Server and Connected modes, a Connect screen, a tray icon and Save-and-restart. `tools/project-chat/main.js` is the template.
- **One window, two sections** (left rail): **Chat** and **Markups**. In Server mode the window loads `http://localhost:3500`; in Connected mode it loads `http://<server>:3500`, exactly like Agent Chat today.
- **Local powers on each PC:** a preload bridge (like Agent Chat's `window.pc`) gives whatever page is loaded only these native actions:
  - New snip / Ctrl+Alt+S / snip delay: captures **this** PC's screen
  - Copy to clipboard: native Electron clipboard, works even though the page comes over http
  - Outbox: local storage used only to hold work until it is pushed to the server
- **AI runs once, on the server:** chats use the `claude` CLI on the server PC with Grant's subscription, as Agent Chat does now. Laptops don't need Claude installed or signed in. Replies arrive live (server events) on every device viewing that chat.

## RealVNC: what changes

| Today (VNC into the server) | With Connected mode |
| --- | --- |
| Snips capture the **server's** screen, not the laptop's | Snip captures the laptop's own screen |
| Image clipboard over VNC is unreliable (text usually syncs, images often don't) (A) | Copy writes to the laptop's own clipboard |
| One VNC viewer drives the server desktop at a time; others watch | Each laptop has its own window and chat; nothing blocks anyone else |
| Lag and scaling from remote rendering | Native window on each laptop |

VNC stays for admin jobs on the server: updates, `claude` login, settings. The server-mode window also keeps working inside a VNC session as before.

## Save and storage (from Grant's answers)

- **Server PC:** markups live in server storage. **Save is greyed out** on the server; edits save there directly (autosave on the server, see question 3).
- **Connected PC:** new snips and edits are kept in a local **outbox** until **Save** pushes them to the server. The outbox is only for transfer, not a second library. It is emptied after a successful push.
- **Format is unchanged:** each markup is a folder (`source.png`, `annotations.json`, `export.png`). The server adds an index (name, tags, who saved it, when).
- **Two laptops saving the same markup:** the server keeps a version number. A push based on an older version is refused with "Changed on the server by <device> at <time>: open theirs / save yours as a copy". Nothing is overwritten silently.

## Access and security

- **Required access code.** The server generates a code; each device enters it once and gets its own device token, stored on that device. The tray menu has **Devices…** to name or revoke them.
- Screenshots can hold customer data, so they **stay on the server PC**: no cloud copy. Tailscale (already in use, going by Agent Chat's `100.x` address) gives encrypted access from off-site without opening ports.
- The report token for GitHub reports stays as is (Lydia's nightly report flow is unchanged).
- This repository is public: no codes, tokens or addresses in it.

## Workflow features that come from merging

1. **Ask about this snip:** Collide's empty AI pane (right sidebar) becomes a chat thread tied to the markup. It sends the export PNG and callout notes to the agent.
2. **Snip into chat:** in any chat, New snip attaches the capture to your message.
3. **Agent reports with pictures:** Lydia's nightly report can link screenshots stored as markups.
4. **Distribution of chats:**
   - Every chat and markup is visible on every device.
   - Each message shows which device or person sent it.
   - AI runs go through a server queue (2 at a time (A)) so several laptops can't overload the server.
   - A busy indicator shows "queued, 1 ahead".

## Phases

Each phase is shippable on its own and keeps everything that already works.

| Phase | What | Done when |
| --- | --- | --- |
| P0 | Move Collide's shell from Tauri to Electron. No change in what it does. | Every current Collide test passes; snip, crop, delay, Copy and auto-copy work on Windows at 100% and 150% |
| P1 | One app, one server: Agent Chat's server and UI move into the new app (Chat section) next to Markups. Import Agent Chat data from `%APPDATA%\Project Chat`. | Old chats, projects and reports appear; Server/Connected switch, tray and Connect screen work for both sections |
| P2 | Markups on the server: storage API, index, outbox and Save push on Connected PCs, greyed-out Save on the server, version check on push. | Laptop snip → Save → visible on the server and the other laptop; conflict shows the choice |
| P3 | Access codes and devices: required code, device tokens, Devices… list, revoke. | A revoked laptop can't load or save |
| P4 | AI in markups: AI pane per markup, Ask about this snip, snip into chat, server AI queue. | A snip from a laptop gets an agent reply that every device sees |
| P5 | Phone/browser polish: read-only or light markup in a phone browser; Copy falls back to download over http. | Opens and is usable on a phone over Tailscale |

`tools/project-chat` is retired after P1 (kept in git history). The new app lives in `products/[app-name]/`. Collide's editor code moves there unchanged.

## Questions for Grant

1. **Name:** what is the one app called? Agent Chat, Collide, or a new name?
2. **Port:** keep 3500 so existing Agent Chat links and the report setup keep working?
3. **Save on the server PC:** autosave as you edit, with Save greyed out? (Recommended.)
4. **Unsent work on a laptop:** if the server is off, keep it in the outbox and retry automatically, or wait for you to press Save?
5. **Who uses it:** only you, or other people too? This decides whether messages show a device name or a person's name, and whether people need their own logins.
6. **AI queue:** how many AI replies may run at once on the server? 2 is assumed (A).
7. **Order:** start with P0 (Collide to Electron) as planned, or P1 first (move Agent Chat into the new shell, with Collide still on Tauri)?
