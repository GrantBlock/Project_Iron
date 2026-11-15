// @vitest-environment node
// T16: markup storage in the main process, with a real temp folder, `path.win32` for the
// Windows cases and a fake folder dialog. Includes the lib.rs fs-scope test, ported.
// Runs in Node, as the main process does (so a Buffer is a Uint8Array here).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as io from "../io/markupStore";
import {
  createMarkups,
  FILE_ANNOTATIONS,
  FILE_EXPORT,
  FILE_SOURCE,
  isFolderName,
  isInside,
  MARKUPS_LABEL,
  MARKUPS_SEGMENTS,
  MarkupStoreError,
  markupsRoot,
  resolveInScope,
  type MarkupFs,
  type MarkupsDeps,
  type MarkupStoreErrorKind,
  type OpenFolderDialogOptions,
} from "./markups";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A temp folder with links followed (macOS's /tmp is a link), holding an empty `Documents`. */
function sandbox() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "collide-markups-")));
  made.push(base);
  const documents = path.join(base, "Documents");
  fs.mkdirSync(documents);
  return { base, documents, root: path.join(documents, "Collide", "Markups") };
}

type DialogResult = { canceled: boolean; filePaths: string[] };

function store(documents: string, overrides: Partial<MarkupsDeps> = {}) {
  const asked: OpenFolderDialogOptions[] = [];
  let answer: DialogResult = { canceled: true, filePaths: [] };
  const markups = createMarkups({
    fs,
    path,
    documents: () => documents,
    showOpenDialog: async (options) => {
      asked.push(options);
      return answer;
    },
    ...overrides,
  });
  return { markups, asked, pickAnswers: (a: DialogResult) => void (answer = a) };
}

const files = () => ({
  sourcePng: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]),
  annotations: '{\n  "version": 1\n}',
  exportPng: new Uint8Array([137, 80, 78, 71, 9, 9]),
});

/** The error a call throws (or rejects with), as its kind and message. */
async function failure(run: () => unknown): Promise<{ kind: MarkupStoreErrorKind; message: string }> {
  try {
    await run();
  } catch (e) {
    expect(e).toBeInstanceOf(MarkupStoreError);
    const err = e as MarkupStoreError;
    return { kind: err.kind, message: err.message };
  }
  throw new Error("expected a MarkupStoreError, but the call succeeded");
}

/** Every file and folder under `dir`, relative, sorted. */
function tree(dir: string): string[] {
  return (fs.readdirSync(dir, { recursive: true }) as string[]).map((p) => p.split(path.sep).join("/")).sort();
}

const OUTSIDE = (shown: string) => `${shown} is outside Documents/Collide/Markups. Pick a folder inside Documents/Collide/Markups.`;

