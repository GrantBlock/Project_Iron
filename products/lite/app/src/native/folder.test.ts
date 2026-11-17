import * as fsp from "node:fs/promises";
import { appendFileSync, constants, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileKind, isInside, listFolder, readInside, RefusedPath, type FileHandleLike, type FsLike } from "./folder";

// As electron/main.cjs passes it.
const fs: FsLike = {
  realpath: (p) => fsp.realpath(p),
  lstat: (p) => fsp.lstat(p),
  stat: (p) => fsp.stat(p),
  readdir: (p) => fsp.readdir(p),
  open: (p, flags) => fsp.open(p, flags),
  flags: { readOnly: constants.O_RDONLY, noFollow: constants.O_NOFOLLOW },
};
/** As on Windows: no O_NOFOLLOW. */
const fsWindowsLike: FsLike = { ...fs, flags: { readOnly: constants.O_RDONLY } };

let base = "";
let root = "";
beforeEach(() => {
  base = realpathSync(mkdtempSync(path.join(tmpdir(), "lite-folder-")));
  root = path.join(base, "Package A");
  mkdirSync(path.join(root, "drawings", "old"), { recursive: true });
  writeFileSync(path.join(root, "report.pdf"), "%PDF-1.4");
  writeFileSync(path.join(root, "Guide.md"), "# Guide");
  writeFileSync(path.join(root, "log.txt"), "log");
  writeFileSync(path.join(root, "data.bin"), "x");
  writeFileSync(path.join(root, "drawings", "frame.GLB"), "glb");
  writeFileSync(path.join(root, "drawings", "old", "a.txt"), "a");
  writeFileSync(path.join(base, "secret.txt"), "outside");
  symlinkSync(path.join(base, "secret.txt"), path.join(root, "link.txt"));
  symlinkSync(base, path.join(root, "up"));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("fileKind", () => {
  it("by extension, any case", () => {
    expect(["a.pdf", "b.MD", "c.markdown", "d.txt", "e.glb", "f.step", "noext"].map(fileKind)).toEqual(["pdf", "markdown", "markdown", "text", "glb", "other", "other"]);
  });
});

describe("listFolder", () => {
  it("lists folders first, then files, by name; skips symbolic links", async () => {
    const listing = await listFolder(root, fs, path);
    expect(listing.name).toBe("Package A");
    expect(listing.truncated).toBe(false);
    expect(listing.entries.map((e) => `${e.kind} ${e.path}${e.size !== undefined ? ` ${e.size}` : ""}`)).toEqual([
      "folder drawings",
      "folder drawings/old",
      "text drawings/old/a.txt 1",
      "glb drawings/frame.GLB 3",
      "other data.bin 1",
      "markdown Guide.md 7",
      "text log.txt 3",
      "pdf report.pdf 8",
    ]);
  });
});

describe("readInside", () => {
  it("reads a file inside the folder", async () => {
    expect(Buffer.from(await readInside(root, "drawings/old/a.txt", fs, path)).toString()).toBe("a");
  });

  it("refuses paths that leave the folder or are not plain relative paths", async () => {
    for (const bad of ["../secret.txt", "drawings/../../secret.txt", "/etc/hostname", "C:/x", "a\\b", "", "./log.txt", "drawings//old", "x\0y", 42, null]) {
      await expect(readInside(root, bad, fs, path), String(bad)).rejects.toBeInstanceOf(RefusedPath);
    }
  });

  it("refuses symbolic links that point outside (no symlink escape)", async () => {
    await expect(readInside(root, "link.txt", fs, path)).rejects.toThrow("Not a path inside the opened folder");
    await expect(readInside(root, "up/secret.txt", fs, path)).rejects.toThrow("Not a path inside the opened folder");
  });

  it("refuses folders, missing files and files over the size cap", async () => {
    await expect(readInside(root, "drawings", fs, path)).rejects.toThrow("Not a file");
    await expect(readInside(root, "nope.txt", fs, path)).rejects.toThrow("No such file");
    await expect(readInside(root, "log.txt", fs, path, 2)).rejects.toThrow("too large");
  });

  it("never writes: the folder is unchanged after reads", async () => {
    const before = await listFolder(root, fs, path);
    await readInside(root, "log.txt", fs, path);
    await readInside(root, "../secret.txt", fs, path).catch(() => undefined);
    expect(await listFolder(root, fs, path)).toEqual(before);
  });
});

describe("readInside: no race between the check and the read", () => {
  /** An fs whose open() first runs `before` (the attacker's move between check and read). */
  const racing = (base: FsLike, before: (p: string) => void): FsLike => ({
    ...base,
    open: async (p, flags) => {
      before(p);
      return base.open(p, flags);
    },
  });
  const swapToOutsideLink = (p: string) => {
    unlinkSync(p);
    symlinkSync(path.join(base, "secret.txt"), p);
  };

  it("a file swapped for a symlink to outside after the check is refused (O_NOFOLLOW)", async () => {
    expect(constants.O_NOFOLLOW).toBeDefined();
    await expect(readInside(root, "log.txt", racing(fs, swapToOutsideLink), path)).rejects.toBeInstanceOf(RefusedPath);
  });

  it("the same swap is refused without O_NOFOLLOW (Windows): re-checked after opening", async () => {
    await expect(readInside(root, "log.txt", racing(fsWindowsLike, swapToOutsideLink), path)).rejects.toThrow("Not a path inside the opened folder");
  });

  it("a file that grew past the cap before it was opened is refused (the open file is checked)", async () => {
    const grow = (p: string) => appendFileSync(p, "x".repeat(100));
    await expect(readInside(root, "log.txt", racing(fs, grow), path, 50)).rejects.toThrow("too large");
  });

  it("a file that grows after the stat is refused: at most cap + 1 bytes are read", async () => {
    const reads: number[] = [];
    const lying: FsLike = {
      ...fs,
      open: async (p, flags) => {
        const h = await fs.open(p, flags);
        const wrapped: FileHandleLike = {
          // The stat sees the old size (3 bytes); the file is then much larger.
          stat: async () => {
            const st = await h.stat();
            appendFileSync(p, "y".repeat(500));
            return { isFile: () => st.isFile(), size: st.size, dev: st.dev, ino: st.ino };
          },
          read: async (buffer, offset, length, position) => {
            reads.push(length);
            return h.read(buffer, offset, length, position);
          },
          close: () => h.close(),
        };
        return wrapped;
      },
    };
    await expect(readInside(root, "log.txt", lying, path, 50)).rejects.toThrow("too large");
    expect(reads.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(51);
  });

  it("a file that grew but stays under the cap is read whole", async () => {
    const grow = (p: string) => appendFileSync(p, "-more");
    expect(Buffer.from(await readInside(root, "log.txt", racing(fs, grow), path)).toString()).toBe("log-more");
  });

  it("the file handle is always closed", async () => {
    let open = 0;
    const counting: FsLike = {
      ...fs,
      open: async (p, flags) => {
        const h = await fs.open(p, flags);
        open++;
        return { stat: () => h.stat(), read: (b, o, l, pos) => h.read(b, o, l, pos), close: async () => (open--, h.close()) };
      },
    };
    await readInside(root, "log.txt", counting, path);
    await readInside(root, "log.txt", counting, path, 1).catch(() => undefined);
    await readInside(root, "drawings", counting, path).catch(() => undefined);
    expect(open).toBe(0);
  });
});

describe("listFolder limits", () => {
  it("stops at the entry limit and says it was truncated", async () => {
    for (let i = 0; i < 30; i++) writeFileSync(path.join(root, `many-${i}.txt`), "");
    const listing = await listFolder(root, fs, path, { maxEntries: 5, maxDepth: 12 });
    expect(listing.entries).toHaveLength(5);
    expect(listing.truncated).toBe(true);
    let lstats = 0;
    const counting: FsLike = { ...fs, lstat: (p) => (lstats++, fs.lstat(p)) };
    await listFolder(root, counting, path, { maxEntries: 3, maxDepth: 12 });
    // Stops looking at entries once the limit is reached, instead of stat-ing all 38.
    expect(lstats).toBeLessThan(10);
  });

  it("stops at the depth limit", async () => {
    const listing = await listFolder(root, fs, path, { maxEntries: 100, maxDepth: 2 });
    const paths = listing.entries.map((e) => e.path);
    // Depth 2: drawings and its files and sub-folder are listed; the sub-folder's contents are not.
    expect(paths).toContain("drawings/frame.GLB");
    expect(paths).toContain("drawings/old");
    expect(paths).not.toContain("drawings/old/a.txt");
    expect(listing.truncated).toBe(true);
    expect((await listFolder(root, fs, path, { maxEntries: 100, maxDepth: 3 })).truncated).toBe(false);
  });
});

describe("isInside", () => {
  it("compares resolved paths", () => {
    expect(isInside("/a/b", "/a/b", path)).toBe(true);
    expect(isInside("/a/b", "/a/b/c", path)).toBe(true);
    expect(isInside("/a/b", "/a/bc", path)).toBe(false);
    expect(isInside("/a/b", "/a", path)).toBe(false);
  });
});
