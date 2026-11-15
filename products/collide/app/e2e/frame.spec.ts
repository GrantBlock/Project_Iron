import { expect, test } from "@playwright/test";

test("browser build keeps the framed look with its title row", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-root")).toHaveAttribute("data-frame", "framed");
  await expect(page.getByTestId("app-title")).toBeVisible();
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
      markups: { save: never, open: never, pick: never, list: never },
      overlay: { emit: () => undefined, on: () => () => undefined },
    };
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("app-root")).toHaveAttribute("data-frame", "native");
  await expect(page.getByTestId("app-title")).toHaveCount(0);
  // The toolbar starts at the very top-left of the window.
  const tb = (await page.getByTestId("toolbar").boundingBox())!;
  expect(tb.y).toBeLessThanOrEqual(1);
  expect(tb.x).toBeLessThanOrEqual(1);
});