describe("lib.rs tests, ported", () => {
  it("fs_capability_is_scoped_to_markups_folder", async () => {
    const { base, documents, root } = sandbox();
    // The Tauri capability file listed a scope per fs permission. Here the scope is the code,
    // so the test watches every fs call the store makes and checks the path it was given.
    const touched: [string, string][] = [];
    const watched = new Proxy(fs, {
      get(target, key: string) {
        const value = (target as unknown as Record<string, unknown>)[key];
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          touched.push([key, String(args[0])]);
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    }) as unknown as MarkupFs;
    const { markups, pickAnswers } = store(documents, { fs: watched });

    const saved = markups.save("2026-11-15_plan", files());
    markups.open(saved);
    markups.list();
    pickAnswers({ canceled: false, filePaths: [saved] });
    expect(await markups.pick()).toBe(saved);

    // Attempts to leave the folder, by every door.
    const secret = path.join(base, "secret");
    fs.mkdirSync(secret);
    fs.writeFileSync(path.join(secret, FILE_SOURCE), "private");
    fs.writeFileSync(path.join(secret, FILE_ANNOTATIONS), "{}");
    for (const target of [secret, path.join(root, "..", "..", "..", "secret"), "../../../secret", documents, base, path.parse(base).root]) {
      expect((await failure(() => markups.open(target))).kind, target).toBe("OutsideMarkups");
      pickAnswers({ canceled: false, filePaths: [target] });
      expect((await failure(() => markups.pick())).kind, target).toBe("OutsideMarkups");
    }
    for (const name of ["../../../secret", "..", secret, "a/b", "a\\b"]) {
      expect((await failure(() => markups.save(name, files()))).kind, name).toBe("InvalidFolderName");
    }

    const scopedOps = new Set<string>();
    for (const [op, target] of touched) {
      expect(isInside(path, root, target), `${op} escapes the markups folder: ${target}`).toBe(true);
      scopedOps.add(op);
    }
    // Rust asserted at least four scoped fs permissions (mkdir, write, read, read-dir).
    expect([...scopedOps]).toEqual(expect.arrayContaining(["mkdirSync", "writeFileSync", "readFileSync", "readdirSync"]));
    expect(scopedOps.size).toBeGreaterThanOrEqual(4);
    // Nothing was read from or written to the folder outside.
    expect(tree(secret)).toEqual([FILE_ANNOTATIONS, FILE_SOURCE]);
    expect(tree(documents)).toEqual(["Collide", "Collide/Markups", "Collide/Markups/2026-11-15_plan", ...[FILE_ANNOTATIONS, FILE_EXPORT, FILE_SOURCE].map((f) => `Collide/Markups/2026-11-15_plan/${f}`)]);
  });

  it("the scope is $DOCUMENT/Collide/Markups, with the same file names as before", () => {
    expect(MARKUPS_SEGMENTS.join("/")).toBe(io.MARKUPS_SUBPATH);
    expect(MARKUPS_LABEL).toBe(`Documents/${io.MARKUPS_SUBPATH}`);
    expect([FILE_SOURCE, FILE_ANNOTATIONS, FILE_EXPORT]).toEqual([io.FILE_SOURCE, io.FILE_ANNOTATIONS, io.FILE_EXPORT]);
    expect(markupsRoot(path.posix, "/home/g/Documents")).toBe("/home/g/Documents/Collide/Markups");
    expect(markupsRoot(path.win32, "C:\\Users\\g\\Documents")).toBe("C:\\Users\\g\\Documents\\Collide\\Markups");
  });

  it("the shell hands over the real Documents folder and touches no file itself", () => {
    const main = fs.readFileSync(path.resolve(process.cwd(), "electron/main.cjs"), "utf8");
    expect(main).toContain('documents: () => app.getPath("documents")');
    expect(main).toContain("native.createMarkups({");
    // `fs` is only passed on to src/native (settings.ts, markups.ts); main.cjs calls none of its functions.
    expect(main).not.toMatch(/\bfs\s*\.\s*\w+/);
    // The preload has no file access at all: it can only require "electron".
    const preload = fs.readFileSync(path.resolve(process.cwd(), "electron/preload.cjs"), "utf8");
    expect(preload).not.toMatch(/node:fs|require\("fs"\)/);
  });
});

describe("resolveInScope", () => {
  const P = path.posix;
  const ROOT = "/home/g/Documents/Collide/Markups";
  const W = path.win32;
  const WROOT = "C:\\Users\\g\\Documents\\Collide\\Markups";
  const refused = (p: typeof P, root: string, target: string) => {
    try {
      resolveInScope(p, root, target);
    } catch (e) {
      expect(e).toBeInstanceOf(MarkupStoreError);
      expect((e as MarkupStoreError).kind).toBe("OutsideMarkups");
      expect((e as MarkupStoreError).message).toBe(OUTSIDE(target));
      return true;
    }
    return false;
  };

  it("accepts the folder itself and anything below it, absolute or relative to it", () => {
    expect(resolveInScope(P, ROOT, ROOT)).toBe(ROOT);
    expect(resolveInScope(P, ROOT, `${ROOT}/`)).toBe(ROOT);
    expect(resolveInScope(P, ROOT, `${ROOT}/2026-11-15_plan`)).toBe(`${ROOT}/2026-11-15_plan`);
    expect(resolveInScope(P, ROOT, `${ROOT}/a/b/source.png`)).toBe(`${ROOT}/a/b/source.png`);
    expect(resolveInScope(P, ROOT, "2026-11-15_plan")).toBe(`${ROOT}/2026-11-15_plan`);
    // `..` that stays inside is fine once resolved; a name that only starts with dots is a name.
    expect(resolveInScope(P, ROOT, `${ROOT}/a/../b`)).toBe(`${ROOT}/b`);
    expect(resolveInScope(P, ROOT, `${ROOT}/..hidden`)).toBe(`${ROOT}/..hidden`);
    expect(resolveInScope(P, ROOT, `${ROOT}/My markup (2) é`)).toBe(`${ROOT}/My markup (2) é`);
  });

  it("refuses traversal out of the folder", () => {
    for (const target of [
      "..",
      "../Markups-other",
      "../../../.ssh/id_rsa",
      "a/../../x",
      `${ROOT}/..`,
      `${ROOT}/../..`,
      `${ROOT}/../Markups2/x`,
      `${ROOT}/a/../../../../../../etc/passwd`,
      `${ROOT}/./../x`,
      `${ROOT}//..//x`,
    ]) {
      expect(refused(P, ROOT, target), target).toBe(true);
    }
  });

  it("refuses absolute paths outside (no links involved)", () => {
    for (const target of ["/", "/etc/passwd", "/home/g", "/home/g/Documents", "/home/g/Documents/Collide", "/home/g/Documents/Collide/Markups2", "/home/g/Documents/Collide/Markups-old/x", "/home/g/documents/collide/markups/x", "/tmp/Collide/Markups/x"]) {
      expect(refused(P, ROOT, target), target).toBe(true);
    }
  });

  it("refuses control characters, which no real folder name holds", () => {
    for (const target of [`${ROOT}/a\u0000`, `${ROOT}/a\u0000/../../../etc`, `${ROOT}/a\nb`]) expect(refused(P, ROOT, target), JSON.stringify(target)).toBe(true);
  });

  it("Windows: accepts paths in the folder, whatever the case or slashes", () => {
    expect(resolveInScope(W, WROOT, `${WROOT}\\2026-11-15_plan`)).toBe(`${WROOT}\\2026-11-15_plan`);
    expect(resolveInScope(W, WROOT, "c:\\users\\G\\documents\\collide\\MARKUPS\\Plan")).toBe("c:\\users\\G\\documents\\collide\\MARKUPS\\Plan");
    expect(resolveInScope(W, WROOT, "C:/Users/g/Documents/Collide/Markups/plan/source.png")).toBe(`${WROOT}\\plan\\source.png`);
    expect(resolveInScope(W, WROOT, `${WROOT}\\`)).toBe(WROOT);
    expect(resolveInScope(W, WROOT, "plan")).toBe(`${WROOT}\\plan`);
    expect(resolveInScope(W, WROOT, `${WROOT}\\My markup (2) é.v2`)).toBe(`${WROOT}\\My markup (2) é.v2`);
    // A Documents folder moved to another drive or a network share.
    expect(resolveInScope(W, "D:\\Docs\\Collide\\Markups", "D:\\Docs\\Collide\\Markups\\x")).toBe("D:\\Docs\\Collide\\Markups\\x");
    const unc = "\\\\server\\home\\g\\Documents\\Collide\\Markups";
    expect(resolveInScope(W, unc, `${unc}\\x`)).toBe(`${unc}\\x`);
  });

  it("Windows: refuses traversal, other drives, rooted and UNC paths", () => {
    for (const target of [
      "..\\..\\..\\AppData",
      `${WROOT}\\..`,
      `${WROOT}\\..\\Markups2\\x`,
      `${WROOT}\\a\\..\\..\\..\\..\\..\\Windows\\System32`,
      "C:/Users/g/Documents/Collide/Markups/../../secret",
      `${WROOT}2`,
      "C:\\Users\\g\\Documents\\Collide",
      "C:\\Windows\\System32\\config",
      "C:\\",
      "D:\\Users\\g\\Documents\\Collide\\Markups\\x", // the same path on another drive
      "D:x", // relative to drive D's current folder
      "D:",
      "\\Windows", // rooted, no drive
      "/Windows",
      "\\\\server\\share\\x",
      "//server/share/x",
      "\\\\?\\C:\\Users\\g\\Documents\\Collide\\Markups\\x", // long-path form: not resolved, so not trusted
      "\\\\.\\C:\\Users\\g\\Documents\\Collide\\Markups\\x",
      "\\\\.\\PhysicalDrive0",
    ]) {
      expect(refused(W, WROOT, target), target).toBe(true);
    }
    // A network Documents folder does not open the rest of the share or another server.
    const unc = "\\\\server\\home\\g\\Documents\\Collide\\Markups";
    for (const target of ["\\\\server\\home\\other", "\\\\server\\other\\g\\Documents\\Collide\\Markups\\x", "\\\\elsewhere\\home\\g\\Documents\\Collide\\Markups\\x", "C:\\x"]) {
      expect(refused(W, unc, target), target).toBe(true);
    }
  });

  it("Windows: refuses names Windows would read as something else", () => {
    for (const target of [
      `${WROOT}\\.. \\..\\x`, // Windows drops the trailing space: `..`
      `${WROOT}\\..  `,
      `${WROOT}\\...\\x`,
      `${WROOT}\\plan.`,
      `${WROOT}\\plan `,
      `${WROOT}\\plan\\source.png:hidden`, // alternate data stream
      `${WROOT}\\plan:stream`,
      `${WROOT}\\NUL`, // devices
      `${WROOT}\\con`,
      `${WROOT}\\COM1.txt`,
      `${WROOT}\\plan\\LPT9`,
      `${WROOT}\\a*b`,
      `${WROOT}\\a?b`,
      `${WROOT}\\a<b>`,
      `${WROOT}\\a|b`,
      `${WROOT}\\"a"`,
    ]) {
      expect(refused(W, WROOT, target), target).toBe(true);
    }
    // The same names are ordinary ones elsewhere.
    expect(resolveInScope(P, ROOT, `${ROOT}/plan.`)).toBe(`${ROOT}/plan.`);
    expect(resolveInScope(P, ROOT, `${ROOT}/a:b`)).toBe(`${ROOT}/a:b`);
    // And names that only resemble a device are fine on Windows.
    expect(resolveInScope(W, WROOT, `${WROOT}\\console`)).toBe(`${WROOT}\\console`);
    expect(resolveInScope(W, WROOT, `${WROOT}\\2026-11-15_nul`)).toBe(`${WROOT}\\2026-11-15_nul`);
  });

  it("isFolderName: one plain name only", () => {
    for (const name of ["2026-11-15_plan", "My markup (2) é", "..hidden", "a.b"]) {
      expect(isFolderName(P, name), name).toBe(true);
      expect(isFolderName(W, name), name).toBe(true);
    }
    for (const name of ["", ".", "..", "a/b", "a\\b", "/abs", "C:\\abs", "../up", "a\u0000", undefined, null, 7, {}, ["a"]]) {
      expect(isFolderName(P, name), String(name)).toBe(false);
      expect(isFolderName(W, name), String(name)).toBe(false);
    }
    for (const name of ["plan.", "plan ", "a:b", "NUL", "aux.png", "a*b"]) {
      expect(isFolderName(W, name), name).toBe(false);
      expect(isFolderName(P, name), name).toBe(true);
    }
  });
});

describe("createMarkups: save, open, list", () => {
  it("save writes source.png, annotations.json and export.png into Documents/Collide/Markups/<name>; open reads them back identical", () => {
    const { documents, root } = sandbox();
    const { markups } = store(documents);
    const input = files();
    const dir = markups.save("2026-11-15_plan", input);
    expect(dir).toBe(path.join(root, "2026-11-15_plan"));
    expect(tree(dir)).toEqual(["annotations.json", "export.png", "source.png"]);
    expect([...fs.readFileSync(path.join(dir, "source.png"))]).toEqual([...input.sourcePng]);
    expect(fs.readFileSync(path.join(dir, "annotations.json"), "utf8")).toBe(input.annotations);
    expect([...fs.readFileSync(path.join(dir, "export.png"))]).toEqual([...input.exportPng]);

    const opened = markups.open(dir);
    expect(Object.keys(opened).sort()).toEqual(["annotations", "sourcePng"]);
    expect(opened.sourcePng).toBeInstanceOf(Uint8Array);
    expect([...opened.sourcePng]).toEqual([...input.sourcePng]);
    expect(opened.annotations).toBe(input.annotations);
    // A folder name alone means the folder of that name inside Markups.
    expect([...markups.open("2026-11-15_plan").sourcePng]).toEqual([...input.sourcePng]);
  });

  it("saving again to the same name replaces the files; export.png is not needed to open", () => {
    const { documents } = sandbox();
    const { markups } = store(documents);
    const dir = markups.save("m", files());
    expect(markups.save("m", { ...files(), annotations: '{"version":2}', sourcePng: new Uint8Array([5]) })).toBe(dir);
    fs.rmSync(path.join(dir, "export.png"));
    expect(markups.open(dir)).toMatchObject({ annotations: '{"version":2}' });
    expect([...markups.open(dir).sourcePng]).toEqual([5]);
  });

  it("list: the folders directly inside Markups, as full paths; empty before the first save", () => {
    const { documents, root } = sandbox();
    const { markups } = store(documents);
    expect(markups.list()).toEqual([]);
    expect(fs.existsSync(path.join(documents, "Collide"))).toBe(false); // listing creates nothing
    markups.save("b", files());
    markups.save("a", files());
    fs.writeFileSync(path.join(root, "notes.txt"), "not a markup");
    expect(markups.list().sort()).toEqual([path.join(root, "a"), path.join(root, "b")]);
  });

  it("opening a folder without the files names the cause and the fix (the text the Tauri store showed)", async () => {
    const { documents, root } = sandbox();
    const { markups } = store(documents);
    const missing = path.join(root, "nope");
    const none = await failure(() => markups.open(missing));
    expect(none.kind).toBe("ReadFailed");
    expect(none.message).toMatch(new RegExp(`^${missing.replace(/[\\.]/g, "\\$&")} is missing source\\.png or annotations\\.json \\(ENOENT.*\\)\\. Pick a folder created by Save\\.$`));
    // The Markups folder itself is inside the scope (as in the Tauri capability), but it is not a markup.
    fs.mkdirSync(root, { recursive: true });
    expect((await failure(() => markups.open(root))).kind).toBe("ReadFailed");
    for (const folder of [undefined, null, "", 7, { path: missing }, [missing]]) {
      expect(await failure(() => markups.open(folder))).toEqual({ kind: "InvalidFolder", message: "No markup folder was given. Pick a folder created by Save." });
    }
  });

  it("a failed write names the folder, the cause and the fix (the text the Tauri store showed)", async () => {
    const { documents, root } = sandbox();
    const { markups } = store(documents);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "taken"), "a file where the folder should go");
    const err = await failure(() => markups.save("taken", files()));
    expect(err.kind).toBe("WriteFailed");
    expect(err.message.startsWith(`Writing ${path.join(root, "taken")} failed (`)).toBe(true);
    expect(err.message.endsWith("). Check that Documents/Collide/Markups is writable and has free space, then save again.")).toBe(true);
  });

  it("save refuses anything that is not one folder name and three files, and writes nothing", async () => {
    const { base, documents } = sandbox();
    const { markups } = store(documents);
    for (const name of ["", ".", "..", "../escape", "../../escape", "a/b", "a\\b", path.join(base, "escape"), "C:\\escape", "\\\\server\\share", "x\u0000", undefined, 7, null]) {
      const err = await failure(() => markups.save(name, files()));
      expect(err.kind, String(name)).toBe("InvalidFolderName");
      expect(err.message).toBe(`"${String(name)}" cannot be used as a markup folder name: it must be one folder name inside Documents/Collide/Markups. Open the image again, then save.`);
    }
    const good = files();
    for (const bad of [undefined, null, "files", {}, { ...good, sourcePng: [1, 2] }, { ...good, sourcePng: "iVBOR" }, { ...good, annotations: { version: 1 } }, { ...good, exportPng: undefined }, { ...good, exportPng: new Uint16Array(2) }]) {
      expect(await failure(() => markups.save("ok", bad))).toEqual({
        kind: "InvalidFiles",
        message: "The markup to save is incomplete: source.png, annotations.json or export.png is missing. Save again.",
      });
    }
    expect(tree(base)).toEqual(["Documents"]);
  });

  it("no Documents folder: a typed error with the fix, and no file access", async () => {
    const calls: string[] = [];
    const noFs = new Proxy({}, { get: (_t, key: string) => () => void calls.push(key) }) as unknown as MarkupFs;
    const deps = (documents: () => string) => ({ fs: noFs, documents });
    for (const documents of ["", "Documents", "./Documents", "../up"]) {
      const { markups } = store(documents, deps(() => documents));
      for (const run of [() => markups.save("a", files()), () => markups.open("a"), () => markups.list(), () => markups.pick()]) {
        const err = await failure(run);
        expect(err.kind, documents).toBe("NoDocumentsFolder");
        expect(err.message).toBe(`Collide could not find your Documents folder (got ${JSON.stringify(documents)}). Check that it exists, then restart Collide.`);
      }
    }
    const { markups } = store("", deps(() => {
      throw new Error("Failed to get 'documents' path");
    }));
    expect(await failure(() => markups.list())).toEqual({
      kind: "NoDocumentsFolder",
      message: "Collide could not find your Documents folder (Failed to get 'documents' path). Check that it exists, then restart Collide.",
    });
    expect(calls).toEqual([]);
  });

  it("the Documents folder is asked for on every call", () => {
    const first = sandbox();
    const second = sandbox();
    let documents = first.documents;
    const { markups } = store("", { documents: () => documents });
    markups.save("one", files());
    documents = second.documents;
    markups.save("two", files());
    expect(markups.list()).toEqual([path.join(second.root, "two")]);
    expect(tree(first.root)).toContain("one");
    // A folder of the first Documents is now outside.
    expect(() => markups.open(path.join(first.root, "one"))).toThrow(MarkupStoreError);
  });
});

