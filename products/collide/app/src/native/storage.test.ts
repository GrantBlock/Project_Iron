// @vitest-environment node
// RUN3 T36: storage on the server PC, in the main process: the storage folder's items, size and count, "keep the
// newest N" (off by default), and retention after a save: the oldest beyond N go, never an open one, never anything
// outside the folder. A real temp folder, a fixed clock, and an fs that records every deletion.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMarkups } from "./markups";
import { createStorage, itemsToDelete, MAX_KEEP, newestFirst, STORAGE_LOG_FILE, STORAGE_SETTINGS_FILE, StorageError, type StorageFs, type StorageItem } from "./storage";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = new Date("2026-11-17T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function sandbox() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "collide-storage-")));
  made.push(base);
  const documents = path.join(base, "Documents");
  const userData = path.join(base, "user-data");
  fs.mkdirSync(documents);
  const root = path.join(documents, "Collide", "Markups");
  // Every deletion goes through here, so a test can check that nothing outside the folder was touched.
  const unlinked: string[] = [];
  const removedDirs: string[] = [];
  const recording: StorageFs & Parameters<typeof createMarkups>[0]["fs"] = {
    readdirSync: (d: string, o: { withFileTypes: true }) => fs.readdirSync(d, o),
    statSync: (p: string) => fs.statSync(p),
    lstatSync: (p: string) => fs.lstatSync(p),
    realpathSync: (p: string) => fs.realpathSync(p),
    readFileSync: ((p: string, enc?: "utf8") => (enc ? fs.readFileSync(p, enc) : fs.readFileSync(p))) as never,
    writeFileSync: (p: string, data: Uint8Array | string) => fs.writeFileSync(p, data),
    appendFileSync: (p: string, data: string) => fs.appendFileSync(p, data),
    mkdirSync: (d: string, o: { recursive: true }) => fs.mkdirSync(d, o),
    unlinkSync: (p: string) => {
      unlinked.push(p);
      fs.unlinkSync(p);
    },
    rmdirSync: (d: string) => {
      removedDirs.push(d);
      fs.rmdirSync(d);
    },
  };
  const markups = createMarkups({ fs: recording, path, documents: () => documents, showOpenDialog: async () => ({ canceled: true, filePaths: [] }) });
  const storage = createStorage({ fs: recording, path, documents: () => documents, userData: () => userData, now: () => NOW, markups });
  const at = (p: string, daysAgo: number) => {
    const t = new Date(NOW.getTime() - daysAgo * DAY);
    fs.utimesSync(p, t, t);
  };
  /** A saved markup (Save's three files), last saved `daysAgo` days before NOW. */
  const markup = (name: string, daysAgo: number) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "source.png"), new Uint8Array(100));
    fs.writeFileSync(path.join(dir, "annotations.json"), "{}");
    fs.writeFileSync(path.join(dir, "export.png"), new Uint8Array(40));
    for (const f of ["source.png", "annotations.json", "export.png"]) at(path.join(dir, f), daysAgo);
    return dir;
  };
  const collide = (name: string, daysAgo: number, size = 50) => {
    fs.mkdirSync(root, { recursive: true });
    const file = path.join(root, name);
    fs.writeFileSync(file, new Uint8Array(size));
    at(file, daysAgo);
    return file;
  };
  const left = () => (fs.existsSync(root) ? fs.readdirSync(root).sort() : []);
  const log = () => (fs.existsSync(path.join(userData, STORAGE_LOG_FILE)) ? fs.readFileSync(path.join(userData, STORAGE_LOG_FILE), "utf8") : "");
  return { base, documents, userData, root, storage, markup, collide, at, left, log, unlinked, removedDirs };
}

const item = (name: string, time: number): StorageItem => ({ name, kind: "markup", time, bytes: 0 });

