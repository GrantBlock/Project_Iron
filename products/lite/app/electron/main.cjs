// Lite — Electron main process (L01: shell).
// One window on the app's own build (lite://app/), the page locked down (context
// isolation and sandbox on, no Node), and no network: a content security policy that
// allows only local files, and every request of every page checked here — anything
// that would leave the machine is cancelled and logged. No update checks, no telemetry.
// The decisions live in src/native/ (TypeScript, unit-tested), bundled to
// dist-electron/native.cjs by `pnpm build:native`.
"use strict";

const { app, BrowserWindow, Menu, net, protocol, session } = require("electron");
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

function createWindow() {
  const win = new BrowserWindow(native.windowOptions(path.join(__dirname, "preload.cjs")));
  win.once("ready-to-show", () => win.show());
  void win.loadURL(startUrl);
  return win;
}

app.whenReady().then(() => {
  guardSession(session.defaultSession);
  protocol.handle(native.SCHEME, serveDist);
  // The native frame only, no menu bar. Dev keeps Electron's default menu for reload and DevTools.
  if (app.isPackaged) Menu.setApplicationMenu(null);
  createWindow();
});

app.on("window-all-closed", () => app.quit());
