// T14: the shell's small security decisions as pure functions, so they are unit-tested.
// Used by electron/main.cjs.

/** The app's name: the window title and (as `productName` in package.json) the user-data folder. */
export const APP_NAME = "Collide";

/** The part of `node:path` that `distFile` uses (`path`, `path.win32` or `path.posix`). */
export interface PathLike {
  sep: string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  isAbsolute(p: string): boolean;
}

const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * The dev server address from `COLLIDE_DEV_URL`, or undefined if it is anything
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
 * `URL.origin` is the string "null" for collide://, file:// and data: alike, so
 * comparing origins would treat them all as one.
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

/** Maps a collide://app/... request to a file inside `dist`, or null if it would leave it. */
export function distFile(path: PathLike, dist: string, requestUrl: string): string | null {
  let file: string;
  try {
    const { protocol, host, pathname } = new URL(requestUrl);
    if (protocol !== "collide:" || host !== "app") return null;
    // Node's URL leaves an empty path on a non-special scheme (collide://app); Chromium sends "/".
    file = path.join(dist, decodeURIComponent(pathname === "/" || pathname === "" ? "/index.html" : pathname));
  } catch {
    return null;
  }
  const rel = path.relative(dist, file);
  if (rel === "" || rel.split(path.sep)[0] === ".." || path.isAbsolute(rel)) return null;
  return file;
}
