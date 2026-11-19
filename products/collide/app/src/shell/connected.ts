// T44 (5.1, Grant 2026-11-19): the Connected pill's light. Connected mode and the server are not built (ISSUES 41),
// so (A, ISSUES 44) "server reached" is a reachability check of the address saved in Settings: any answer from it
// is the green light; no address, no answer or no answer in time is the off light. Collide opens no port here.

/** The address saved in Settings as an http(s) URL, or null when there is none or it is not an http address. */
export function serverUrl(address: string): string | null {
  const a = address.trim();
  if (!a) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(a) && !/^[^:/]+:\d+(\/|$)/.test(a) ? a : `http://${a}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** How long the server has to answer (A). */
export const CHECK_TIMEOUT_MS = 3000;
/** How often the light is checked again while Connected mode is on (A). */
export const CHECK_EVERY_MS = 30_000;

type FetchLike = (url: string, init?: RequestInit) => Promise<unknown>;

/** True when the address answers at all (any status; an opaque reply counts). */
export async function checkServer(address: string, o: { fetch?: FetchLike; timeoutMs?: number } = {}): Promise<boolean> {
  const url = serverUrl(address);
  const f = o.fetch ?? (typeof fetch === "function" ? (fetch as FetchLike) : null);
  if (!url || !f) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? CHECK_TIMEOUT_MS);
  try {
    await f(url, { mode: "no-cors", cache: "no-store", credentials: "omit", signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
