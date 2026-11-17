import * as fsp from "node:fs/promises";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileKind, isInside, listFolder, readInside, RefusedPath, type FsLike } from "./folder";

const fs: FsLike = {
  realpath: (p) => fsp.realpath(p),
  lstat: (p) => fsp.lstat(p),
  readdir: (p) => fsp.readdir(p),
  readFile: (p) => fsp.readFile(p),
};

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

describe("isInside", () => {
  it("compares resolved paths", () => {
    expect(isInside("/a/b", "/a/b", path)).toBe(true);
    expect(isInside("/a/b", "/a/b/c", path)).toBe(true);
    expect(isInside("/a/b", "/a/bc", path)).toBe(false);
    expect(isInside("/a/b", "/a", path)).toBe(false);
  });
});
