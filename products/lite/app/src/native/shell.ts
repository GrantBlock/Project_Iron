// The shell's small decisions as pure functions, unit-tested; electron/main.cjs uses them.

/** The app's name: the window title and (as `productName` in package.json) the user-data folder. */
export const APP_NAME = "Lite";

/** The app's own secure scheme: the Vite build is served from lite://app/ (absolute asset paths). */
export const SCHEME = "lite";
export const APP_URL = `${SCHEME}://app/`;

/** The canvas token (`--bc-canvas` in the prototype), so the window is dark before the page paints. */
export const CANVAS_COLOR = "#1e1e20";

/** RUN.md open question 1 (A): 1280 × 800 by default, resizable. */
export const WINDOW_SIZE = { width: 1280, height: 800 } as const;

/** Smallest window (A): the phone-width layout (Files / View / Assistant tabs) still fits. */
export const MIN_WINDOW_SIZE = { width: 400, height: 500 } as const;

/**
 * The options of the main window. Frameless (Grant 2026-11-17, ISSUES.md 7): the page draws the
 * title bar and the prototype's window buttons. `thickFrame` keeps the Windows resize edges, the
 * shadow and Snap. The page is locked down: context isolation and sandbox on, no Node.
 */
export function windowOptions(preload: string) {
  return {
    title: APP_NAME,
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    resizable: true,
    frame: false,
    thickFrame: true,
    show: false,
    backgroundColor: CANVAS_COLOR,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Chromium's spellchecker downloads dictionaries from the internet on Linux: off.
      spellcheck: false,
    },
  };
}

/** The part of `node:path` that `distFile` uses (`path`, `path.win32` or `path.posix`). */
export interface PathLike {
  sep: string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  isAbsolute(p: string): boolean;
}

const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * The dev server address from `LITE_DEV_URL`, or undefined if it is anything
 * but plain http on this machine (`http://localhost[:port]` or `http://127.0.0.1[:port]`).
 */
export function devServerUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" || !DEV_HOSTS.has(url.hostname) || url.username || url.password) return undefined;
  return url.toString();
}

/**
 * True when both URLs have the same scheme, host and port. Compared part by part:
 * `URL.origin` is the string "null" for lite://, file:// and data: alike.
 */
export function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.protocol === ub.protocol && ua.host !== "" && ua.host === ub.host;
  } catch {
    return false;
  }
}

/** Maps a lite://app/... request to a file inside `dist`, or null if it would leave it. */
export function distFile(path: PathLike, dist: string, requestUrl: string): string | null {
  let file: string;
  try {
    const { protocol, host, pathname } = new URL(requestUrl);
    if (protocol !== `${SCHEME}:` || host !== "app") return null;
    // Node's URL leaves an empty path on a non-special scheme (lite://app); Chromium sends "/".
    file = path.join(dist, decodeURIComponent(pathname === "/" || pathname === "" ? "/index.html" : pathname));
  } catch {
    return null;
  }
  const rel = path.relative(dist, file);
  if (rel === "" || rel.split(path.sep)[0] === ".." || path.isAbsolute(rel)) return null;
  return file;
}

/** The drawn window buttons' actions, sent by the page on the `lite:window` channel. */
export const WINDOW_ACTIONS = ["minimize", "toggle-maximize", "close"] as const;
export type WindowAction = (typeof WINDOW_ACTIONS)[number];

/** The part of a BrowserWindow the window buttons use. */
export interface WindowLike {
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  isMaximized(): boolean;
  close(): void;
}

/** Applies a window button's action; anything else is ignored. Returns whether it was one. */
export function applyWindowAction(win: WindowLike, action: unknown): boolean {
  switch (action) {
    case "minimize":
      win.minimize();
      return true;
    case "toggle-maximize":
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      return true;
    case "close":
      win.close();
      return true;
    default:
      return false;
  }
}
