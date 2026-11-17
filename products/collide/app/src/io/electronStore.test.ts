// T16: the page side of markup storage in the Electron shell. The bridge here is the
// real main-process store (src/native/markups.ts) on a temp folder, so a save and an
// open go through the same code as in the app, minus the IPC hop.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollideBridge } from "../native/bridge";
import { createMarkups } from "../native/markups";
import type { AnnotationsDoc } from "../model";
import { ElectronMarkupStore } from "./electronStore";
import { createMarkupStore } from "./index";
import { MarkupError, MemoryMarkupStore, type MarkupStore } from "./markupStore";

const doc: AnnotationsDoc = {
  version: 1,
  source: { kind: "image", width: 400, height: 300 },
  shapes: [
    { id: "a1", type: "rect", x: 10, y: 20, w: 100, h: 50, stroke: "#E53935", strokeWidth: 3, callout: 1, note: "Misaligned" },
    { id: "a2", type: "arrow", x: 5, y: 5, w: 0, h: 0, stroke: "#E53935", strokeWidth: 2, points: [0, 0, 40, 30] },
  ],
};
const bytes = (...n: number[]) => new Uint8Array(n);

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  delete window.collide;
});

/** `window.collide.markups` as the preload gives it: every call a promise, failures as plain Errors carrying the main process's message. */
function bridge() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "collide-store-")));
  made.push(base);
  const root = path.join(base, "Documents", "Collide", "Markups");
  let picked: string | null = null;
  const main = createMarkups({
    fs,
    path,
    documents: () => path.join(base, "Documents"),
    showOpenDialog: async () => (picked === null ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [picked] }),
  });
  const overIpc = async <T>(run: () => T | Promise<T>): Promise<T> => {
    let message: string;
    try {
      return await run();
    } catch (e) {
      message = (e as Error).message; // only the text crosses the bridge, never the typed error
    }
    throw new Error(message);
  };
  const markups: CollideBridge["markups"] = {
    save: (folderName, files) => overIpc(() => main.save(folderName, files)),
    open: (folder) => overIpc(() => main.open(folder)),
    pick: () => overIpc(() => main.pick()),
    list: () => overIpc(() => main.list()),
    remove: (folder) => overIpc(() => main.remove(folder)),
  };
  return { markups, base, root, pick: (p: string | null) => void (picked = p) };
}

