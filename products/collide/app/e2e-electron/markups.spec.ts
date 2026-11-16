// T16: markup storage in the real Electron shell: Save and Open through the preload
// bridge to real folders. The Documents folder is a temp folder (launch.ts) and the
// folder dialog is replaced from the test, as Playwright allows: the app has no test hook for either.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { launch } from "./launch";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FILES = ["annotations.json", "export.png", "source.png"];
const OUTSIDE = (shown: string) => `${shown} is outside Documents/Collide/Markups. Pick a folder inside Documents/Collide/Markups.`;

interface DialogResult {
  canceled: boolean;
  filePaths: string[];
}

/** Answer the next folder dialogs with `result` instead of showing one, and remember what the shell asked for. */
function answerDialog(app: ElectronApplication, result: DialogResult) {
  return app.evaluate(({ dialog }, answer) => {
    const g = globalThis as unknown as { __dialogAsked: unknown[] };
    g.__dialogAsked = [];
    (dialog as unknown as { showOpenDialog: (...args: unknown[]) => Promise<unknown> }).showOpenDialog = async (...args) => {
      // (window, options) or (options)
      g.__dialogAsked.push({ onWindow: args.length === 2, options: args[args.length - 1] });
      return answer;
    };
  }, result);
}

const dialogAsked = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { __dialogAsked: unknown[] }).__dialogAsked);

/** Open a 320 x 200 four-colour image made on the page (the collide:// origin serves only the build); add two boxes and a numbered ellipse with a note. */
async function openAnnotatedImage(page: Page, name: string) {
  await page.evaluate(async (fileName) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    const colours = ["rgb(200, 30, 40)", "rgb(20, 160, 70)", "rgb(30, 60, 210)", "rgb(240, 200, 20)"];
    colours.forEach((colour, i) => {
      ctx.fillStyle = colour;
      ctx.fillRect((i % 2) * 160, Math.floor(i / 2) * 100, 160, 100);
    });
    await window.__collide!.openImage(canvas.toDataURL("image/png"), fileName);
    window.__collide!.seedShape({ x: 20, y: 30, w: 120, h: 60 });
    window.__collide!.seedShape({ x: 180, y: 110, w: 90, h: 70 });
  }, name);
  // A numbered shape, drawn by hand on the image (image px 190,20 to 290,80), so there is a callout to put a note on.
  const box = (await page.getByTestId("canvas").boundingBox())!;
  const stage = await page.evaluate(() => window.__collide!.getState().stage!);
  const at = (ix: number, iy: number) => [box.x + stage.x + ix * stage.scale, box.y + stage.y + iy * stage.scale] as const;
  // T32 (Grant 2026-11-15): no filled tools; an ellipse filled with its card's Fill %.
  await page.getByRole("button", { name: "Ellipse", exact: true }).click();
  await page.mouse.move(...at(190, 20));
  await page.mouse.down();
  await page.mouse.move(...at(240, 50), { steps: 4 });
  await page.mouse.move(...at(290, 80), { steps: 4 });
  await page.mouse.up();
  // The list runs front to back: the ellipse just drawn (callout 2) is first.
  await page.getByTestId("callout-note").first().fill("Valve handle clashes with the rail");
  await page.getByTestId("callout-note").first().blur();
  await page.getByRole("slider", { name: "Fill of callout 2, percent" }).fill("100");
}

/** A hash of a PNG's pixels (decoded on the page) and its size. */
function pngPixels(page: Page, png: number[] | string) {
  return page.evaluate(async (source) => {
    const img = new Image();
    const url = typeof source === "string" ? source : URL.createObjectURL(new Blob([new Uint8Array(source)], { type: "image/png" }));
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data[i], 16777619) >>> 0;
    return { width: canvas.width, height: canvas.height, hash, topLeft: [...data.slice(0, 3)] };
  }, png);
}

/** What the editor shows, flattened (image plus annotations). */
const flattened = (page: Page) => page.evaluate(async () => (await window.__collide!.exportPng()).dataUrl);

async function save(page: Page, root: string, folderName: RegExp): Promise<string> {
  await page.getByTestId("save-markup").click();
  const notice = page.getByTestId("notice");
  await expect(notice).toContainText("Markup saved");
  const folders = readdirSync(root);
  expect(folders).toHaveLength(1);
  expect(folders[0]).toMatch(folderName);
  const folder = join(root, folders[0]);
  // The toast names the folder it wrote.
  await expect(notice).toContainText(folder);
  return folder;
}

