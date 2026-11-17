import { expect, test } from "@playwright/test";

// UI specs against the Vite build (vite preview). L01: the empty Lite window.

const LOCAL = "http://localhost:4330";

test("the build shows the Lite window on the dark backdrop, in Overpass", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Lite");
  await expect(page.getByTestId("app-root")).toBeVisible();
  const look = await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('16px "Overpass"');
    await document.fonts.load('16px "Overpass Mono"');
    const body = getComputedStyle(document.body);
    return {
      background: body.backgroundColor,
      color: body.color,
      font: body.fontFamily,
      canvasToken: getComputedStyle(document.documentElement).getPropertyValue("--bc-canvas").trim(),
      overpass: document.fonts.check('16px "Overpass"'),
      overpassMono: document.fonts.check('16px "Overpass Mono"'),
      loadedFaces: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")).sort(),
    };
  });
  expect(look).toEqual({
    // L03: the page behind the window frame is the prototype's backdrop (body{background:var(--bc-backdrop)}).
    background: "rgb(20, 20, 22)",
    color: "rgb(236, 236, 237)",
    font: 'Overpass, "Helvetica Neue", Helvetica, Arial, sans-serif',
    canvasToken: "#1e1e20",
    overpass: true,
    overpassMono: true,
    loadedFaces: ["Overpass", "Overpass Mono"],
  });
});

test("offline: every request stays on the local server and the page cannot reach other hosts", async ({ page }) => {
  const requests: string[] = [];
  // Record every request; anything not local is aborted (and fails the test below).
  await page.route("**/*", (route) => {
    const url = route.request().url();
    requests.push(url);
    return url.startsWith(`${LOCAL}/`) || url.startsWith("data:") || url.startsWith("blob:") ? route.continue() : route.abort("blockedbyclient");
  });
  const violations: string[] = [];
  await page.exposeFunction("__reportViolation", (uri: string) => violations.push(uri));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __reportViolation(uri: string): void }).__reportViolation(e.blockedURI),
    );
  });

  await page.goto("/");
  await expect(page.getByTestId("app-root")).toBeVisible();
  // The window is empty, so nothing asks for the fonts yet: load both faces, as text will.
  await page.evaluate(() => Promise.all([document.fonts.load('16px "Overpass"'), document.fonts.load('16px "Overpass Mono"')]));
  await page.waitForLoadState("networkidle");

  // The page's own attempt to go out is stopped by its content security policy before any request is made.
  const fetched = await page.evaluate(() =>
    fetch("https://example.com/").then(
      () => "reached",
      () => "blocked",
    ),
  );
  expect(fetched).toBe("blocked");
  await expect.poll(() => violations).toContain("https://example.com/");

  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((url) => !url.startsWith(`${LOCAL}/`) && !url.startsWith("data:") && !url.startsWith("blob:"))).toEqual([]);
  // The fonts are among them: bundled with the build, not fetched from a font service.
  expect(requests.filter((url) => /\/assets\/Overpass(Mono)?-[\w-]+\.woff2$/.test(url))).toHaveLength(2);
});
