// Desktop wrapper. Two modes:
//   server — runs the chat server on this PC and shows it in a window (default)
//   client — connects to Project Chat running on another computer; no local server
'use strict';
const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage, clipboard, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Config + data live in %APPDATA%\Project Chat (writable, survives updates)
const HOME = path.join(app.getPath('appData'), 'Project Chat');
process.env.PROJECT_CHAT_HOME = HOME;
const DESKTOP_CFG = path.join(HOME, 'desktop.json');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win, setupWin, tray, srv, quitting = false;
const ICON = path.join(__dirname, 'build', 'icon.png');

// ---------- desktop settings ----------
function loadDesktop() {
  try { return JSON.parse(fs.readFileSync(DESKTOP_CFG, 'utf8')); } catch { return { mode: 'server', serverUrl: '' }; }
}
function saveDesktop(d) {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(DESKTOP_CFG, JSON.stringify(d, null, 2));
}
function normalizeUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  if (!/:\d+$/.test(u.replace(/^https?:\/\//i, ''))) u += ':3500';
  return u;
}
async function testServer(url) {
  try {
    const r = await fetch(url + '/api/health', { signal: AbortSignal.timeout(5000) });
    return r.ok ? { ok: true } : { ok: false, error: 'Server answered with status ' + r.status };
  } catch (e) {
    return { ok: false, error: 'Could not reach ' + url + ' (' + (e.cause && e.cause.code || e.message) + ')' };
  }
}
const desktop = loadDesktop();

// ---------- windows ----------
function chatUrl() {
  return desktop.mode === 'client'
    ? desktop.serverUrl + '/?app=1'
    : `http://localhost:${srv.cfg.port}/?app=1`;
}

function createWindow() {
  win = new BrowserWindow({
    width: 460, height: 820, minWidth: 360, minHeight: 480,
    title: desktop.mode === 'client' ? 'Project Chat — ' + desktop.serverUrl : 'Project Chat',
    icon: ICON, autoHideMenuBar: true, backgroundColor: '#0b2a5b',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(chatUrl());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (desktop.mode === 'client' && url.startsWith(desktop.serverUrl)) {
      win.hide();
      openSetup('Could not reach the server at ' + desktop.serverUrl + ' (' + desc + '). Check that Project Chat is running there and the port is allowed through its firewall.');
    }
  });
  win.on('close', e => {
    if (quitting) return;
    if (desktop.mode === 'client') { quitting = true; app.quit(); return; } // nothing to keep running
    // Server mode: hide to tray so other computers stay connected
    e.preventDefault(); win.hide();
    if (!app.__trayHintShown && tray && tray.displayBalloon) {
      tray.displayBalloon({ title: 'Project Chat is still running', content: 'Right-click the tray icon and choose Quit to stop it.' });
      app.__trayHintShown = true;
    }
  });
}

function show() { if (!win) createWindow(); win.show(); win.focus(); }

function openSetup(message) {
  if (setupWin) { setupWin.focus(); return; }
  setupWin = new BrowserWindow({
    width: 440, height: 520, resizable: false, title: 'Project Chat — Connection',
    icon: ICON, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  setupWin.setMenuBarVisibility(false);
  setupWin.loadFile(path.join(__dirname, 'public', 'connect.html'), { query: { msg: message || '' } });
  setupWin.on('closed', () => {
    setupWin = null;
    if (!win && !quitting && desktop.mode === 'client') { quitting = true; app.quit(); }
  });
}

ipcMain.handle('pc:get', () => ({ ...desktop }));
ipcMain.handle('pc:test', (_e, url) => testServer(normalizeUrl(url)));
ipcMain.handle('pc:save', async (_e, mode, url) => {
  if (mode === 'client') {
    const u = normalizeUrl(url);
    const t = await testServer(u);
    if (!t.ok) return t;
    saveDesktop({ mode: 'client', serverUrl: u });
  } else {
    saveDesktop({ mode: 'server', serverUrl: desktop.serverUrl || '' });
  }
  // Restart cleanly in the new mode
  quitting = true;
  app.relaunch(); app.exit(0);
  return { ok: true };
});

// ---------- tray ----------
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Project Chat');
  let items;
  if (desktop.mode === 'client') {
    items = [
      { label: 'Open Project Chat', click: show },
      { label: `Connected to ${desktop.serverUrl}`, enabled: false },
      { type: 'separator' },
      { label: 'Change connection…', click: () => openSetup() },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } }
    ];
  } else {
    const lan = srv.lanAddresses().map(ip => `http://${ip}:${srv.cfg.port}`);
    items = [
      { label: 'Open Project Chat', click: show },
      { type: 'separator' },
      ...lan.map(u => ({ label: `Copy network link  ${u}`, click: () => clipboard.writeText(u) })),
      { label: 'Copy report token', click: () => clipboard.writeText(srv.cfg.reportToken) },
      { label: 'Open settings folder', click: () => shell.openPath(srv.home) },
      { type: 'separator' },
      { label: 'Connect to another computer…', click: () => openSetup() },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } }
    ];
  }
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.on('click', show);
}

app.on('second-instance', show);

app.whenReady().then(async () => {
  if (desktop.mode === 'client') {
    createTray();
    const t = await testServer(desktop.serverUrl);
    if (t.ok) createWindow(); else openSetup(t.error + '. Check that Project Chat is running on that computer and its firewall allows the port.');
    return;
  }
  srv = require('./server.js');
  srv.onError = e => {
    if (e.code === 'EADDRINUSE') {
      dialog.showErrorBox('Project Chat', `Port ${srv.cfg.port} is already in use. Close any other copy of Project Chat (including start.bat), or change "port" in:\n${srv.configPath}`);
    } else dialog.showErrorBox('Project Chat', e.message);
    quitting = true; app.quit();
  };
  srv.onReady = () => { createTray(); createWindow(); };
  if (srv.server.listening) srv.onReady();
});

app.on('window-all-closed', () => { /* server mode keeps running in tray */ });
app.on('before-quit', () => { quitting = true; });