test("save, close, open: identical annotations and image, from real folders under Documents/Collide/Markups", async () => {
  const documents = realpathSync(mkdtempSync(join(tmpdir(), "collide-e2e-docs-")));
  const root = join(documents, "Collide", "Markups");
  try {
    // ---- First run: annotate, save, quit. ----
    const first = await launch({ documents });
    let folder: string;
    let savedDoc: unknown;
    let savedLook: string;
    try {
      const page = await first.app.firstWindow();
      await expect(page.getByTestId("canvas")).toBeVisible();
      expect(existsSync(join(documents, "Collide"))).toBe(false);
      await openAnnotatedImage(page, "Pump skid P-101.png");
      savedDoc = await page.evaluate(() => window.__collide!.getDoc());
      const shapes = (savedDoc as { shapes: { callout?: number; note?: string }[] }).shapes;
      expect(shapes).toHaveLength(3);
      expect(shapes.filter((shape) => shape.callout === 1 && shape.note === "Valve handle clashes with the rail")).toHaveLength(1);
      savedLook = await flattened(page);
      folder = await save(page, root, /^\d{4}-\d{2}-\d{2}_pump-skid-p-101$/);
    } finally {
      await first.close();
    }

    // The same layout as before the move: three files in the markup's folder, and nothing else in Documents.
    expect(readdirSync(documents)).toEqual(["Collide"]);
    expect(readdirSync(join(documents, "Collide"))).toEqual(["Markups"]);
    expect(readdirSync(folder).sort()).toEqual(FILES);
    const onDisk = () => Object.fromEntries(FILES.map((f) => [f, readFileSync(join(folder, f))]));
    const written = onDisk();
    expect(JSON.parse(written["annotations.json"].toString("utf8"))).toEqual(savedDoc);
    expect(written["annotations.json"].toString("utf8")).toBe(JSON.stringify(savedDoc, null, 2));
    expect([...written["source.png"].subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect([...written["export.png"].subarray(0, 8)]).toEqual(PNG_SIGNATURE);

    // ---- Second run: a new process with nothing open. ----
    const second = await launch({ documents });
    try {
      const { app } = second;
      const page = await app.firstWindow();
      await expect(page.getByTestId("canvas")).toBeVisible();
      expect(await page.evaluate(() => window.__collide!.getDoc())).toBeNull();
      expect(await page.evaluate(() => window.collide!.markups.list())).toEqual([folder]);

      // Cancelling the dialog opens nothing and says nothing.
      await answerDialog(app, { canceled: true, filePaths: [] });
      await page.getByTestId("open-markup").click();
      await expect.poll(() => dialogAsked(app)).toEqual([{ onWindow: true, options: { title: "Open markup folder", defaultPath: root, properties: ["openDirectory"] } }]);
      await expect(page.getByTestId("notice")).toHaveCount(0);
      expect(await page.evaluate(() => window.__collide!.getDoc())).toBeNull();

      // Picking the saved folder opens it: the same doc, the same image, the same look.
      await answerDialog(app, { canceled: false, filePaths: [folder] });
      await page.getByTestId("open-markup").click();
      const notice = page.getByTestId("notice");
      await expect(notice).toContainText("Markup opened");
      await expect(notice).toContainText(/\d{4}-\d{2}-\d{2}_pump-skid-p-101/);
      const state = await page.evaluate(() => ({ doc: window.__collide!.getDoc(), image: window.__collide!.getState().image }));
      expect(state.doc).toEqual(savedDoc);
      expect(state.image).toMatchObject({ width: 320, height: 200 });
      expect(await flattened(page)).toBe(savedLook);
      await expect(page.getByTestId("callout-note").first()).toHaveValue("Valve handle clashes with the rail");

      // The source image comes back from disk byte for byte, and it is the picture that was opened.
      const read = await page.evaluate(async (dir) => {
        const files = await window.collide!.markups.open(dir);
        return { keys: Object.keys(files).sort(), isBytes: files.sourcePng instanceof Uint8Array, source: [...files.sourcePng], annotations: files.annotations };
      }, folder);
      expect(read.keys).toEqual(["annotations", "sourcePng"]);
      expect(read.isBytes).toBe(true);
      expect(Buffer.from(read.source).equals(written["source.png"])).toBe(true);
      expect(read.annotations).toBe(written["annotations.json"].toString("utf8"));
      expect(await pngPixels(page, read.source)).toEqual({ width: 320, height: 200, hash: expect.any(Number), topLeft: [200, 30, 40] });
      const original = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 200;
        const ctx = canvas.getContext("2d")!;
        ["rgb(200, 30, 40)", "rgb(20, 160, 70)", "rgb(30, 60, 210)", "rgb(240, 200, 20)"].forEach((colour, i) => {
          ctx.fillStyle = colour;
          ctx.fillRect((i % 2) * 160, Math.floor(i / 2) * 100, 160, 100);
        });
        return canvas.toDataURL("image/png");
      });
      expect(await pngPixels(page, read.source)).toEqual(await pngPixels(page, original));

      // Saving the opened markup again goes to the same folder: the same images byte for byte, the same doc.
      expect(await save(page, root, /^\d{4}-\d{2}-\d{2}_pump-skid-p-101$/)).toBe(folder);
      const again = onDisk();
      for (const file of ["source.png", "export.png"]) expect(again[file].equals(written[file]), file).toBe(true);
      // The same doc; the model writes a parsed shape's keys in another order, as it did before the move.
      expect(JSON.parse(again["annotations.json"].toString("utf8"))).toEqual(savedDoc);
    } finally {
      await second.close();
    }
  } finally {
    rmSync(documents, { recursive: true, force: true });
  }
});