/** A MarkupError's title and message. */
async function markupError(p: Promise<unknown>): Promise<{ title: string; message: string }> {
  const e = await p.then(
    () => {
      throw new Error("expected a MarkupError, but the call succeeded");
    },
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(MarkupError);
  return { title: (e as MarkupError).title, message: (e as MarkupError).message };
}

describe("ElectronMarkupStore", () => {
  it("round-trips source bytes and the annotations doc through real folders", async () => {
    const { markups, root } = bridge();
    const s: MarkupStore = new ElectronMarkupStore(markups);
    const id = await s.save("2026-11-13_x", { sourcePng: bytes(137, 80, 78, 71, 1), annotations: doc, exportPng: bytes(9, 9) });
    expect(id).toBe(path.join(root, "2026-11-13_x"));
    // The same layout as the Rust shell's store wrote.
    expect(fs.readdirSync(id).sort()).toEqual(["annotations.json", "export.png", "source.png"]);
    expect(JSON.parse(fs.readFileSync(path.join(id, "annotations.json"), "utf8"))).toEqual(doc);
    expect([...fs.readFileSync(path.join(id, "export.png"))]).toEqual([9, 9]);

    const m = await s.open(id);
    expect(m.annotations).toEqual(doc);
    expect(m.sourcePng).toBeInstanceOf(Uint8Array);
    expect([...m.sourcePng]).toEqual([137, 80, 78, 71, 1]);
    expect(m.folderName).toBe("2026-11-13_x");
    expect(await s.list!()).toEqual([id]);
  });

  it("remove deletes the folder on disk; a refusal comes back as a MarkupError with the main process's text (T31)", async () => {
    const { markups, root } = bridge();
    const s = new ElectronMarkupStore(markups);
    const id = await s.save("2026-11-15_gone", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) });
    await s.remove(id);
    expect(fs.existsSync(id)).toBe(false);
    expect(await s.list()).toEqual([]);
    const e = await s.remove(root).then(
      () => null,
      (err: unknown) => err,
    );
    expect(e).toBeInstanceOf(MarkupError);
    expect((e as MarkupError).title).toBe("Could not delete markup");
    expect((e as MarkupError).message).toContain("is not a markup folder directly inside Documents/Collide/Markups");
  });

  it("the folder name is the last segment, with either slash and a trailing one", async () => {
    const opened: string[] = [];
    const s = new ElectronMarkupStore({
      save: async () => "",
      open: async (folder) => {
        opened.push(folder);
        return { sourcePng: bytes(1), annotations: JSON.stringify(doc) };
      },
      pick: async () => null,
      list: async () => [],
      remove: async () => undefined,
    });
    expect((await s.open("C:\\Users\\g\\Documents\\Collide\\Markups\\2026-11-13_x")).folderName).toBe("2026-11-13_x");
    expect((await s.open("/home/g/Documents/Collide/Markups/plan/")).folderName).toBe("plan");
    expect(opened).toEqual(["C:\\Users\\g\\Documents\\Collide\\Markups\\2026-11-13_x", "/home/g/Documents/Collide/Markups/plan/"]);
  });

  it("pick: the chosen folder, or null when cancelled", async () => {
    const { markups, pick } = bridge();
    const s = new ElectronMarkupStore(markups);
    expect(await s.pick()).toBeNull();
    const id = await s.save("plan", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) });
    pick(id);
    expect(await s.pick()).toBe(id);
    expect((await s.open((await s.pick())!)).annotations).toEqual(doc);
  });

  it("a folder outside Documents/Collide/Markups is refused, as a MarkupError naming the cause and the fix", async () => {
    const { markups, base, root, pick } = bridge();
    const s = new ElectronMarkupStore(markups);
    const inside = await s.save("plan", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) });
    const outside = path.join(base, "Desktop", "plan");
    fs.cpSync(inside, outside, { recursive: true });
    const refusal = { title: "Could not open markup", message: `${outside} is outside Documents/Collide/Markups. Pick a folder inside Documents/Collide/Markups.` };
    expect(await markupError(s.open(outside))).toEqual(refusal);
    pick(outside);
    expect(await markupError(s.pick())).toEqual(refusal);
    expect((await markupError(s.open(path.join(root, "..", "..", "..", "Desktop", "plan")))).message).toContain("is outside Documents/Collide/Markups");
    const escape = await markupError(s.save("../../../Desktop/escape", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) }));
    expect(escape.title).toBe("Could not save markup");
    expect(escape.message).toContain("cannot be used as a markup folder name");
    expect(fs.readdirSync(path.join(base, "Desktop"))).toEqual(["plan"]);
  });

  it("opening a missing folder and a failed write keep the Rust shell store's messages", async () => {
    const { markups, root } = bridge();
    const s = new ElectronMarkupStore(markups);
    const missing = await markupError(s.open(path.join(root, "nope")));
    expect(missing.title).toBe("Could not open markup");
    expect(missing.message).toContain(`${path.join(root, "nope")} is missing source.png or annotations.json (`);
    expect(missing.message).toMatch(/\)\. Pick a folder created by Save\.$/);

    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "taken"), "a file where the folder should go");
    const failed = await markupError(s.save("taken", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) }));
    expect(failed.title).toBe("Could not save markup");
    expect(failed.message).toMatch(/^Writing .*taken failed \(.*\)\. Check that Documents\/Collide\/Markups is writable and has free space, then save again\.$/);
  });

  it("surfaces a corrupt annotations.json clearly", async () => {
    const { markups } = bridge();
    const s = new ElectronMarkupStore(markups);
    const id = await s.save("f", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) });
    fs.writeFileSync(path.join(id, "annotations.json"), "{ not json");
    await expect(s.open(id)).rejects.toThrow(/not valid JSON/);
    fs.writeFileSync(path.join(id, "annotations.json"), JSON.stringify({ ...doc, shapes: [{ ...doc.shapes[0], w: "wide" }] }));
    const bad = await markupError(s.open(id));
    expect(bad.title).toBe("Could not open markup");
    expect(bad.message).toMatch(/shapes\[0\]\.w must be a number — check annotations\.json/);
  });
});

describe("createMarkupStore", () => {
  it("is the Electron store when window.collide exists, and talks to its markups", async () => {
    const save = vi.fn(async () => "/docs/Collide/Markups/x");
    window.collide = { markups: { save, open: vi.fn(), pick: vi.fn(), list: vi.fn() } } as unknown as CollideBridge;
    const s = createMarkupStore();
    expect(s).toBeInstanceOf(ElectronMarkupStore);
    expect(await s.save("x", { sourcePng: bytes(1), annotations: doc, exportPng: bytes(2) })).toBe("/docs/Collide/Markups/x");
    expect(save).toHaveBeenCalledWith("x", { sourcePng: bytes(1), annotations: JSON.stringify(doc, null, 2), exportPng: bytes(2) });
  });

  it("is the browser's memory store without it", () => {
    expect(window.collide).toBeUndefined();
    expect(createMarkupStore()).toBeInstanceOf(MemoryMarkupStore);
  });
});
