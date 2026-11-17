import { describe, expect, it, vi } from "vitest";
import { cannotUpdate, CHECK_EVERY_MS, createUpdates, FIRST_CHECK_MS, updateErrorText, type UpdaterLike, type UpdateStatus } from "./updates";

function fakeUpdater() {
  const handlers: Record<string, (...a: unknown[]) => void> = {};
  const u: UpdaterLike & { emit: (e: string, ...a: unknown[]) => void } = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(async () => {
      u.emit("checking-for-update");
      return null;
    }),
    quitAndInstall: vi.fn(),
    on: (e, l) => (handlers[e] = l),
    emit: (e, ...a) => handlers[e]?.(...a),
  };
  return u;
}

function setup(o: { updater?: UpdaterLike | null; file?: string } = {}) {
  const files: Record<string, string> = o.file ? { "/ud/update.json": o.file } : {};
  const sent: UpdateStatus[] = [];
  const timers: { kind: string; ms: number; fn: () => void }[] = [];
  const updater = o.updater === undefined ? fakeUpdater() : o.updater;
  const up = createUpdates({
    updater,
    unsupported: "The portable Collide cannot update itself.",
    current: "0.1.0",
    fs: {
      readFileSync: (p) => {
        if (!(p in files)) throw new Error("ENOENT");
        return files[p];
      },
      writeFileSync: (p, d) => void (files[p] = d),
      mkdirSync: () => undefined,
    },
    path: { join: (...p) => p.join("/") },
    userData: () => "/ud",
    now: () => new Date("2026-11-17T12:00:00Z"),
    broadcast: (s) => void sent.push(s),
    setInterval: (fn, ms) => timers.push({ kind: "interval", ms, fn }),
    setTimeout: (fn, ms) => timers.push({ kind: "timeout", ms, fn }),
  });
  return { up, updater: updater as ReturnType<typeof fakeUpdater> | null, files, sent, timers };
}

describe("updates", () => {
  it("downloads in the background and installs on quit", () => {
    const { updater } = setup();
    expect(updater!.autoDownload).toBe(true);
    expect(updater!.autoInstallOnAppQuit).toBe(true);
  });

  it("check: no newer version", async () => {
    const { up, updater } = setup();
    updater!.checkForUpdates = vi.fn(async () => updater!.emit("update-not-available", { version: "0.1.0" }));
    const s = await up.check();
    expect(s).toMatchObject({ state: "none", version: null, current: "0.1.0", lastChecked: "2026-11-17T12:00:00.000Z" });
  });

  it("a newer version: downloading with progress, then ready; Restart to update installs it", async () => {
    const { up, updater, sent } = setup();
    await up.check();
    updater!.emit("update-available", { version: "0.2.0" });
    updater!.emit("download-progress", { percent: 41.6 });
    expect(up.status()).toMatchObject({ state: "downloading", version: "0.2.0", percent: 42 });
    updater!.emit("update-downloaded", { version: "0.2.0" });
    expect(up.status()).toMatchObject({ state: "ready", version: "0.2.0", percent: 100 });
    expect(sent[sent.length - 1]?.state).toBe("ready");
    up.install();
    expect(updater!.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it("Restart to update before anything is ready says why", () => {
    const { up } = setup();
    expect(() => up.install()).toThrow("No update is ready yet");
  });

  it("an error says what to do", async () => {
    const { up, updater } = setup();
    updater!.checkForUpdates = vi.fn(async () => {
      throw new Error("net::ERR_NAME_NOT_RESOLVED");
    });
    expect(await up.check()).toMatchObject({ state: "error", message: expect.stringContaining("internet connection") });
  });

  it("a second check while one runs does nothing", async () => {
    const { up, updater } = setup();
    updater!.checkForUpdates = vi.fn(() => new Promise(() => undefined));
    void up.check();
    await up.check();
    expect(updater!.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("check automatically: on by default, remembered in update.json; off skips the timed checks", async () => {
    const { up, updater, files, timers } = setup();
    expect(up.status().auto).toBe(true);
    up.start();
    expect(timers.map((t) => [t.kind, t.ms])).toEqual([
      ["timeout", FIRST_CHECK_MS],
      ["interval", CHECK_EVERY_MS],
    ]);
    up.setAuto(false);
    expect(JSON.parse(files["/ud/update.json"])).toEqual({ auto: false });
    timers.forEach((t) => t.fn());
    expect(updater!.checkForUpdates).not.toHaveBeenCalled();
    expect(setup({ file: '{"auto":false}' }).up.status().auto).toBe(false);
    expect(setup({ file: "not json" }).up.status().auto).toBe(true);
    expect(() => up.setAuto("yes")).toThrow();
  });

  it("a copy that cannot update says so and never checks", async () => {
    const { up, timers } = setup({ updater: null });
    expect(up.status()).toMatchObject({ state: "unsupported", message: "The portable Collide cannot update itself." });
    expect((await up.check()).state).toBe("unsupported");
    up.start();
    expect(timers).toEqual([]);
  });
});

describe("cannotUpdate", () => {
  it("only the installed Windows app updates", () => {
    expect(cannotUpdate({ packaged: true, platform: "win32", portable: false })).toBeNull();
    expect(cannotUpdate({ packaged: false, platform: "win32", portable: false })).toMatch(/development build/);
    expect(cannotUpdate({ packaged: true, platform: "win32", portable: true })).toMatch(/portable/);
    expect(cannotUpdate({ packaged: true, platform: "linux", portable: false })).toMatch(/Windows/);
  });
});

describe("updateErrorText", () => {
  it("names the cause and the fix", () => {
    expect(updateErrorText(new Error("getaddrinfo ENOTFOUND pub-x.r2.dev"))).toMatch(/internet connection/);
    expect(updateErrorText(new Error("HttpError: 404 Not Found latest.yml"))).toMatch(/No update information/);
    expect(updateErrorText(new Error("sha512 checksum mismatch"))).toMatch(/damaged/);
  });
});
