// Lite makes no network requests (RUN.md rules). The main process runs every request
// of every page through `createRequestGuard`: local ones pass, anything else is
// cancelled and logged.

import { SCHEME } from "./shell";

/** Schemes that never leave the machine. */
const LOCAL_SCHEMES = new Set([`${SCHEME}:`, "data:", "blob:", "devtools:"]);

/**
 * True when `url` stays on this machine: the app's own files (lite://), data: and blob:,
 * a file on a local disk (file:///…; not file://server/share, which is a network share
 * on Windows) and, in dev only, the Vite dev server (`devUrl`, http and its ws for reload).
 */
export function isLocalRequest(url: string, devUrl?: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (LOCAL_SCHEMES.has(u.protocol)) return true;
  if (u.protocol === "file:") return u.host === "" || u.host === "localhost";
  if (devUrl && (u.protocol === "http:" || u.protocol === "ws:")) {
    try {
      const dev = new URL(devUrl);
      return u.host === dev.host && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  return false;
}

/** What Electron's `webRequest.onBeforeRequest` passes (the part the guard reads). */
export interface RequestDetails {
  url: string;
  method?: string;
  resourceType?: string;
}

export interface RequestGuardOptions {
  /** The Vite dev server, in dev only (`devServerUrl` has checked it). */
  devUrl?: string;
  /** Where a blocked request is written (the main process passes console.warn). */
  log: (line: string) => void;
}

/** The line logged for a blocked request. */
export function blockedLine(details: RequestDetails): string {
  return `[lite] blocked non-local request: ${details.method ?? "GET"} ${details.url}${details.resourceType ? ` (${details.resourceType})` : ""}`;
}

/** The `onBeforeRequest` decision: `{ cancel: true }` and a log line for anything not local. */
export function createRequestGuard(options: RequestGuardOptions) {
  return (details: RequestDetails): { cancel: boolean } => {
    if (isLocalRequest(details.url, options.devUrl)) return { cancel: false };
    options.log(blockedLine(details));
    return { cancel: true };
  };
}
