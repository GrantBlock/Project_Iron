// Collide — Electron main process.
// T13: shell. Opens the editor in a native-frame window with a locked-down page
// (contextIsolation on, sandbox on, no Node in the page).
// T14: the `window.collide` bridge (electron/preload.cjs). Capture and crop are
// real; the logic lives in src/native/ and src/snip/crop.ts (TypeScript, unit-
// tested) and is bundled to dist-electron/native.cjs by `pnpm build:electron`.
// Window choreography, settings and clipboard arrive in T15, storage in T16.
"use strict";

const { app, BrowserWindow, Menu, desktopCapturer, ipcMain, nativeImage, net, protocol } = require("electron");
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

function createEditorWindow() {
  const win = new BrowserWindow({
    title: "Collide",
    width: 1280,
    height: 800,
    show: false,
    icon: path.join(__dirname, "icons", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  void win.loadURL(startUrl);
  return win;
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
  native.registerBridge({
    ipcMain,
    screen,
    desktopCapturer,
    decodePng: (png) => nativeImage.createFromBuffer(Buffer.from(png.buffer, png.byteOffset, png.byteLength)),
    isTrusted: isAppUrl,
    broadcast: (channel, ...args) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(channel, ...args);
      }
    },
  });
  // Same as the Tauri window: the native frame only, no menu bar.
  // Dev keeps Electron's default menu for reload and DevTools.
  if (app.isPackaged) Menu.setApplicationMenu(null);
  createEditorWindow();
});

app.on("window-all-closed", () => app.quit());