describe("createMarkups: pick", () => {
  it("shows the folder dialog starting in Markups (created if missing) and returns the chosen folder", async () => {
    const { documents, root } = sandbox();
    const { markups, asked, pickAnswers } = store(documents);
    expect(fs.existsSync(root)).toBe(false);
    expect(await markups.pick()).toBeNull(); // cancelled
    expect(asked).toEqual([{ title: "Open markup folder", defaultPath: root, properties: ["openDirectory"] }]);
    expect(fs.statSync(root).isDirectory()).toBe(true);

    const dir = markups.save("2026-11-15_plan", files());
    pickAnswers({ canceled: false, filePaths: [dir] });
    expect(await markups.pick()).toBe(dir);
    pickAnswers({ canceled: false, filePaths: [dir + path.sep] });
    expect(await markups.pick()).toBe(dir);
    pickAnswers({ canceled: false, filePaths: [] });
    expect(await markups.pick()).toBeNull();
    pickAnswers({ canceled: true, filePaths: [dir] });
    expect(await markups.pick()).toBeNull();
    pickAnswers(undefined as unknown as DialogResult);
    expect(await markups.pick()).toBeNull();
    expect(asked).toHaveLength(6);
  });

  it("refuses a folder picked outside Markups, even one that holds a markup", async () => {
    const { base, documents, root } = sandbox();
    const { markups, pickAnswers } = store(documents);
    const inside = markups.save("plan", files());
    const outside = path.join(base, "Desktop", "plan");
    fs.cpSync(inside, outside, { recursive: true });
    for (const target of [outside, base, documents, path.join(documents, "Collide"), `${root}-old`, path.join(root, "..", "..", "..", "Desktop", "plan")]) {
      pickAnswers({ canceled: false, filePaths: [target] });
      expect(await failure(() => markups.pick()), target).toEqual({ kind: "OutsideMarkups", message: OUTSIDE(target) });
      expect(await failure(() => markups.open(target)), target).toEqual({ kind: "OutsideMarkups", message: OUTSIDE(target) });
    }
    // The Markups folder itself can be picked (the dialog starts there); opening it says it is not a markup.
    pickAnswers({ canceled: false, filePaths: [root] });
    expect(await markups.pick()).toBe(root);
    expect((await failure(() => markups.open(root))).kind).toBe("ReadFailed");
  });

  it("a failed dialog rejects; a Markups folder that cannot be created does not stop the dialog", async () => {
    const { documents } = sandbox();
    fs.writeFileSync(path.join(documents, "Collide"), "a file in the way");
    const { markups, asked } = store(documents);
    expect(await markups.pick()).toBeNull();
    expect(asked).toHaveLength(1);
    const broken = store(documents, {
      showOpenDialog: async () => {
        throw new Error("dialog failed");
      },
    });
    await expect(broken.markups.pick()).rejects.toThrow("dialog failed");
  });
});

