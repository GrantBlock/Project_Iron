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

/** The part of `node:fs/promises` used here. */
export interface FsLike {
  realpath(p: string): Promise<string>;
  lstat(p: string): Promise<{ isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean; size: number }>;
  readdir(p: string): Promise<string[]>;
  readFile(p: string): Promise<Uint8Array>;
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
export async function listFolder(root: string, fs: FsLike, path: PathLike): Promise<FolderListing> {
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
      if (entries.length >= MAX_ENTRIES || depth >= MAX_DEPTH) {
        truncated = true;
        return;
      }
      entries.push(f);
      await walk(path.join(dir, f.name), f.path, depth + 1);
    }
    for (const f of files) {
      if (entries.length >= MAX_ENTRIES) {
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
  const st = await fs.lstat(real);
  if (!st.isFile()) throw new RefusedPath("Not a file");
  if (st.size > maxBytes) throw new RefusedPath("The file is too large to open");
  return fs.readFile(real);
}
