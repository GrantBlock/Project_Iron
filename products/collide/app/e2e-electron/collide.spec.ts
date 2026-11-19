// RUN3 T35: .collide files in the real Electron shell. Save as .collide writes a real file beside the markups
// (Documents/Collide/Markups, a temp folder here); a new process opens it with Open (the dialog is answered
// from the test, as in markups.spec.ts) and gets the same items in the same order and the same picture.
// Bad packages and files outside the folder are refused with a toast that says why.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { strToU8, unzipSync, zipSync } from "fflate";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { launch } from "./launch";

function answerDialog(app: ElectronApplication, filePaths: string[]) {
  return app.evaluate(({ dialog }, paths) => {
    (dialog as unknown as { showOpenDialog: (...args: unknown[]) => Promise<unknown> }).showOpenDialog = async () => ({ canceled: paths.length === 0, filePaths: paths });
  }, filePaths);
}

/** A 320 × 200 four-colour picture, opened in a Snip tab, with two boxes, a drawn ellipse with a note, and a pasted image beside it. */
async function makeSnip(page: Page, name: string) {
  await page.evaluate(async (fileName) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ["rgb(200, 30, 40)", "rgb(20, 160, 70)", "rgb(30, 60, 210)", "rgb(240, 200, 20)"].forEach((colour, i) => {
      ctx.fillStyle = colour;
      ctx.fillRect((i % 2) * 160, Math.floor(i / 2) * 100, 160, 100);
    });
    await window.__collide!.openImage(canvas.toDataURL("image/png"), fileName);
    window.__collide!.seedShape({ x: 20, y: 30, w: 120, h: 60 });
    window.__collide!.seedShape({ x: 180, y: 110, w: 90, h: 70 });
  }, name);
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const stage = await page.evaluate(() => window.__collide!.getState().stage!);
  const at = (ix: number, iy: number) => [box.x + stage.x + ix * stage.scale, box.y + stage.y + iy * stage.scale] as const;
  await page.getByRole("button", { name: "Ellipse", exact: true }).click();
  await page.mouse.move(...at(190, 20));
  await page.mouse.down();
  await page.mouse.move(...at(290, 80), { steps: 6 });
  await page.mouse.up();
  await page.getByTestId("callout-note").first().fill("Valve handle clashes with the rail");
  await page.getByTestId("callout-note").first().blur();
  await page.getByRole("slider", { name: "Fill of callout 2, percent" }).fill("40");
  // A pasted picture goes beside the image: the second source.
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 100;
    const x = c.getContext("2d")!;
    x.fillStyle = "rgb(10, 120, 200)";
    x.fillRect(0, 0, 160, 100);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob!], "p.png", { type: "image/png" }));
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect.poll(async () => (await page.evaluate(() => window.__collide!.state().items)).filter((i) => i.type === "image")).toHaveLength(1);
}

/** What has to come back: the items in order (as the test hook reads them) and the tab's title, and the picture. */
const snapshot = (page: Page) =>
  page.evaluate(async () => {
    const s = window.__collide!.state();
    return { items: s.items, title: s.tabs.find((t) => t.active)?.title, dirty: s.tabs.find((t) => t.active)?.dirty };
  });
const picture = (page: Page) => page.evaluate(async () => (await window.__collide!.exportPng()).dataUrl);
const toast = (page: Page) => page.getByTestId("toast");
// T45 (6.4): Save as .collide left the toolbar; it is the header's Save source.
const saveAs = (page: Page) => page.getByRole("button", { name: "Save source", exact: true }).click();

