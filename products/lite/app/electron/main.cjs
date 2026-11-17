// Lite — Electron main process (L01: shell).
// One window on the app's own build (lite://app/), the page locked down (context
// isolation and sandbox on, no Node), and no network: a content security policy that
// allows only local files, and every request of every page checked here — anything
// that would leave the machine is cancelled and logged. No update checks, no telemetry.
// The decisions live in src/native/ (TypeScript, unit-tested), bundled to
// dist-electron/native.cjs by `pnpm build:native`.
"use strict";

const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session } = require("electron");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function loadNative() {
  try {
    return require("../dist-electron/native.cjs");
  } catch (e) {
    throw new Error('dist-electron/native.cjs is missing or broken — run "pnpm build" and start Lite again.', { cause: e });
  }
}
const native = loadNative();

const APP_ID = "com.blockconcepts.lite";
const DIST = path.join(__dirname, "..", "dist");

// Dev only: `pnpm dev` passes the Vite server's address. Only plain http on this
// machine is accepted. A packaged app never reads it and always serves its own build.
const devUrl = app.isPackaged ? undefined : native.devServerUrl(process.env.LITE_DEV_URL);
const startUrl = devUrl || native.APP_URL;

// The Vite build uses absolute asset paths (/assets/...), so it is served from its
// own secure origin instead of file://.
protocol.registerSchemesAsPrivileged([
  { scheme: native.SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function serveDist(request) {
  const file = native.distFile(path, DIST, request.url);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set("Content-Security-Policy", native.CSP);
    return new Response(res.body, { status: res.status, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const isAppUrl = (url) => native.sameOrigin(url, startUrl);

// Every request of every session goes through the guard: local passes, the rest is cancelled and logged.
const guard = native.createRequestGuard({ devUrl, log: (line) => console.warn(line) });
function guardSession(ses) {
  ses.webRequest.onBeforeRequest((details, callback) => callback(guard(details)));
}
app.on("session-created", guardSession);

// Every page stays on the app: no pop-ups, no webviews, no navigation or redirect elsewhere.
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

// Open a folder (L08), read only: the page asks for a folder (the system dialog) and then for
// files by their path inside it. One folder at a time. src/native/folder.ts checks every path
// (inside the folder after symlinks, a regular file, at most 50 MB) and never writes.
let openFolderRoot = null;
const { constants } = require("node:fs");
const fsLike = {
  realpath: (p) => fsp.realpath(p),
  lstat: (p) => fsp.lstat(p),
  stat: (p) => fsp.stat(p),
  readdir: (p) => fsp.readdir(p),
  // Read only: O_RDONLY, plus O_NOFOLLOW where it exists (undefined on Windows; folder.ts re-checks there).
  open: (p, flags) => fsp.open(p, flags),
  flags: { readOnly: constants.O_RDONLY, noFollow: constants.O_NOFOLLOW },
};
const fromApp = (event) => isAppUrl(event.senderFrame?.url ?? "");

ipcMain.handle("lite:open-folder", async (event) => {
  if (!fromApp(event)) throw new Error("Refused");
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = { title: "Open folder", properties: ["openDirectory"] };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;
  const root = await fsp.realpath(result.filePaths[0]);
  const listing = await native.listFolder(root, fsLike, path);
  openFolderRoot = root;
  return listing;
});

ipcMain.handle("lite:read-file", async (event, rel) => {
  if (!fromApp(event) || !openFolderRoot) throw new Error("Refused");
  return native.readInside(openFolderRoot, rel, fsLike, path);
});

// The drawn window buttons (L10, frameless window): three actions from the app's own page, and
// the maximized state sent back so the maximize / restore icon follows the window.
ipcMain.on("lite:window", (event, action) => {
  if (!fromApp(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) native.applyWindowAction(win, action);
});

function createWindow() {
  const win = new BrowserWindow(native.windowOptions(path.join(__dirname, "preload.cjs")));
  win.once("ready-to-show", () => win.show());
  const sendMaximized = () => {
    if (!win.isDestroyed()) win.webContents.send("lite:maximized", win.isMaximized());
  };
  win.on("maximize", sendMaximized);
  win.on("unmaximize", sendMaximized);
  win.webContents.on("did-finish-load", sendMaximized);
  void win.loadURL(startUrl);
  return win;
}

app.whenReady().then(() => {
  guardSession(session.defaultSession);
  protocol.handle(native.SCHEME, serveDist);
  // No menu bar (the window is frameless). Dev keeps Electron's default menu for reload and DevTools.
  if (app.isPackaged) Menu.setApplicationMenu(null);
  createWindow();
});

app.on("window-all-closed", () => app.quit());
