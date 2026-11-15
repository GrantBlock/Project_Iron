// Collide — Electron main process.
// T13: shell only. Opens the editor in a native-frame window with a locked-down
// page (contextIsolation on, sandbox on, no Node in the page). Capture, snip,
// settings and storage arrive with the bridge in T14–T16.
"use strict";

const { app, BrowserWindow, Menu, net, protocol } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_ID = "com.blockconcepts.collide";
const SCHEME = "collide";
const APP_URL = `${SCHEME}://app/`;
const DIST = path.join(__dirname, "..", "dist");

// Dev only: `pnpm electron:dev` passes the Vite server's address. A packaged
// app never reads it and always serves its own build.
const devUrl = app.isPackaged ? undefined : process.env.COLLIDE_DEV_URL;
const startUrl = devUrl || APP_URL;

// The Vite build uses absolute asset paths (/assets/...), so it is served from
// its own secure origin instead of file://.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Maps a collide://app/... request to a file inside dist/, or null if it would leave it. */
function distFile(requestUrl) {
  const { host, pathname } = new URL(requestUrl);
  if (host !== "app") return null;
  const file = path.join(DIST, decodeURIComponent(pathname === "/" ? "/index.html" : pathname));
  const rel = path.relative(DIST, file);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return file;
}

async function serveDist(request) {
  let file;
  try {
    file = distFile(request.url);
  } catch {
    file = null;
  }
  if (!file) return new Response("Not found", { status: 404 });
  try {
    return await net.fetch(pathToFileURL(file).toString());
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

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

  // The page stays on the app: no pop-ups, no navigation elsewhere.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!sameOrigin(url, startUrl)) event.preventDefault();
  });

  void win.loadURL(startUrl);
  return win;
}

if (process.platform === "win32") app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  protocol.handle(SCHEME, serveDist);
  // Same as the Tauri window: the native frame only, no menu bar.
  // Dev keeps Electron's default menu for reload and DevTools.
  if (app.isPackaged) Menu.setApplicationMenu(null);
  createEditorWindow();
});

app.on("window-all-closed", () => app.quit());
