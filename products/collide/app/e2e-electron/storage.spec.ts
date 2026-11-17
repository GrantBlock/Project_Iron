// RUN3 T36: storage on the server PC (Server mode) in the real Electron shell. Settings → Storage shows the storage
// folder (Documents/Collide/Markups, a temp folder here), its item count and size, from the main process; with
// "keep the newest 2" set, the next save deletes the oldest items beyond 2, but never one open in a tab, and logs it.
import { expect, test, type Page } from "@playwright/test";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch } from "./launch";

const DAY = 24 * 60 * 60 * 1000;

/** Set the last-saved time of a markup folder's files (or of a file) to `daysAgo` days ago. */
function age(p: string, daysAgo: number) {
  const t = new Date(Date.now() - daysAgo * DAY);
  const files = existsSync(join(p, "annotations.json")) ? readdirSync(p).map((f) => join(p, f)) : [p];
  for (const f of files) utimesSync(f, t, t);
}

/** Open a 320 × 200 picture in a new Snip tab with one box, so it has something to save. */
async function newSnip(page: Page, name: string) {
  await page.evaluate(async (fileName) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(30, 60, 210)";
    ctx.fillRect(0, 0, 320, 200);
    await window.__collide!.openImage(canvas.toDataURL("image/png"), fileName);
    window.__collide!.seedShape({ x: 20, y: 30, w: 120, h: 60 });
  }, name);
}

async function saveMarkup(page: Page) {
  await page.getByTestId("save-markup").click();
  await expect(page.getByTestId("notice")).toContainText("Markup saved");
}

const usage = (page: Page) => page.getByTestId("storage-usage");

test("Settings → Storage shows the real folder, count and size; keep the newest 2 deletes the oldest beyond 2 after a save, never an open one", async () => {
  const documents = realpathSync(mkdtempSync(join(tmpdir(), "collide-e2e-docs-")));
  const root = join(documents, "Collide", "Markups");
  const launched = await launch({ documents });
  try {
    const page = await launched.app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();

    // A markup saved by the app, then copies of it with older save times, and an old Collide file.
    await newSnip(page, "Pump skid.png");
    await saveMarkup(page);
    await page.keyboard.press("Control+w");
    await expect(page.getByRole("tab")).toHaveCount(0);
    const [saved] = readdirSync(root);
    const recent = join(root, saved);
    const oldest = join(root, "2026-01-01_oldest");
    const openOne = join(root, "2026-02-01_open-in-a-tab");
    cpSync(recent, oldest, { recursive: true });
    cpSync(recent, openOne, { recursive: true });
    writeFileSync(join(root, "old.collide"), Buffer.from("PK\u0003\u0004 not opened, only counted"));
    age(oldest, 9);
    age(join(root, "old.collide"), 7);
    age(openOne, 5);
    age(recent, 1);
    const bytes = (dir: string) => readdirSync(dir).reduce((n, f) => n + readFileSync(join(dir, f)).length, 0);

    // ---- Settings → Storage: the real numbers, retention off (A). ----
    await page.getByRole("button", { name: "Settings and Connect" }).click();
    await expect(page.getByTestId("storage-folder")).toHaveText(root);
    await expect(usage(page)).toHaveText(/^4 items · .+ used$/);
    expect(await page.evaluate(() => window.collide!.storage.info())).toEqual({
      folder: root,
      items: 4,
      bytes: bytes(recent) * 3 + readFileSync(join(root, "old.collide")).length,
      keep: null,
    });
    await expect(page.getByTestId("storage-keep")).toHaveText("Off: every file is kept.");

    // ---- Keep the newest 2. Saving the setting deletes nothing by itself. ----
    await page.getByPlaceholder("[number of files]").fill("2");
    await page.getByTestId("save-markup").click();
    await expect(page.getByTestId("storage-keep")).toContainText("items past the newest 2 are deleted");
    expect(JSON.parse(readFileSync(join(launched.userData, "storage.json"), "utf8"))).toEqual({ keep: 2 });
    expect(readdirSync(root)).toHaveLength(4);

    // ---- One old markup open in a tab, then a new snip saved: the oldest beyond 2 go, the open one stays. ----
    await page.evaluate((folder) => window.__collide!.openMarkup(folder), openOne);
    await newSnip(page, "Valve.png");
    await saveMarkup(page);
    await expect.poll(() => readdirSync(root).length).toBe(3);
    const left = readdirSync(root);
    expect(left).toContain("2026-02-01_open-in-a-tab");
    expect(left).toContain(saved);
    expect(left.filter((n) => /^\d{4}-\d{2}-\d{2}_valve$/.test(n))).toHaveLength(1);
    expect(existsSync(oldest)).toBe(false);
    expect(existsSync(join(root, "old.collide"))).toBe(false);
    const log = readFileSync(join(launched.userData, "storage.log"), "utf8").trim().split("\n");
    expect(log.map((l) => l.replace(/^\S+ /, ""))).toEqual(["retention set: keep the newest 2", "deleted 2026-01-01_oldest (keep the newest 2)", "deleted old.collide (keep the newest 2)"]);
    for (const line of log) expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /);

    // Settings shows the new numbers.
    await page.getByRole("tab", { name: /Settings/ }).click();
    await expect(usage(page)).toHaveText(/^3 items · .+ used$/);
  } finally {
    await launched.close();
    rmSync(documents, { recursive: true, force: true });
  }
});