test("a snip saved as .collide reopens in a new process with the same items, order and picture", async () => {
  const documents = realpathSync(mkdtempSync(join(tmpdir(), "collide-e2e-docs-")));
  const root = join(documents, "Collide", "Markups");
  const file = join(root, "pump-skid.collide");
  try {
    let before: Awaited<ReturnType<typeof snapshot>>;
    let look: string;
    const first = await launch({ documents });
    try {
      const page = await first.app.firstWindow();
      await expect(page.getByTestId("canvas")).toBeVisible();
      await makeSnip(page, "Pump skid");
      before = await snapshot(page);
      expect(before.items.map((i) => i.type)).toEqual(["image", "ellipse", "rect", "rect"]);
      look = await picture(page);
      await saveAs(page);
      await expect(toast(page)).toHaveText("Saved pump-skid.collide · 2 sources and 4 items · Documents/Collide/Markups/");
    } finally {
      await first.close();
    }

    // The package on disk: manifest.json, the two sources in their own format, preview.png; nothing else in Markups.
    expect(readdirSync(root)).toEqual(["pump-skid.collide"]);
    const entries = unzipSync(new Uint8Array(readFileSync(file)));
    expect(Object.keys(entries).sort()).toEqual(["manifest.json", "preview.png", "sources/image-1.png", "sources/source.png"]);
    const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
    expect(manifest).toMatchObject({ format: "collide", version: 1, kind: "snip", title: "Pump skid", order: "back-to-front" });
    expect(manifest.items.map((s: { id: string }) => s.id)).toEqual([...before.items].reverse().map((i) => i.id));
    expect(manifest.items.find((s: { note?: string }) => s.note)).toMatchObject({ note: "Valve handle clashes with the rail", type: "ellipse" });

    const second = await launch({ documents });
    try {
      const { app } = second;
      const page = await app.firstWindow();
      await expect(page.getByTestId("canvas")).toBeVisible();
      await answerDialog(app, [file]);
      await page.getByTestId("open-markup").click();
      await expect(page.getByTestId("notice")).toContainText("Collide file opened");
      const after = await snapshot(page);
      expect(after).toEqual({ ...before, dirty: false });
      expect(await picture(page)).toBe(look);
      await expect(page.getByTestId("callout-note").first()).toHaveValue("Valve handle clashes with the rail");

      // Editable: a change, then Save as goes back to the same file.
      await page.evaluate(() => window.__collide!.seedShape({ x: 10, y: 150, w: 40, h: 30 }));
      await saveAs(page);
      await expect(toast(page)).toHaveText("Saved pump-skid.collide · 2 sources and 5 items · Documents/Collide/Markups/");
      expect(readdirSync(root)).toEqual(["pump-skid.collide"]);
      expect(JSON.parse(new TextDecoder().decode(unzipSync(new Uint8Array(readFileSync(file)))["manifest.json"])).items).toHaveLength(5);
    } finally {
      await second.close();
    }
  } finally {
    rmSync(documents, { recursive: true, force: true });
  }
});

test("a Markdown file saved as .collide reopens with the same text, items and pictures", async () => {
  const documents = realpathSync(mkdtempSync(join(tmpdir(), "collide-e2e-docs-")));
  const root = join(documents, "Collide", "Markups");
  const file = join(root, "P06-Project-Workspace-Spec.collide");
  try {
    let before: Awaited<ReturnType<typeof snapshot>>;
    const first = await launch({ documents });
    try {
      const page = await first.app.firstWindow();
      await expect(page.getByTestId("canvas")).toBeVisible();
      // The sample zip (dev and test only) has the Markdown file P06 with two callouts and a picture.
      await page.evaluate(() => (location.search = "?sample"));
      await page.getByRole("complementary", { name: "Recents" }).getByRole("button", { name: "P06-Project-Workspace-Spec.md", exact: true }).click();
      await expect(page.getByRole("toolbar", { name: "Markdown tools" })).toBeVisible();
      before = await snapshot(page);
      expect(before.items).toHaveLength(2);
      await saveAs(page);
      await expect(toast(page)).toHaveText("Saved P06-Project-Workspace-Spec.collide · the .md file with 2 items · Documents/Collide/Markups/");
    } finally {
      await first.close();
    }
    const entries = unzipSync(new Uint8Array(readFileSync(file)));
    expect(Object.keys(entries).sort()).toEqual(["manifest.json", "preview.png", "sources/P06-Project-Workspace-Spec.md", "sources/images/line-3-conveyor-guard.png"]);
    const text = new TextDecoder().decode(entries["sources/P06-Project-Workspace-Spec.md"]);
    expect(text).toContain("![Line 3 conveyor guard](images/line-3-conveyor-guard.png)");

    const second = await launch({ documents });
    try {
      const { app } = second;
      const page = await app.firstWindow();
      await expect(page.getByTestId("canvas")).toBeVisible();
      await answerDialog(app, [file]);
      await page.getByTestId("open-markup").click();
      await expect(page.getByTestId("notice")).toContainText("Collide file opened");
      await expect(page.getByRole("toolbar", { name: "Markdown tools" })).toBeVisible();
      expect(await snapshot(page)).toEqual({ ...before, dirty: false });
      // The picture comes from the package: the page shows it, not a missing-picture box.
      await expect(page.getByRole("img", { name: "Line 3 conveyor guard" })).toHaveJSProperty("tagName", "IMG");
      // The text is the same, byte for byte: Edit shows it.
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "P06-Project-Workspace-Spec.md" })).toHaveValue(text);
    } finally {
      await second.close();
    }
  } finally {
    rmSync(documents, { recursive: true, force: true });
  }
});

