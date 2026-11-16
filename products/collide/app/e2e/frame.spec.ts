import { expect, test } from "@playwright/test";

// T31: the layout is the prototype's. The app fills the window edge to edge in the browser too: the browser build's
// in-app frame and its "Collide · Snip & Markup" title row are gone, and the name is the sidebar's brand.
test("browser build: edge to edge like the desktop app, with the Collide name in the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("app-root")).toHaveAttribute("data-frame", "browser");
  await expect(page.getByTestId("app-title")).toHaveCount(0);
  await expect(page.getByTestId("sidebar").getByText("Collide", { exact: true })).toBeVisible();
  const root = (await page.getByTestId("app-root").boundingBox())!;
  expect([root.x, root.y, root.width, root.height]).toEqual([0, 0, 1280, 800]);
});

test("desktop app: no second border or title inside the native Windows frame", async ({ page }) => {
  // Minimal stand-in for the Electron preload bridge (`window.collide`) so the app takes its desktop path.
  await page.addInitScript(() => {
    const never = () => new Promise<never>(() => undefined);
    (window as unknown as Record<string, unknown>).collide = {
      captureMonitor: never,
      cropCapture: never,
      hideEditor: never,
      showEditor: never,
      showOverlay: never,
      hideOverlay: never,
      copyImage: never,
      settingsStatus: async () => null,
      onSnipRequest: () => () => undefined,
      markups: { save: never, open: never, pick: never, list: async () => [], remove: never },
      overlay: { emit: () => undefined, on: () => () => undefined },
    };
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("app-root")).toHaveAttribute("data-frame", "native");
  await expect(page.getByTestId("app-title")).toHaveCount(0);
  // T31: the sidebar (was: the toolbar) starts at the very top-left of the window.
  const sb = (await page.getByTestId("sidebar").boundingBox())!;
  expect(sb.y).toBeLessThanOrEqual(1);
  expect(sb.x).toBeLessThanOrEqual(1);
});