test("a folder outside Documents/Collide/Markups is refused: Open says why, and the bridge refuses every way out", async () => {
  const { app, documents, close } = await launch();
  try {
    const root = join(documents, "Collide", "Markups");
    const page = await app.firstWindow();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await openAnnotatedImage(page, "plan.png");
    const inside = await save(page, root, /^\d{4}-\d{2}-\d{2}_plan$/);

    // A complete markup, but on the "Desktop": only its place is wrong.
    const desktop = join(dirname(documents), "Desktop");
    const outside = join(desktop, "plan");
    cpSync(inside, outside, { recursive: true });
    const outsideBefore = FILES.map((f) => readFileSync(join(outside, f)));

    await page.reload();
    await expect(page.getByTestId("canvas")).toBeVisible();
    expect(await page.evaluate(() => window.__collide!.getDoc())).toBeNull();
    await answerDialog(app, { canceled: false, filePaths: [outside] });
    await page.getByTestId("open-markup").click();
    const notice = page.getByTestId("notice");
    await expect(notice).toContainText("Could not open markup");
    await expect(notice).toContainText(OUTSIDE(outside));
    expect(await dialogAsked(app)).toHaveLength(1);
    expect(await page.evaluate(() => window.__collide!.getDoc())).toBeNull();
    expect(await page.evaluate(() => window.__collide!.getState().image)).toBeNull();

    // The same rule for anything the page could send, whatever the dialog says.
    const traversal = join(root, "..", "..", "..", "Desktop", "plan");
    const result = await page.evaluate(
      async ({ inside, outside, traversal, desktop }) => {
        const { markups } = window.collide!;
        const message = (p: Promise<unknown>) => p.then(() => "resolved", (e: unknown) => (e as Error).message);
        const files = { sourcePng: new Uint8Array([137, 80, 78, 71]), annotations: "{}", exportPng: new Uint8Array([137, 80, 78, 71]) };
        return {
          openOutside: await message(markups.open(outside)),
          openTraversal: await message(markups.open(traversal)),
          openRelative: await message(markups.open("../../../Desktop/plan")),
          openParent: await message(markups.open(desktop)),
          openSystem: await message(markups.open("/etc")),
          openWindowsPath: await message(markups.open("C:\\Windows\\System32")),
          saveTraversal: await message(markups.save("../../../Desktop/escape", files)),
          saveAbsolute: await message(markups.save(`${desktop}/escape`, files)),
          saveNested: await message(markups.save("plan/escape", files)),
          saveNothing: await message(markups.save("escape", {} as never)),
          openInside: await message(markups.open(inside)),
          list: await markups.list(),
        };
      },
      { inside, outside, traversal, desktop },
    );
    const badName = (name: string) => `"${name}" cannot be used as a markup folder name: it must be one folder name inside Documents/Collide/Markups. Open the image again, then save.`;
    expect(result).toEqual({
      openOutside: OUTSIDE(outside),
      openTraversal: OUTSIDE(traversal),
      openRelative: OUTSIDE("../../../Desktop/plan"),
      openParent: OUTSIDE(desktop),
      openSystem: OUTSIDE("/etc"),
      // On Windows this is an absolute path outside; elsewhere it is an odd name inside Markups that does not exist.
      openWindowsPath: process.platform === "win32" ? OUTSIDE("C:\\Windows\\System32") : expect.stringContaining("is missing source.png or annotations.json"),
      saveTraversal: badName("../../../Desktop/escape"),
      saveAbsolute: badName(`${desktop}/escape`),
      saveNested: badName("plan/escape"),
      saveNothing: "The markup to save is incomplete: source.png, annotations.json or export.png is missing. Save again.",
      openInside: "resolved",
      list: [inside],
    });

    // Nothing was written outside, and the folder outside is untouched.
    expect(readdirSync(desktop)).toEqual(["plan"]);
    expect(readdirSync(outside).sort()).toEqual(FILES);
    FILES.forEach((f, i) => expect(readFileSync(join(outside, f)).equals(outsideBefore[i]), f).toBe(true));
    expect(readdirSync(root)).toEqual([inside.slice(root.length + 1)]);
    expect(readdirSync(inside).sort()).toEqual(FILES);
    expect(readdirSync(dirname(documents)).sort()).toEqual(["Desktop", "Documents", "user-data"]);
  } finally {
    await close();
  }
});
