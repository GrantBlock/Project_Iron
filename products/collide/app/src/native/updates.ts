// Updates (Grant 2026-11-17): the installed app checks Collide's release folder on Cloudflare R2 (a static
// `latest.yml` plus the app package; electron-updater's generic provider), downloads a newer version in the
// background and installs it on restart. Settings → Updates shows the state and has Check now, Restart to update and
// "check automatically" (update.json in user data, on by default). The portable exe and a dev build cannot update
// themselves; they say so. electron-updater is passed in (updater.cjs), so this file is unit-tested with a fake.

export type UpdateState = "idle" | "checking" | "none" | "available" | "downloading" | "ready" | "error" | "unsupported";

export interface UpdateStatus {
  state: UpdateState;
  /** The running version. */
  current: string;
  /** The newer version found, when there is one. */
  version: string | null;
  /** Download progress, 0-100, while downloading. */
  percent: number | null;
  /** Cause and fix, for `error` and `unsupported`. */
  message: string | null;
  /** Check on start and every few hours. */
  auto: boolean;
  /** ISO time of the last finished check. */
  lastChecked: string | null;
}

/** The part of electron-updater's `autoUpdater` this uses. */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

export interface UpdatesDeps {
  /** Null when this build cannot update itself (with `unsupported` saying why). */
  updater: UpdaterLike | null;
  unsupported?: string;
  current: string;
  fs: { readFileSync(p: string, enc: "utf8"): string; writeFileSync(p: string, data: string): void; mkdirSync(p: string, o: { recursive: true }): unknown };
  path: { join(...p: string[]): string };
  userData: () => string;
  now: () => Date;
  /** Send the new status to every Collide window. */
  broadcast: (status: UpdateStatus) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  setTimeout: (fn: () => void, ms: number) => unknown;
}

/** How often an automatic check runs while Collide is open. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
/** The first automatic check, after the window is up. */
export const FIRST_CHECK_MS = 15 * 1000;

const versionOf = (info: unknown) => (info && typeof (info as { version?: unknown }).version === "string" ? (info as { version: string }).version : null);

/** Turn electron-updater's messages into something a person can act on. */
export function updateErrorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|net::/i.test(raw))
    return "Could not reach Collide's update server. Check your internet connection or ask IT whether the download site is blocked, then try again.";
  if (/404|Cannot find channel|latest\.yml/i.test(raw)) return "No update information was found on the update server. Try again later.";
  if (/sha512|checksum/i.test(raw)) return "The downloaded update was damaged. Check for updates again to download it fresh.";
  return `The update did not work: ${raw.split("\n")[0]}. Try again, or download the installer again.`;
}

export function createUpdates(deps: UpdatesDeps) {
  const file = () => deps.path.join(deps.userData(), "update.json");
  const readAuto = (): boolean => {
    try {
      const v = JSON.parse(deps.fs.readFileSync(file(), "utf8")) as { auto?: unknown };
      return typeof v.auto === "boolean" ? v.auto : true;
    } catch {
      return true;
    }
  };
  let status: UpdateStatus = {
    state: deps.updater ? "idle" : "unsupported",
    current: deps.current,
    version: null,
    percent: null,
    message: deps.updater ? null : deps.unsupported ?? "This copy of Collide cannot update itself.",
    auto: readAuto(),
    lastChecked: null,
  };
  const set = (patch: Partial<UpdateStatus>) => {
    status = { ...status, ...patch };
    deps.broadcast(status);
  };
  const checked = () => deps.now().toISOString();

  const u = deps.updater;
  if (u) {
    u.autoDownload = true; // a newer version downloads in the background
    u.autoInstallOnAppQuit = true; // and installs when Collide closes, if nobody clicked Restart to update
    u.on("checking-for-update", () => set({ state: "checking", message: null }));
    u.on("update-not-available", () => set({ state: "none", version: null, percent: null, lastChecked: checked() }));
    u.on("update-available", (info) => set({ state: "downloading", version: versionOf(info), percent: 0, lastChecked: checked() }));
    u.on("download-progress", (p) => {
      const percent = Math.max(0, Math.min(100, Math.round(Number((p as { percent?: unknown })?.percent) || 0)));
      set({ state: "downloading", percent });
    });
    u.on("update-downloaded", (info) => set({ state: "ready", version: versionOf(info) ?? status.version, percent: 100 }));
    u.on("error", (e) => set({ state: "error", message: updateErrorText(e), percent: null, lastChecked: checked() }));
  }

  async function check(): Promise<UpdateStatus> {
    if (!u) return status;
    if (status.state === "checking" || status.state === "downloading" || status.state === "ready") return status;
    set({ state: "checking", message: null });
    try {
      await u.checkForUpdates();
    } catch (e) {
      set({ state: "error", message: updateErrorText(e), lastChecked: checked() });
    }
    return status;
  }

  return {
    status: () => status,
    check,
    /** Restart into the downloaded version. */
    install(): void {
      if (!u || status.state !== "ready") throw new Error("No update is ready yet. Check for updates first.");
      u.quitAndInstall(false, true);
    },
    setAuto(on: unknown): UpdateStatus {
      if (typeof on !== "boolean") throw new Error("Check automatically must be on or off.");
      deps.fs.mkdirSync(deps.userData(), { recursive: true });
      deps.fs.writeFileSync(file(), JSON.stringify({ auto: on }, null, 2));
      set({ auto: on });
      return status;
    },
    /** Start the automatic checks (once, at startup). */
    start(): void {
      if (!u) return;
      deps.setTimeout(() => void (status.auto && check()), FIRST_CHECK_MS);
      deps.setInterval(() => void (status.auto && check()), CHECK_EVERY_MS);
    },
  };
}
export type Updates = ReturnType<typeof createUpdates>;

/**
 * Why this copy cannot update itself, or null when it can: only the installed Windows app (the web installer's
 * install) updates. The portable exe runs from a temporary folder; a dev build has no release to compare with.
 */
export function cannotUpdate(o: { packaged: boolean; platform: string; portable: boolean }): string | null {
  if (!o.packaged) return "Updates work in the installed Collide app, not in a development build.";
  if (o.portable) return "The portable Collide cannot update itself. Download the newest portable exe, or install Collide to get updates automatically.";
  if (o.platform !== "win32") return "Updates are available for the Windows app only.";
  return null;
}