test("Open refuses a bad package and a file outside Documents/Collide/Markups, and says why", async () => {
  const { app, documents, close } = await launch();
  try {
    const root = join(documents, "Collide", "Markups");
    mkdirSync(root, { recursive: true });
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    const notice = page.getByTestId("notice");
    const tabs = () => page.evaluate(() => window.__collide!.state().tabs.length);

    // Zip-slip: an entry that climbs out of the package is refused before anything is unpacked.
    const slip = join(root, "slip.collide");
    writeFileSync(slip, zipSync({ "manifest.json": strToU8("{}"), "../../escape.txt": strToU8("x") }));
    await answerDialog(app, [slip]);
    await page.getByTestId("open-markup").click();
    await expect(notice).toContainText("Could not open the Collide file");
    await expect(notice).toContainText('It has an entry named "../../escape.txt", which points outside the package.');
    expect(await tabs()).toBe(0);
    expect(readdirSync(dirname(documents)).sort()).toEqual(["Documents", "user-data"]);

    // A manifest zod refuses.
    const bad = join(root, "bad.collide");
    writeFileSync(bad, zipSync({ "manifest.json": strToU8(JSON.stringify({ format: "collide", version: 9, kind: "snip" })) }));
    await answerDialog(app, [bad]);
    await page.getByTestId("open-markup").click();
    await expect(notice).toContainText("manifest.json: version");
    expect(await tabs()).toBe(0);

    // Not a zip at all.
    const text = join(root, "text.collide");
    writeFileSync(text, "hello, not a zip, but long enough to be read");
    await answerDialog(app, [text]);
    await page.getByTestId("open-markup").click();
    await expect(notice).toContainText("This file is not a Collide file");

    // Outside the folder: refused by the main process, whatever the dialog says.
    const outside = join(dirname(documents), "Desktop", "x.collide");
    mkdirSync(dirname(outside));
    writeFileSync(outside, readFileSync(bad));
    await answerDialog(app, [outside]);
    await page.getByTestId("open-markup").click();
    await expect(notice).toContainText(`${outside} is outside Documents/Collide/Markups.`);
    const direct = await page.evaluate((p) => window.collide!.collideFiles.open(p).then(() => "resolved", (e: Error) => e.message), outside);
    expect(direct).toContain("is outside Documents/Collide/Markups");
    const save = await page.evaluate(() => window.collide!.collideFiles.save("../../escape.collide", new Uint8Array([0x50, 0x4b, ...new Array(30).fill(0)]), false).then(() => "resolved", (e: Error) => e.message));
    expect(save).toContain("cannot be used as a Collide file name");
    expect(readdirSync(dirname(documents)).sort()).toEqual(["Desktop", "Documents", "user-data"]);
    expect(await tabs()).toBe(0);
  } finally {
    await close();
  }
});
