// Desktop wrapper: runs the chat server and shows it in its own window.
'use strict';
const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage, clipboard } = require('electron');
const path = require('path');

// Config + data live in %APPDATA%\Project Chat (writable, survives updates)
process.env.PROJECT_CHAT_HOME = path.join(app.getPath('appData'), 'Project Chat');

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win, tray, srv, quitting = false;
const ICON = path.join(__dirname, 'build', 'icon.png');

function createWindow() {
  win = new BrowserWindow({
    width: 460, height: 820, minWidth: 360, minHeight: 480,
    title: 'Project Chat', icon: ICON, autoHideMenuBar: true,
    backgroundColor: '#0b2a5b',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`http://localhost:${srv.cfg.port}/?app=1`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // Close = hide to tray, so other computers can still reach the chat
  win.on('close', e => {
    if (!quitting) {
      e.preventDefault(); win.hide();
      if (!app.__trayHintShown && tray && tray.displayBalloon) {
        tray.displayBalloon({ title: 'Project Chat is still running', content: 'Right-click the tray icon and choose Quit to stop it.' });
        app.__trayHintShown = true;
      }
    }
  });
}

function show() { if (!win) createWindow(); win.show(); win.focus(); }

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Project Chat');
  const lan = srv.lanAddresses().map(ip => `http://${ip}:${srv.cfg.port}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Project Chat', click: show },
    { type: 'separator' },
    ...lan.map(u => ({ label: `Copy network link  ${u}`, click: () => clipboard.writeText(u) })),
    { label: 'Copy report token', click: () => clipboard.writeText(srv.cfg.reportToken) },
    { label: 'Open settings folder', click: () => shell.openPath(srv.home) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', show);
}

app.on('second-instance', show);

app.whenReady().then(() => {
  srv = require('./server.js');
  srv.onError = e => {
    dialog.showErrorBox('Project Chat',
      e.code === 'EADDRINUSE'
        ? `Port ${srv.cfg.port} is already in use. Close any other copy of Project Chat (including start.bat), or change "port" in:\n${srv.configPath}`
        : e.message);
    quitting = true; app.quit();
  };
  srv.onReady = () => { createTray(); createWindow(); };
  if (srv.server.listening) srv.onReady();
});

app.on('window-all-closed', e => { /* keep running in tray */ });
app.on('before-quit', () => { quitting = true; });
