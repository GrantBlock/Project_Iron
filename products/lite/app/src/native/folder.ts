// Open a folder (L08): the main process lists the chosen folder and reads its files for the
// page, read only. Every path the page sends is checked here: relative, inside the chosen
// folder after resolving symlinks, a regular file, at most MAX_FILE_BYTES. Node's fs and path
// are passed in (main.cjs), so this is unit-tested with real temporary folders.

/** (A) Files larger than this are listed but not opened. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** (A) Listing limits, so a huge folder cannot stall the app. */
export const MAX_ENTRIES = 5000;
export const MAX_DEPTH = 12;

export type FileKind = "pdf" | "markdown" | "text" | "glb" | "other";

export interface FolderEntry {
  /** Relative to the chosen folder, "/"-separated, e.g. "drawings/frame.glb". */
  readonly path: string;
  readonly name: string;
  readonly kind: "folder" | FileKind;
  /** Bytes (files only). */
  readonly size?: number;
}

export interface FolderListing {
  /** The chosen folder's own name. */
  readonly name: string;
  /** Folders and files, parents before children; within a folder: folders first, then files, by name. */
  readonly entries: readonly FolderEntry[];
  /** True when the limits cut the listing short. */
  readonly truncated: boolean;
}

/** What a stat tells: kind, size and identity (device and inode). */
export interface StatLike {
  isFile(): boolean;
  size: number;
  dev: number;
  ino: number;
}

/** The part of a `node:fs/promises` FileHandle used here. */
export interface FileHandleLike {
  stat(): Promise<StatLike>;
  read(buffer: Uint8Array, offset: number, length: number, position: number | null): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

/** The part of `node:fs/promises` used here, plus the open flags (`fs.constants`). */
export interface FsLike {
  realpath(p: string): Promise<string>;
  lstat(p: string): Promise<{ isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean; size: number }>;
  stat(p: string): Promise<StatLike>;
  readdir(p: string): Promise<string[]>;
  open(p: string, flags: number): Promise<FileHandleLike>;
  /** O_RDONLY, and O_NOFOLLOW where the system has it (not on Windows). */
  readonly flags: { readonly readOnly: number; readonly noFollow?: number };
}

export interface ListLimits {
  readonly maxEntries: number;
  readonly maxDepth: number;
}

/** The part of `node:path` used here. */
export interface PathLike {
  sep: string;
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  relative(from: string, to: string): string;
  isAbsolute(p: string): boolean;
  basename(p: string): string;
}

/** What Lite does with a file, by its extension. */
export function fileKind(name: string): FileKind {
  const ext = /\.([^.]+)$/.exec(name.toLowerCase())?.[1] ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "txt") return "text";
  if (ext === "glb") return "glb";
  return "other";
}

/** True when `target` is `root` itself or inside it. */
export function isInside(root: string, target: string, path: PathLike): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Lists the folder (`root` must already be a real path). Symbolic links are skipped, so
 * nothing outside the folder is listed (A).
 */
export async function listFolder(root: string, fs: FsLike, path: PathLike, limits: ListLimits = { maxEntries: MAX_ENTRIES, maxDepth: MAX_DEPTH }): Promise<FolderListing> {
  const entries: FolderEntry[] = [];
  let truncated = false;
  const walk = async (dir: string, rel: string, depth: number) => {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return;
    }
    const folders: FolderEntry[] = [];
    const files: FolderEntry[] = [];
    for (const name of names) {
      // Stop as soon as the limit is reached, so a huge folder cannot stall the app.
      if (entries.length + folders.length + files.length >= limits.maxEntries) {
        truncated = true;
        break;
      }
      let st;
      try {
        st = await fs.lstat(path.join(dir, name));
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      const p = rel ? `${rel}/${name}` : name;
      if (st.isDirectory()) folders.push({ path: p, name, kind: "folder" });
      else if (st.isFile()) files.push({ path: p, name, kind: fileKind(name), size: st.size });
    }
    const byName = (a: FolderEntry, b: FolderEntry) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });
    folders.sort(byName);
    files.sort(byName);
    for (const f of folders) {
      if (entries.length >= limits.maxEntries) {
        truncated = true;
        return;
      }
      entries.push(f);
      // Too deep: the folder is listed, its contents are not.
      if (depth + 1 >= limits.maxDepth) truncated = true;
      else await walk(path.join(dir, f.name), f.path, depth + 1);
    }
    for (const f of files) {
      if (entries.length >= limits.maxEntries) {
        truncated = true;
        return;
      }
      entries.push(f);
    }
  };
  await walk(root, "", 0);
  return { name: path.basename(root), entries, truncated };
}