describe("retention order (pure)", () => {
  it("newest first; the same time goes by name, the later name first", () => {
    const order = newestFirst([item("2026-11-01_a", 5), item("2026-11-03_c", 9), item("2026-11-02_b", 5)]).map((i) => i.name);
    expect(order).toEqual(["2026-11-03_c", "2026-11-02_b", "2026-11-01_a"]);
  });

  it("deletes everything past the newest N, oldest first; off (null) deletes nothing", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3), item("d", 4), item("e", 5)];
    expect(itemsToDelete(items, 2, new Set()).map((i) => i.name)).toEqual(["a", "b", "c"]);
    expect(itemsToDelete(items, 5, new Set())).toEqual([]);
    expect(itemsToDelete(items, 9, new Set())).toEqual([]);
    expect(itemsToDelete(items, null, new Set())).toEqual([]);
  });

  it("never an open item, even the oldest; open items count toward N", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3), item("d", 4)];
    expect(itemsToDelete(items, 1, new Set(["a", "c"])).map((i) => i.name)).toEqual(["b"]);
    expect(itemsToDelete(items, 1, new Set(["d"])).map((i) => i.name)).toEqual(["a", "b", "c"]);
  });
});

describe("storage folder: info", () => {
  it("nothing saved yet: the folder, no items, 0 bytes, keep off; nothing is created", () => {
    const s = sandbox();
    expect(s.storage.info()).toEqual({ folder: s.root, items: 0, bytes: 0, keep: null });
    expect(fs.existsSync(path.join(s.documents, "Collide"))).toBe(false);
  });

  it("counts markup folders and .collide files with their size; other files and links are not items", () => {
    const s = sandbox();
    s.markup("2026-11-10_pump", 3); // 100 + 2 + 40
    s.collide("pump.collide", 2, 50);
    fs.writeFileSync(path.join(s.root, "notes.txt"), "not Collide's");
    const outside = path.join(s.base, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "big.bin"), new Uint8Array(5000));
    fs.symlinkSync(outside, path.join(s.root, "leads-out"), "dir");
    expect(s.storage.info()).toEqual({ folder: s.root, items: 2, bytes: 142 + 50, keep: null });
  });
});

describe("storage folder: keep the newest N", () => {
  it("is off by default (A): prune deletes nothing however many items there are", () => {
    const s = sandbox();
    for (let i = 1; i <= 6; i++) s.markup(`2026-11-0${i}_snip`, 10 - i);
    expect(s.storage.prune([])).toEqual({ deleted: [], info: expect.objectContaining({ items: 6, keep: null }) });
    expect(s.left()).toHaveLength(6);
    expect(s.unlinked).toEqual([]);
  });

  it("accepts a whole number from 1 to MAX_KEEP or null, kept in storage.json; anything else is refused with the fix", () => {
    const s = sandbox();
    for (const bad of [0, -1, 1.5, "3", MAX_KEEP + 1, Number.NaN, undefined]) {
      expect(() => s.storage.setKeep(bad)).toThrow(StorageError);
    }
    expect(() => s.storage.setKeep(0)).toThrow(/whole number from 1 to 100000, or leave it empty to keep every file/);
    expect(s.storage.setKeep(3).keep).toBe(3);
    expect(JSON.parse(fs.readFileSync(path.join(s.userData, STORAGE_SETTINGS_FILE), "utf8"))).toEqual({ keep: 3 });
    expect(s.storage.info().keep).toBe(3);
    expect(s.storage.setKeep(null).keep).toBeNull();
    expect(s.log()).toBe("2026-11-17T10:00:00.000Z retention set: keep the newest 3\n2026-11-17T10:00:00.000Z retention off: every file is kept\n");
  });

  it("an unreadable or out-of-range storage.json is off", () => {
    const s = sandbox();
    fs.mkdirSync(s.userData, { recursive: true });
    for (const text of ["{", '{"keep": 0}', '{"keep": "2"}', "null"]) {
      fs.writeFileSync(path.join(s.userData, STORAGE_SETTINGS_FILE), text);
      expect(s.storage.info().keep).toBeNull();
    }
  });

  it("setting N deletes nothing by itself", () => {
    const s = sandbox();
    s.markup("2026-11-01_a", 5);
    s.markup("2026-11-02_b", 4);
    s.storage.setKeep(1);
    expect(s.left()).toEqual(["2026-11-01_a", "2026-11-02_b"]);
  });
});