/** Links need a privilege on Windows; a junction (folders only) does not. */
function link(target: string, at: string, kind: "dir" | "file"): boolean {
  try {
    fs.symlinkSync(target, at, kind === "dir" ? "junction" : "file");
    return true;
  } catch {
    return false;
  }
}

describe("createMarkups: links inside Markups must not lead out of it", () => {
  it("a linked folder pointing outside is refused for open, save and pick; nothing outside is read or written", async () => {
    const { base, documents, root } = sandbox();
    const { markups, pickAnswers } = store(documents);
    const real = markups.save("real", files());
    const outside = path.join(base, "outside");
    fs.cpSync(real, outside, { recursive: true });
    const before = tree(outside).map((f) => fs.readFileSync(path.join(outside, f), "utf8"));
    const door = path.join(root, "door");
    if (!link(outside, door, "dir")) return; // links are not available here
    expect(fs.readFileSync(path.join(door, "annotations.json"), "utf8")).toBe(files().annotations); // the link works

    expect(await failure(() => markups.open(door))).toEqual({ kind: "OutsideMarkups", message: OUTSIDE(door) });
    expect((await failure(() => markups.open(path.join(door, "sub")))).kind).toBe("OutsideMarkups");
    pickAnswers({ canceled: false, filePaths: [door] });
    expect((await failure(() => markups.pick())).kind).toBe("OutsideMarkups");
    expect(await failure(() => markups.save("door", { ...files(), annotations: "overwritten" }))).toEqual({ kind: "OutsideMarkups", message: OUTSIDE("door") });
    expect(tree(outside).map((f) => fs.readFileSync(path.join(outside, f), "utf8"))).toEqual(before);

    // A link that stays inside Markups is fine.
    const alias = path.join(root, "alias");
    expect(link(real, alias, "dir")).toBe(true);
    expect(markups.open(alias).annotations).toBe(files().annotations);
  });

  it("a linked file pointing outside is refused, also when its target does not exist yet", async () => {
    const { base, documents } = sandbox();
    const { markups } = store(documents);
    const dir = markups.save("m", files());
    const secret = path.join(base, "secret.txt");
    fs.writeFileSync(secret, "private");
    fs.rmSync(path.join(dir, "source.png"));
    if (!link(secret, path.join(dir, "source.png"), "file")) return; // links are not available here

    expect((await failure(() => markups.open(dir))).kind).toBe("OutsideMarkups");
    expect((await failure(() => markups.save("m", files()))).kind).toBe("OutsideMarkups");
    expect(fs.readFileSync(secret, "utf8")).toBe("private");

    // A link to nowhere: writing through it would create the file outside.
    const created = path.join(base, "created.png");
    fs.rmSync(path.join(dir, "export.png"));
    fs.rmSync(path.join(dir, "source.png"));
    fs.writeFileSync(path.join(dir, "source.png"), files().sourcePng);
    expect(link(created, path.join(dir, "export.png"), "file")).toBe(true);
    expect((await failure(() => markups.save("m", files()))).kind).toBe("OutsideMarkups");
    expect(fs.existsSync(created)).toBe(false);
  });

  it("a Documents folder that is itself reached through a link still works", () => {
    const { base, documents } = sandbox();
    const viaLink = path.join(base, "DocsLink");
    if (!link(documents, viaLink, "dir")) return; // links are not available here
    const { markups } = store(viaLink);
    const dir = markups.save("plan", files());
    expect(dir).toBe(path.join(viaLink, "Collide", "Markups", "plan"));
    expect(markups.open(dir).annotations).toBe(files().annotations);
    expect(markups.list()).toEqual([dir]);
    expect(tree(documents)).toContain("Collide/Markups/plan/source.png");
  });
});
