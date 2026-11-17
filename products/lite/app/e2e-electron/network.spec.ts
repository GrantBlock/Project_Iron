import { expect, test } from "@playwright/test";
import { launch } from "./launch";

const isLocal = (url: string) => /^(lite:\/\/app\/|data:|blob:)/.test(url);

test("offline: starting Lite makes no request that leaves the machine", async () => {
  const { page, output, close } = await launch();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  try {
    // A reload with the recorder in place, so the whole start is seen: page, script, styles, fonts.
    await page.reload();
    await expect(page.getByTestId("app-root")).toBeVisible();
    await page.evaluate(() => Promise.all([document.fonts.load('16px "Overpass"'), document.fonts.load('16px "Overpass Mono"')]));
    await page.waitForLoadState("networkidle");

    expect(requests).toContain("lite://app/");
    expect(requests.filter((url) => /\/assets\/Overpass(Mono)?-[\w-]+\.woff2$/.test(url))).toHaveLength(2);
    expect(requests.filter((url) => !isLocal(url))).toEqual([]);
    // Nothing was blocked either: the app never even tried (no update check, no telemetry, no remote fonts).
    expect(output()).not.toContain("[lite] blocked");
  } finally {
    await close();
  }
});

test("the page cannot reach another host: its content security policy stops fetch, scripts, images and fonts", async () => {
  const { page, close } = await launch();
  // Playwright reports a request the policy stopped in the page as started, then failed: none may finish.
  const finished: string[] = [];
  const failed: string[] = [];
  page.on("requestfinished", (request) => finished.push(request.url()));
  page.on("requestfailed", (request) => failed.push(`${request.url()} ${request.failure()?.errorText}`));
  try {
    await expect(page.getByTestId("app-root")).toBeVisible();
    const result = await page.evaluate(async () => {
      const blocked: string[] = [];
      document.addEventListener("securitypolicyviolation", (e) => blocked.push(`${e.effectiveDirective} ${e.blockedURI}`));
      const fetched = await fetch("https://example.com/data.json").then(
        () => "reached",
        () => "blocked",
      );
      // Handlers first, then src: an image starts loading (and can fail) as soon as src is set.
      const loads = (tag: "script" | "img", src: string) =>
        new Promise<string>((resolve) => {
          const el = document.createElement(tag);
          el.onload = () => resolve("loaded");
          el.onerror = () => resolve("blocked");
          el.src = src;
          document.body.append(el);
        });
      const script = await loads("script", "https://example.com/tracker.js");
      const img = await loads("img", "https://example.com/pixel.png");
      const font = await new FontFace("Remote", "url(https://example.com/font.woff2)").load().then(
        () => "loaded",
        () => "blocked",
      );
      const results = { fetched, script, img, font };
      await new Promise((r) => setTimeout(r, 100));
      // Each is reported once per policy: the <meta> tag and the header lite://app/ sends.
      return { ...results, blocked: [...new Set(blocked)].sort() };
    });
    expect(result).toEqual({
      fetched: "blocked",
      script: "blocked",
      img: "blocked",
      font: "blocked",
      blocked: [
        "connect-src https://example.com/data.json",
        "font-src https://example.com/font.woff2",
        "img-src https://example.com/pixel.png",
        "script-src-elem https://example.com/tracker.js",
      ],
    });
    expect(finished.filter((url) => !isLocal(url))).toEqual([]);
    expect(failed.sort()).toEqual([
      "https://example.com/font.woff2 csp",
      "https://example.com/pixel.png csp",
      "https://example.com/tracker.js csp",
    ]);
  } finally {
    await close();
  }
});

test("the main process cancels and logs any request that would leave the machine", async () => {
  const { app, page, output, close } = await launch();
  try {
    await expect(page.getByTestId("app-root")).toBeVisible();
    // Past the page's policy: a request made by the main process itself, and a window
    // pointed at another host. Both go through the session's request guard.
    const result = await app.evaluate(async ({ BrowserWindow, net }) => {
      const fetched = await net.fetch("https://example.com/update.json").then(
        (r) => `reached ${r.status}`,
        (e: Error) => e.message,
      );
      const win = new BrowserWindow({ show: false });
      const loaded = await win.loadURL("http://example.com/telemetry").then(
        () => "reached",
        (e: Error) => e.message,
      );
      win.destroy();
      return { fetched, loaded };
    });
    expect(result.fetched).toContain("ERR_BLOCKED_BY_CLIENT");
    expect(result.loaded).toContain("ERR_BLOCKED_BY_CLIENT");
    await expect.poll(output).toContain("[lite] blocked non-local request: GET https://example.com/update.json");
    expect(output()).toContain("[lite] blocked non-local request: GET http://example.com/telemetry (mainFrame)");
  } finally {
    await close();
  }
});
