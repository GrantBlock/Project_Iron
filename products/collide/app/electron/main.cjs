// Collide — Electron main process.
// T13: shell. Opens the editor in a native-frame window with a locked-down page
// (contextIsolation on, sandbox on, no Node in the page).
// T14: the `window.collide` bridge (electron/preload.cjs). Capture and crop.
// T15: the snip's window moves, the overlay window, settings.json and the global
// hotkey, copyImage.
// T16: markup folders under Documents/Collide/Markups and the Open folder dialog.
// This file only creates windows and passes Electron's modules on: the logic
// lives in src/native/ and src/snip/crop.ts (TypeScript, unit-tested) and is
// bundled to dist-electron/native.cjs by `pnpm build:electron`.
"use strict";

const { app, BrowserWindow, Menu, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, net, protocol } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function loadNative() {
  try {
    return require("../dist-electron/native.cjs");
  } catch (e) {
    throw new Error('dist-electron/native.cjs is missing or broken — run "pnpm build:electron" and start Collide again.', { cause: e });
  }
}
const native = loadNative();

const APP_ID = "com.blockconcepts.collide";
const SCHEME = "collide";
const APP_URL = `${SCHEME}://app/`;
const DIST = path.join(__dirname, "..", "dist");

// Dev only: `pnpm electron:dev` passes the Vite server's address. Only plain
// http on this machine is accepted. A packaged app never reads it and always
// serves its own build.
const devUrl = app.isPackaged ? undefined : native.devServerUrl(process.env.COLLIDE_DEV_URL);
const startUrl = devUrl || APP_URL;

// The Vite build uses absolute asset paths (/assets/...), so it is served from
// its own secure origin instead of file://.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function serveDist(request) {
  const file = native.distFile(path, DIST, request.url);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    return await net.fetch(pathToFileURL(file).toString());
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const isAppUrl = (url) => native.sameOrigin(url, startUrl);

// Test only: `COLLIDE_FAKE_CAPTURE=1` swaps the screen grab for a fixed pattern
// (src/native/fakeCapturer.ts) so the snip can run end to end without a real
// screen. A packaged app never reads it.
const fakeCapture = !app.isPackaged && process.env.COLLIDE_FAKE_CAPTURE === "1";

const webPreferences = {
  preload: path.join(__dirname, "preload.cjs"),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
};

let editor = null;
/** { window, loaded } once a snip has needed it. */
let overlay = null;
let quitting = false;
/** What loading settings.json and registering the hotkey gave (the page reads it at startup). */
let settingsStatus = null;

function createEditorWindow() {
  const win = new BrowserWindow({
    title: native.APP_NAME,
    width: 1280,
    height: 800,
    show: false,
    icon: path.join(__dirname, "icons", "icon.png"),
    webPreferences,
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    editor = null;
    // The overlay is never the last window: without the editor there is nothing to snip for.
    if (overlay && !overlay.window.isDestroyed()) overlay.window.destroy();
  });
  void win.loadURL(startUrl);
  return win;
}

// The capture overlay, as the Tauri shell configured it: transparent, frameless,
// always on top, not in the taskbar, hidden until a snip shows it. Not OS-
// fullscreen: that would pick the monitor the window is on, not the captured one.
function createOverlayWindow() {
  const win = new BrowserWindow({
    title: "Collide overlay",
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreenable: false,
    hasShadow: false,
    // The page decodes and shows the frozen frame while the window is still hidden.
    webPreferences: { ...webPreferences, backgroundThrottling: false },
  });
  const loaded = new Promise((resolve) => {
    win.webContents.once("did-finish-load", resolve);
    win.webContents.once("did-fail-load", resolve);
    win.once("closed", resolve);
  });
  // Alt+F4 on the overlay must not strand a snip with the editor hidden: Esc cancels instead.
  win.on("close", (event) => {
    if (!quitting && editor && !editor.isDestroyed()) event.preventDefault();
  });
  win.on("closed", () => {
    if (overlay && overlay.window === win) overlay = null;
  });
  void win.loadURL(new URL("overlay.html", startUrl).toString());
  return { window: win, loaded };
}

function broadcast(channel, ...args) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  }
}

// Every page, present and future, stays on the app: no pop-ups, no webviews,
// no navigation or redirect to anywhere else.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
});

if (process.platform === "win32") app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  protocol.handle(SCHEME, serveDist);
  // `screen` can only be used once the app is ready.
  const { screen } = require("electron");
  const decodePng = (png) => nativeImage.createFromBuffer(Buffer.from(png.buffer, png.byteOffset, png.byteLength));
  native.registerBridge({
    ipcMain,
    screen,
    desktopCapturer,
    decodePng,
    isTrusted: isAppUrl,
    broadcast,
    windows: native.createChoreography({
      editor: () => editor,
      overlay: () => {
        if (!overlay || overlay.window.isDestroyed()) overlay = createOverlayWindow();
        return overlay;
      },
    }),
    copyImage: (png) => native.copyImage(png, { imageFromPng: decodePng, writeImage: (image) => clipboard.writeImage(image) }),
    settingsStatus: () => settingsStatus,
    // Files only under Documents/Collide/Markups: src/native/markups.ts checks every path.
    markups: native.createMarkups({
      fs,
      path,
      documents: () => app.getPath("documents"),
      showOpenDialog: (options) => (editor && !editor.isDestroyed() ? dialog.showOpenDialog(editor, options) : dialog.showOpenDialog(options)),
    }),
    capturer: fakeCapture
      ? native.fakeCapturer({
          screen,
          createBitmap: (bgra, size) => nativeImage.createFromBitmap(Buffer.from(bgra.buffer, bgra.byteOffset, bgra.byteLength), size),
        })
      : undefined,
  });
  // settings.json sits in the user-data folder; the hotkey in it (default Ctrl+Alt+S) asks the editor for a snip.
  settingsStatus = native.setupHotkey(app.getPath("userData"), { fs, path, mac: process.platform === "darwin" }, globalShortcut, () =>
    broadcast(native.SNIP_REQUEST_CHANNEL),
  );
  // Same as the Tauri window: the native frame only, no menu bar.
  // Dev keeps Electron's default menu for reload and DevTools.
  if (app.isPackaged) Menu.setApplicationMenu(null);
  editor = createEditorWindow();
});

app.on("before-quit", () => {
  quitting = true;
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
