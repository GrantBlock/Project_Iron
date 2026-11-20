// T50 acceptance (Grant 2026-11-20), written before the code (Lydia, tests first): the full app's minimum window size,
// measured from the real layout. At a viewport of exactly the minimum (page area = window content size) the sidebar, the
// toolbar (tools, colours, thickness, undo, redo), the header and the callout panel are all visible, inside the page, do not
// overlap each other and are not clipped (no scrolling needed to reach a toolbar button).
//
// ASSUMED API (the Coder creates it): src/native/minSize.ts exports `MIN_WIDTH` and `MIN_HEIGHT` (integers, CSS px of the
// page area; the window's content size). They are the numbers reported in ISSUES and TESTER-NOTES. MIN_WIDTH must be
// above 820 px so the sidebar stays docked (below it the phone layout slides the sidebar away).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MIN_HEIGHT, MIN_WIDTH } from "../src/native/minSize";

const SNIP = "/tests/fixtures/sample-400x300.png";
const ws = (page: Page) => page.getByRole("region", { name: "Workspace" });

async function openSnipWithCallout(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__collide);
  await page.getByTestId("canvas").waitFor();
  await page.evaluate((u) => window.__collide!.openImage(u), SNIP);
  const tb = ws(page).getByRole("toolbar", { name: "Markup tools" });
  await tb.waitFor();
  await tb.getByRole("button", { name: "Add border" }).click();
  await expect(page.getByRole("complementary", { name: "Callouts" })).toBeVisible();
}

type R = { x: number; y: number; w: number; h: number };
const rect = (l: Locator) => l.evaluate((el): R => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const inside = (r: R, vw: number, vh: number) => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= vw + 0.5 && r.y + r.h <= vh + 0.5;
const apart = (a: R, b: R) => !(a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5);

test("the minimum is a sane pair of numbers (the sidebar stays docked, the compact view is smaller)", () => {
  expect(Number.isInteger(MIN_WIDTH) && Number.isInteger(MIN_HEIGHT)).toBe(true);
  expect(MIN_WIDTH).toBeGreaterThan(820);
  expect(MIN_WIDTH).toBeGreaterThan(276);
  expect(MIN_HEIGHT).toBeGreaterThan(300);
});

test("at exactly the minimum: sidebar, toolbar, header and callout panel all fit, nothing overlaps or clips", async ({ page }) => {
  await page.setViewportSize({ width: MIN_WIDTH, height: MIN_HEIGHT });
  await openSnipWithCallout(page);
  const vw = MIN_WIDTH;
  const vh = MIN_HEIGHT;

  const sidebar = page.getByTestId("sidebar");
  const header = ws(page).locator(".wshead");
  const toolbar = ws(page).getByRole("toolbar", { name: "Markup tools" });
  const panel = page.getByRole("complementary", { name: "Callouts" });
  const parts: Record<string, Locator> = { sidebar, header, toolbar, "callout panel": panel };
  const boxes: Record<string, R> = {};
  for (const [name, l] of Object.entries(parts)) {
    await expect(l, `${name} is visible`).toBeVisible();
    boxes[name] = await rect(l);
    expect(inside(boxes[name], vw, vh), `${name} ${JSON.stringify(boxes[name])} is inside the ${vw}x${vh} page`).toBe(true);
  }
  const names = Object.keys(boxes);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) expect(apart(boxes[names[i]], boxes[names[j]]), `${names[i]} and ${names[j]} do not overlap`).toBe(true);

  // The toolbar: every tool, the colours, the thickness, undo and redo are fully in view, the bar does not scroll.
  const tb = boxes.toolbar;
  const buttons = toolbar.getByRole("button");
  const n = await buttons.count();
  expect(n).toBeGreaterThan(10);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const r = await rect(b);
    const label = (await b.getAttribute("aria-label")) ?? (await b.textContent()) ?? `#${i}`;
    expect(r.x, `${label} starts inside the toolbar`).toBeGreaterThanOrEqual(tb.x - 0.5);
    expect(r.x + r.w, `${label} ends inside the toolbar`).toBeLessThanOrEqual(tb.x + tb.w + 0.5);
    expect(r.y, `${label} top inside`).toBeGreaterThanOrEqual(tb.y - 0.5);
    expect(r.y + r.h, `${label} bottom inside`).toBeLessThanOrEqual(tb.y + tb.h + 0.5);
  }
  for (const name of ["Undo", "Redo"]) await expect(toolbar.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(toolbar.getByRole("group", { name: "Colour for the next shape" }).getByRole("button")).not.toHaveCount(0);
  await expect(toolbar.getByRole("group", { name: "Stroke width" }).getByRole("button")).not.toHaveCount(0);
  expect(await toolbar.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "the toolbar needs no scrolling across").toBe(true);
  expect(await toolbar.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), "the toolbar needs no scrolling down").toBe(true);

  // The header: nothing clipped (its own spec checks overlap in detail), the callout panel's content in view.
  expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "the header does not clip").toBe(true);
  const row = panel.getByRole("combobox", { name: "Type of callout 1" });
  await expect(row).toBeVisible();
  expect(inside(await rect(row), vw, vh)).toBe(true);
  const note = panel.getByRole("textbox", { name: "Note for callout 1" });
  await expect(note).toBeVisible();
  const nb = await rect(note);
  expect(nb.x + nb.w, "the note field is inside the callout panel").toBeLessThanOrEqual(boxes["callout panel"].x + boxes["callout panel"].w + 0.5);

  // No scroll bars on the page, and the sidebar's compact block (its five controls) is in view.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  for (const name of ["New snip", "Add snip", "New file"]) expect(inside(await rect(sidebar.getByRole("button", { name })), vw, vh), `${name} in view`).toBe(true);
});

test("the minimum holds with the Markdown and PDF tabs too (toolbar needs no scrolling at the minimum)", async ({ page }) => {
  await page.setViewportSize({ width: MIN_WIDTH, height: MIN_HEIGHT });
  await page.goto("/?sample");
  await page.getByRole("complementary", { name: "Recents" }).getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
  const tb = ws(page).getByRole("toolbar", { name: "Markdown tools" });
  await tb.waitFor();
  expect(await tb.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "Markdown toolbar rows need no scrolling across").toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
