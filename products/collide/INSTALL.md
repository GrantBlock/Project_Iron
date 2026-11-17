# Installing Collide (Windows)

Collide is a screen snip and markup tool: snip part of the screen, mark it up with numbered callouts, notes, pens and highlights, then copy or export it. It also marks up Markdown files and PDFs.

## Which file

| File | Use it when |
| --- | --- |
| `Collide-Setup-<version>.exe` | You want Collide installed, with Start menu and desktop shortcuts. **Recommended.** No admin rights needed; it installs for your user only. |
| `Collide-<version>-portable.exe` | You can't install software. Double-click to run; nothing is installed. It unpacks itself each time, so it starts slower (about 10–20 seconds). |

Windows 10 or 11, 64-bit.

## Install

1. Double-click `Collide-Setup-<version>.exe`.
2. **Windows protected your PC** may appear. Collide isn't code-signed yet, so Windows doesn't recognise the publisher. Click **More info**, check the name says Collide, then click **Run anyway**.
3. Choose where to install it (the default is fine) and click **Install**.
4. Start Collide from the Start menu or the desktop shortcut.

To uninstall: **Settings → Apps → Installed apps → Collide → Uninstall**. Your saved markups stay in `Documents\Collide\Markups`.

## Using it

- **New snip**, or **Ctrl + Alt + S** anywhere: Collide hides and you drag a box on the screen. Esc cancels.
- **Add snip**: adds another snip beside the open one. **Current** snips the screen as it is; **Behind** hides Collide first. Each added image has a **Crop** button in the list on the right.
- **Save** keeps a markup in `Documents\Collide\Markups`. **Save as .collide** makes one file you can send to someone else, who opens it in Collide.
- **Copy** puts the marked-up picture on the clipboard to paste into email, Teams or a document.

## Problems

- **The hotkey does nothing.** Another program may be using Ctrl + Alt + S. Change it in `settings.json` (Collide shows where if it can't register the hotkey).
- **Snips look blurry or offset on a second monitor or at 125–150% scaling.** Tell [contact] with your display setup; these are being checked.
- **Antivirus blocks it.** Unsigned apps are sometimes flagged. Ask IT to allow Collide, or use the installer instead of the portable file.
