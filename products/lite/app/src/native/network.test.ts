import { describe, expect, it } from "vitest";
import { blockedLine, createRequestGuard, isLocalRequest } from "./network";

describe("isLocalRequest", () => {
  it("lets the app's own files, data:, blob: and local files through", () => {
    for (const url of [
      "lite://app/",
      "lite://app/assets/Overpass-abc.woff2",
      "data:font/woff2;base64,AAAA",
      "blob:lite://app/6f1c0b8e-0000-4000-8000-000000000000",
      "file:///C:/Users/me/package/a.pdf",
      "file://localhost/home/me/a.md",
      "devtools://devtools/bundled/devtools_app.html",
    ]) {
      expect(isLocalRequest(url), url).toBe(true);
    }
  });

  it("blocks every other host and scheme, including Windows network shares", () => {
    for (const url of [
      "https://example.com/",
      "http://example.com/font.woff2",
      "https://fonts.googleapis.com/css2?family=Overpass",
      "wss://example.com/socket",
      "ftp://example.com/a",
      "file://fileserver/share/a.pdf",
      "file:////server/share/a",
      "file:///\\\\server\\share",
      "file://localhost//server/share",
      "file:///%5C%5Cserver/share/a",
      "file:///%2F%2Fserver/share/a",
      "http://localhost:1430/",
      "chrome-extension://abc/x.js",
      "not a url",
    ]) {
      expect(isLocalRequest(url), url).toBe(false);
    }
  });

  it("in dev, lets through the dev server (http and its reload socket) and nothing else on this machine", () => {
    const dev = "http://localhost:1430/";
    expect(isLocalRequest("http://localhost:1430/src/renderer/main.ts", dev)).toBe(true);
    expect(isLocalRequest("ws://localhost:1430/?token=x", dev)).toBe(true);
    expect(isLocalRequest("http://localhost:1431/", dev)).toBe(false);
    expect(isLocalRequest("https://localhost:1430/", dev)).toBe(false);
    expect(isLocalRequest("http://127.0.0.1:1430/", dev)).toBe(false);
    expect(isLocalRequest("https://example.com/", dev)).toBe(false);
  });
});

describe("createRequestGuard", () => {
  it("cancels and logs non-local requests, passes local ones silently", () => {
    const lines: string[] = [];
    const guard = createRequestGuard({ log: (line) => lines.push(line) });
    expect(guard({ url: "lite://app/", method: "GET", resourceType: "mainFrame" })).toEqual({ cancel: false });
    expect(guard({ url: "https://example.com/a.js", method: "GET", resourceType: "script" })).toEqual({ cancel: true });
    expect(guard({ url: "https://example.com/beacon", method: "POST" })).toEqual({ cancel: true });
    expect(lines).toEqual([
      "[lite] blocked non-local request: GET https://example.com/a.js (script)",
      "[lite] blocked non-local request: POST https://example.com/beacon",
    ]);
    expect(blockedLine({ url: "https://x.test/" })).toBe("[lite] blocked non-local request: GET https://x.test/");
  });
});
