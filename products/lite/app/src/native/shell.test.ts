import { posix, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAME, APP_URL, applyWindowAction, devServerUrl, distFile, sameOrigin, windowOptions, type WindowLike } from "./shell";

describe("window", () => {
  it("is titled Lite, 1280 × 800, resizable, frameless with Windows resize edges, with the page locked down", () => {
    const options = windowOptions("/app/electron/preload.cjs");
    expect(APP_NAME).toBe("Lite");
    expect(options).toMatchObject({ title: "Lite", width: 1280, height: 800, minWidth: 400, minHeight: 500, resizable: true, frame: false, thickFrame: true, backgroundColor: "#1e1e20" });
    expect(options.webPreferences).toEqual({
      preload: "/app/electron/preload.cjs",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    });
  });
});

describe("applyWindowAction", () => {
  function fakeWindow() {
    const calls: string[] = [];
    let maximized = false;
    const win: WindowLike = {
      minimize: () => calls.push("minimize"),
      maximize: () => (calls.push("maximize"), (maximized = true)),
      unmaximize: () => (calls.push("unmaximize"), (maximized = false)),
      isMaximized: () => maximized,
      close: () => calls.push("close"),
    };
    return { win, calls };
  }

  it("minimizes, toggles maximized and closes", () => {
    const { win, calls } = fakeWindow();
    expect(applyWindowAction(win, "minimize")).toBe(true);
    expect(applyWindowAction(win, "toggle-maximize")).toBe(true);
    expect(applyWindowAction(win, "toggle-maximize")).toBe(true);
    expect(applyWindowAction(win, "close")).toBe(true);
    expect(calls).toEqual(["minimize", "maximize", "unmaximize", "close"]);
  });

  it("ignores anything else", () => {
    const { win, calls } = fakeWindow();
    for (const bad of ["maximize", "destroy", "", undefined, null, 1, { toString: () => "close" }]) expect(applyWindowAction(win, bad)).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("devServerUrl", () => {
  it("accepts plain http on this machine only", () => {
    expect(devServerUrl("http://localhost:1430/")).toBe("http://localhost:1430/");
    expect(devServerUrl("http://127.0.0.1:1430")).toBe("http://127.0.0.1:1430/");
    for (const bad of [undefined, "", "not a url", "https://localhost:1430/", "http://example.com/", "http://user:pw@localhost:1430/", "file:///etc/hosts"]) {
      expect(devServerUrl(bad), String(bad)).toBeUndefined();
    }
  });
});

describe("sameOrigin", () => {
  it("compares scheme, host and port, never two hostless URLs", () => {
    expect(sameOrigin("lite://app/", "lite://app/assets/a.js")).toBe(true);
    expect(sameOrigin("http://localhost:1430/", "http://localhost:1430/x")).toBe(true);
    expect(sameOrigin("http://localhost:1430/", "http://localhost:1431/")).toBe(false);
    expect(sameOrigin("lite://app/", "https://app/")).toBe(false);
    expect(sameOrigin("file:///a", "file:///b")).toBe(false);
    expect(sameOrigin("data:text/html,a", "data:text/html,a")).toBe(false);
    expect(sameOrigin("nope", APP_URL)).toBe(false);
  });
});

describe("distFile", () => {
  it("maps lite://app/ paths into dist and refuses anything that leaves it", () => {
    expect(distFile(posix, "/app/dist", "lite://app/")).toBe("/app/dist/index.html");
    expect(distFile(posix, "/app/dist", "lite://app")).toBe("/app/dist/index.html");
    expect(distFile(posix, "/app/dist", "lite://app/assets/index-1.js")).toBe("/app/dist/assets/index-1.js");
    expect(distFile(posix, "/app/dist", "lite://app/assets/a%20b.woff2")).toBe("/app/dist/assets/a b.woff2");
    // The URL parser resolves an encoded ".." itself: the path stays inside dist.
    expect(distFile(posix, "/app/dist", "lite://app/%2e%2e/package.json")).toBe("/app/dist/package.json");
    expect(distFile(posix, "/app/dist", "lite://app/..%2f..%2fetc/passwd")).toBeNull();
    expect(distFile(posix, "/app/dist", "lite://other/index.html")).toBeNull();
    expect(distFile(posix, "/app/dist", "https://app/index.html")).toBeNull();
    expect(distFile(win32, "C:\\Lite\\dist", "lite://app/assets/a.js")).toBe("C:\\Lite\\dist\\assets\\a.js");
    expect(distFile(win32, "C:\\Lite\\dist", "lite://app/..%5c..%5cWindows%5cwin.ini")).toBeNull();
  });
});
