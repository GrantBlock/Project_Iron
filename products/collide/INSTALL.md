# Installing Collide (Windows)

Collide is a screen snip and markup tool: snip part of the screen, mark it up with numbered callouts, notes, pens and highlights, then copy or export it. It also marks up Markdown files and PDFs.

## Download

| Link | Use it when |
| --- | --- |
| **Installer:** https://pub-91ea11eb33cc4fa19f970cc08c390d6b.r2.dev/windows/Collide-Setup.exe | You want Collide installed, with Start menu and desktop shortcuts, and updates. **Recommended.** The file is under 1 MB: it downloads Collide (about 80 MB) while it installs, so you need internet then. No admin rights needed; it installs for your user only. |
| **Portable:** https://pub-91ea11eb33cc4fa19f970cc08c390d6b.r2.dev/windows/Collide-portable.exe | You can't install software. Double-click to run; nothing is installed. It unpacks itself each time, so it starts slower (about 10–20 seconds), and it does not update itself. |

Windows 10 or 11, 64-bit. The links always give the newest version.

## Install

1. Download the installer and double-click `Collide-Setup.exe`.
2. **Windows protected your PC** may appear. Collide isn't code-signed yet, so Windows doesn't recognise the publisher. Click **More info**, check the name says Collide, then click **Run anyway**.
3. Choose where to install it (the default is fine) and click **Install**. It downloads Collide, then installs it.
4. Start Collide from the Start menu or the desktop shortcut.

## Updates

The installed Collide checks for a new version when it starts and every few hours, downloads it in the background, and installs it the next time you close Collide. **Settings → Updates** shows your version, has **Check now** and **Restart to update**, and lets you turn automatic checks off.

To uninstall: **Settings → Apps → Installed apps → Collide → Uninstall**. Your saved markups stay in `Documents\Collide\Markups`.

## Using it

- **New snip**, or **Ctrl + Alt + S** anywhere: Collide hides and you drag a box on the screen. Esc cancels.
- **Add snip**: adds another snip beside the open one. **Current** snips the screen as it is; **Behind** hides Collide first. Each added image has a **Crop** button in the list on the right.
- **Save** keeps a markup in `Documents\Collide\Markups`. **Save as .collide** makes one file you can send to someone else, who opens it in Collide.
- **Copy** puts the marked-up picture on the clipboard to paste into email, Teams or a document.

## Problems

- **The hotkey does nothing.** Another program may be using Ctrl + Alt + S. Change it in `settings.json` (Collide shows where if it can't register the hotkey).
- **Snips look blurry or offset on a second monitor or at 125–150% scaling.** Tell [contact] with your display setup; these are being checked.
- **The installer says the download failed.** Your network may block the download site (`r2.dev`). Ask IT to allow it, or use the portable file.
- **Antivirus blocks it.** Unsigned apps are sometimes flagged. Ask IT to allow Collide, or use the installer instead of the portable file.
