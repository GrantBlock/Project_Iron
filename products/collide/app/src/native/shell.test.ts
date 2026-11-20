// T14: the shell's security decisions (hardening from the T13 review).
import path from "node:path";
import { describe, expect, it } from "vitest";
import { devServerUrl, distFile, sameOrigin } from "./shell";

describe("devServerUrl (COLLIDE_DEV_URL)", () => {
  it("accepts plain http on this machine, any port", () => {
    expect(devServerUrl("http://localhost:1420/")).toBe("http://localhost:1420/");
    expect(devServerUrl("http://localhost:1420")).toBe("http://localhost:1420/");
    expect(devServerUrl("http://127.0.0.1:5173/")).toBe("http://127.0.0.1:5173/");
    expect(devServerUrl("http://localhost/")).toBe("http://localhost/");
  });

  it("ignores everything else", () => {
    for (const value of [
      undefined,
      "",
      "not a url",
      "https://localhost:1420/",
      "http://example.com/",
      "http://localhost.example.com/",
      "http://example.com@localhost:1420/",
      "http://user:pw@localhost:1420/",
      "http://[::1]:1420/",
      "http://0.0.0.0:1420/",
      "file:///etc/hosts",
      "collide://app/",
      "javascript:alert(1)",
    ]) {
      expect(devServerUrl(value), String(value)).toBeUndefined();
    }
  });
});

describe("sameOrigin (navigation, redirect and IPC sender guard)", () => {
  it("is true only for the same scheme, host and port", () => {
    expect(sameOrigin("collide://app/overlay.html", "collide://app/")).toBe(true);
    expect(sameOrigin("http://localhost:1420/overlay.html?x=1", "http://localhost:1420/")).toBe(true);
    expect(sameOrigin("collide://other/", "collide://app/")).toBe(false);
    expect(sameOrigin("http://localhost:1421/", "http://localhost:1420/")).toBe(false);
    expect(sameOrigin("https://localhost:1420/", "http://localhost:1420/")).toBe(false);
    expect(sameOrigin("http://app/", "collide://app/")).toBe(false);
    expect(sameOrigin("https://example.com/", "collide://app/")).toBe(false);
  });

  it("never treats opaque origins as the app (file:, data:, about:, blob:)", () => {
    for (const url of ["file:///C:/Windows/win.ini", "file:///etc/hosts", "data:text/html,<p>x</p>", "about:blank", "blob:null/abc", "javascript:void 0", "", "nonsense"]) {
      expect(sameOrigin(url, "collide://app/"), url).toBe(false);
      expect(sameOrigin(url, url), url).toBe(false);
    }
  });
});

describe("distFile (collide://app/ -> dist/)", () => {
  const cases = [
    { name: "posix", p: path.posix, dist: "/opt/collide/dist", inside: (...parts: string[]) => ["/opt/collide/dist", ...parts].join("/") },
    { name: "win32", p: path.win32, dist: "C:\\Collide\\dist", inside: (...parts: string[]) => ["C:\\Collide\\dist", ...parts].join("\\") },
  ];

  it.each(cases)("$name: serves files inside dist", ({ p, dist, inside }) => {
    expect(distFile(p, dist, "collide://app/")).toBe(inside("index.html"));
    expect(distFile(p, dist, "collide://app")).toBe(inside("index.html"));
    expect(distFile(p, dist, "collide://app/overlay.html")).toBe(inside("overlay.html"));
    expect(distFile(p, dist, "collide://app/assets/main-abc.js?v=1#x")).toBe(inside("assets", "main-abc.js"));
    expect(distFile(p, dist, "collide://app/assets/a%20b.png")).toBe(inside("assets", "a b.png"));
    // A name that only starts with two dots is an ordinary file, not a way out.
    expect(distFile(p, dist, "collide://app/..well-known/x")).toBe(inside("..well-known", "x"));
    expect(distFile(p, dist, "collide://app/assets/..hidden.js")).toBe(inside("assets", "..hidden.js"));
  });

  it.each(cases)("$name: refuses anything that would leave dist", ({ p, dist }) => {
    for (const url of [
      "collide://app/..%2f..%2fpackage.json",
      "collide://app/..%2Fpackage.json",
      "collide://app/assets/..%2f..%2f..%2fsecret",
      "collide://app/..%2fdist-electron%2fnative.cjs",
      "collide://app/..%2fdist2%2findex.html", // a sibling whose name starts with "dist"
      "collide://app/assets%2f..", // dist itself
      "collide://other/index.html",
      "https://app/index.html",
      "collide://app/%E0%A4%A", // malformed escape
      "not a url",
    ]) {
      expect(distFile(p, dist, url), url).toBeNull();
    }
  });

  it.each(cases)("$name: dot segments the URL parser already resolved stay inside dist", ({ p, dist, inside }) => {
    expect(distFile(p, dist, "collide://app/../../package.json")).toBe(inside("package.json"));
    expect(distFile(p, dist, "collide://app/%2e%2e/package.json")).toBe(inside("package.json"));
    expect(distFile(p, dist, "collide://app/assets/%2e%2e/%2e%2e/x")).toBe(inside("x"));
    expect(distFile(p, dist, "collide://app/%2e%2e")).toBe(inside("index.html"));
  });

  it("win32: refuses backslash traversal and another drive", () => {
    const dist = "C:\\Collide\\dist";
    expect(distFile(path.win32, dist, "collide://app/..%5c..%5csecret")).toBeNull();
    expect(distFile(path.win32, dist, "collide://app/assets%5c..%5c..%5c..%5csecret")).toBeNull();
  });

  it("posix: a backslash is an ordinary file-name character, so it cannot leave dist", () => {
    expect(distFile(path.posix, "/opt/collide/dist", "collide://app/..%5c..%5csecret")).toBe("/opt/collide/dist/..\\..\\secret");
  });
});