/** Why a read was refused (sent to the page as the error message). */
export class RefusedPath extends Error {}

/**
 * Reads a file of the chosen folder for the page. `rel` comes from the page and is checked:
 * a relative "/"-separated path with no "..", inside `root` after resolving symlinks, a
 * regular file, at most `maxBytes`. Never writes.
 */
export async function readInside(root: string, rel: unknown, fs: FsLike, path: PathLike, maxBytes = MAX_FILE_BYTES): Promise<Uint8Array> {
  if (typeof rel !== "string" || rel === "" || rel.length > 4096 || rel.includes("\0")) throw new RefusedPath("Not a file path");
  const parts = rel.split("/");
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.includes("\\") || parts.some((p) => p === "" || p === "." || p === "..")) {
    throw new RefusedPath("Not a path inside the opened folder");
  }
  const realRoot = await fs.realpath(root);
  const full = path.resolve(realRoot, ...parts);
  if (!isInside(realRoot, full, path)) throw new RefusedPath("Not a path inside the opened folder");
  let real: string;
  try {
    real = await fs.realpath(full);
  } catch {
    throw new RefusedPath("No such file in the opened folder");
  }
  if (!isInside(realRoot, real, path)) throw new RefusedPath("Not a path inside the opened folder");

  // Open once and check the open file itself, so a swap (file → symlink) or a file that grows
  // between the check and the read cannot get past the folder check or the size cap.
  let handle: FileHandleLike;
  try {
    handle = await fs.open(real, fs.flags.readOnly | (fs.flags.noFollow ?? 0));
  } catch {
    // O_NOFOLLOW refuses a path that became a symlink (ELOOP); a vanished file lands here too.
    throw new RefusedPath("Not a file inside the opened folder");
  }
  try {
    const st = await handle.stat();
    if (!st.isFile()) throw new RefusedPath("Not a file");
    // Where O_NOFOLLOW does not exist (Windows), and as a second check everywhere: the opened
    // file must still be the one at a path inside the folder.
    let now: string;
    try {
      now = await fs.realpath(real);
    } catch {
      throw new RefusedPath("Not a file inside the opened folder");
    }
    if (!isInside(realRoot, now, path)) throw new RefusedPath("Not a path inside the opened folder");
    const there = await fs.stat(now);
    if ((st.ino || there.ino) && (st.ino !== there.ino || st.dev !== there.dev)) throw new RefusedPath("Not a path inside the opened folder");
    if (st.size > maxBytes) throw new RefusedPath("The file is too large to open");
    // Read from the handle until the end, never more than maxBytes + 1 bytes: one more than the
    // cap means the file grew past it after the stat.
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const want = Math.min(Math.max(st.size - total, 64 * 1024), maxBytes + 1 - total);
      const chunk = new Uint8Array(want);
      const { bytesRead } = await handle.read(chunk, 0, want, total);
      if (bytesRead === 0) break;
      parts.push(bytesRead === want ? chunk : chunk.subarray(0, bytesRead));
      total += bytesRead;
      if (total > maxBytes) throw new RefusedPath("The file is too large to open");
    }
    if (parts.length === 1) return parts[0];
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  } finally {
    await handle.close();
  }
}
