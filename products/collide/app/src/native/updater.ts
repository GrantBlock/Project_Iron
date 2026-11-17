// Updates (Grant 2026-11-17): electron-updater, bundled on its own (`pnpm build:electron` -> dist-electron/updater.cjs)
// so the main bundle and the unit tests never load it. electron/main.cjs requires it only in the installed app.
// The feed (Cloudflare R2, generic provider) comes from `build.publish` in package.json, written into the app as
// app-update.yml by electron-builder.
import { autoUpdater } from "electron-updater";

export { autoUpdater };