describe("storage folder: retention after a save", () => {
  it("deletes the oldest beyond N (markups and Collide files alike), oldest first, and logs each with the clock's time", () => {
    const s = sandbox();
    s.markup("2026-11-01_oldest", 9);
    s.collide("older.collide", 7);
    s.markup("2026-11-12_middle", 5);
    s.collide("newer.collide", 2);
    s.markup("2026-11-17_newest", 0);
    s.storage.setKeep(2);
    const r = s.storage.prune(["2026-11-17_newest"]);
    expect(r.deleted).toEqual(["2026-11-01_oldest", "older.collide", "2026-11-12_middle"]);
    expect(r.info).toEqual({ folder: s.root, items: 2, bytes: 142 + 50, keep: 2 });
    expect(s.left()).toEqual(["2026-11-17_newest", "newer.collide"]);
    expect(s.log()).toContain(
      [
        "2026-11-17T10:00:00.000Z deleted 2026-11-01_oldest (keep the newest 2)",
        "2026-11-17T10:00:00.000Z deleted older.collide (keep the newest 2)",
        "2026-11-17T10:00:00.000Z deleted 2026-11-12_middle (keep the newest 2)",
      ].join("\n"),
    );
    // A second save with nothing past N deletes nothing more.
    expect(s.storage.prune([]).deleted).toEqual([]);
  });

  it("orders by the last save (annotations.json), not by the folder's name", () => {
    const s = sandbox();
    s.markup("2026-11-01_resaved-today", 0);
    s.markup("2026-11-15_untouched", 2);
    s.storage.setKeep(1);
    expect(s.storage.prune([]).deleted).toEqual(["2026-11-15_untouched"]);
  });

  it("never deletes an open item, given by name or by full path, even the oldest", () => {
    const s = sandbox();
    const oldest = s.markup("2026-11-01_open-in-a-tab", 9);
    const file = s.collide("open.collide", 8);
    s.markup("2026-11-05_closed", 7);
    s.markup("2026-11-17_newest", 0);
    s.storage.setKeep(1);
    const r = s.storage.prune([oldest, path.basename(file), 42, null]);
    expect(r.deleted).toEqual(["2026-11-05_closed"]);
    expect(s.left()).toEqual(["2026-11-01_open-in-a-tab", "2026-11-17_newest", "open.collide"]);
  });

  it("path scope: a link in the folder is never followed or deleted, and nothing outside the folder is touched", () => {
    const s = sandbox();
    const outside = path.join(s.base, "outside");
    fs.mkdirSync(outside);
    for (const f of ["source.png", "annotations.json", "export.png"]) fs.writeFileSync(path.join(outside, f), "keep me");
    const outsideFile = path.join(s.base, "outside.collide");
    fs.writeFileSync(outsideFile, "keep me");
    s.markup("2026-11-17_newest", 0);
    fs.symlinkSync(outside, path.join(s.root, "2026-01-01_leads-out"), "dir");
    fs.symlinkSync(outsideFile, path.join(s.root, "leads-out.collide"), "file");
    s.storage.setKeep(1);
    // "Open" names that try to climb out change nothing either.
    expect(s.storage.prune(["../outside", "..", "/"]).deleted).toEqual([]);
    expect(fs.readdirSync(outside).sort()).toEqual(["annotations.json", "export.png", "source.png"]);
    expect(fs.readFileSync(outsideFile, "utf8")).toBe("keep me");
    for (const p of [...s.unlinked, ...s.removedDirs]) expect(p.startsWith(s.root + path.sep)).toBe(true);
  });

  it("a markup folder holding files Collide did not write is left whole: logged, and the rest go on", () => {
    const s = sandbox();
    const busy = s.markup("2026-11-01_with-extra", 9);
    fs.writeFileSync(path.join(busy, "someone-elses.txt"), "x");
    s.markup("2026-11-02_plain", 8);
    s.markup("2026-11-17_newest", 0);
    s.storage.setKeep(1);
    const r = s.storage.prune([]);
    expect(r.deleted).toEqual(["2026-11-02_plain"]);
    expect(fs.readdirSync(busy).sort()).toEqual(["annotations.json", "export.png", "someone-elses.txt", "source.png"]);
    expect(s.log()).toContain("not deleted 2026-11-01_with-extra: it holds someone-elses.txt, which Collide did not write");
    for (const p of [...s.unlinked, ...s.removedDirs]) expect(p.startsWith(s.root + path.sep)).toBe(true);
  });
});
