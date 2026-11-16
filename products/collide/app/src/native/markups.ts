// T16: markup folders on disk, in the main process. Replaces the Rust shell's fs and
// dialog plugins and the fs scope in its capabilities/default.json.
//
// Layout, as before: Documents/Collide/Markups/<folder>/{source.png, annotations.json, export.png}.
// Every path is resolved here and checked against the Markups folder before any file
// access; anything outside is refused with a `MarkupStoreError`.
// Nothing here imports Node or Electron: `fs`, `path`, the Documents folder and the
// folder dialog are passed in, so the tests run with a temp folder, `path.win32` and fakes.

import type { MarkupFiles, OpenedMarkupFiles } from "./bridge";

/** Under the Documents folder. The same folder as `MARKUPS_SUBPATH` in src/io/markupStore.ts. */
export const MARKUPS_SEGMENTS = ["Collide", "Markups"] as const;
/** How messages name the folder. */
export const MARKUPS_LABEL = "Documents/Collide/Markups";
export const FILE_SOURCE = "source.png";
export const FILE_ANNOTATIONS = "annotations.json";
export const FILE_EXPORT = "export.png";
export const PICK_TITLE = "Open markup folder";
/**
 * RUN3 T33: an added image's file beside source.png. The same rule as `IMAGE_FILE` in src/model/shapes.ts
 * (repeated so the main process does not load the page's model). No other name is ever read, written or deleted.
 */
export const IMAGE_FILE = /^image-[1-9][0-9]{0,5}\.png$/;

/** The image files annotations.json lists (`images[].file`); none for an older markup or unreadable text. */
export function listedImages(annotations: string): string[] {
  try {
    const doc = JSON.parse(annotations) as { images?: unknown };
    if (!Array.isArray(doc.images)) return [];
    const names = doc.images.map((i) => (i as { file?: unknown } | null)?.file).filter((f): f is string => typeof f === "string" && IMAGE_FILE.test(f));
    return [...new Set(names)];
  } catch {
    return [];
  }
}

/** The part of `node:path` used here (`path`, `path.win32` or `path.posix`). */
export interface MarkupPath {
  sep: string;
  resolve(...parts: string[]): string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  isAbsolute(p: string): boolean;
}

/** The part of `node:fs` used here. */
export interface MarkupFs {
  mkdirSync(dir: string, options: { recursive: true }): unknown;
  writeFileSync(file: string, data: Uint8Array | string): void;
  readFileSync(file: string): Uint8Array;
  readFileSync(file: string, encoding: "utf8"): string;
  readdirSync(dir: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  /** The path with every link followed; throws if it does not exist. */
  realpathSync(p: string): string;
  /** The entry itself (a link is not followed); throws if it does not exist. */
  lstatSync(p: string): { isSymbolicLink(): boolean };
  /** Delete one file. */
  unlinkSync(file: string): void;
  /** Delete an empty folder; throws if anything is left in it. */
  rmdirSync(dir: string): void;
}

export interface OpenFolderDialogOptions {
  title: string;
  defaultPath: string;
  properties: ["openDirectory"];
}

export interface MarkupsDeps {
  fs: MarkupFs;
  path: MarkupPath;
  /** Main process: `app.getPath("documents")`. Asked on every call. */
  documents: () => string;
  /** Main process: `dialog.showOpenDialog` on the editor window. */
  showOpenDialog: (options: OpenFolderDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
}

/** What the bridge's `markups.*` channels call. Arguments arrive from the page, so they are `unknown` until checked. */
export interface Markups {
  /** Write the three files into `<Markups>/<folderName>`. Returns the folder's path. */
  save(folderName: unknown, files: unknown): string;
  /** Read `source.png` and `annotations.json` from a folder inside Markups. */
  open(folder: unknown): OpenedMarkupFiles;
  /** Ask for a folder, starting in Markups. Null if cancelled; a folder outside Markups is refused. */
  pick(): Promise<string | null>;
  /** The folders directly inside Markups (full paths). */
  list(): string[];
  /**
   * Delete a markup for good (T31): the three files Save writes, then the folder.
   * Only a real folder directly inside Markups; nothing Collide did not write is ever deleted.
   */
  remove(folder: unknown): void;
}

export type MarkupStoreErrorKind =
  /** The path is not inside Documents/Collide/Markups. */
  | "OutsideMarkups"
  /** `save` was given something that is not a single folder name. */
  | "InvalidFolderName"
  /** `open` was given no folder. */
  | "InvalidFolder"
  /** `save` was given something other than the three files. */
  | "InvalidFiles"
  /** The Documents folder could not be found. */
  | "NoDocumentsFolder"
  | "WriteFailed"
  | "ReadFailed"
  /** `remove` was given something that is not a markup's own folder (Markups itself, a deeper path, a link). */
  | "NotMarkupFolder"
  | "DeleteFailed";

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

function storeMessage(kind: MarkupStoreErrorKind, detail: string, cause: string): string {
  switch (kind) {
    case "OutsideMarkups":
      return `${detail} is outside ${MARKUPS_LABEL}. Pick a folder inside ${MARKUPS_LABEL}.`;
    case "InvalidFolderName":
      return `"${detail}" cannot be used as a markup folder name: it must be one folder name inside ${MARKUPS_LABEL}. Open the image again, then save.`;
    case "InvalidFolder":
      return "No markup folder was given. Pick a folder created by Save.";
    case "InvalidFiles":
      return "The markup to save is incomplete: source.png, annotations.json or export.png is missing. Save again.";
    case "NoDocumentsFolder":
      return `Collide could not find your Documents folder (${cause}). Check that it exists, then restart Collide.`;
    // The next two are the texts the Rust shell's store showed.
    case "WriteFailed":
      return `Writing ${detail} failed (${cause}). Check that ${MARKUPS_LABEL} is writable and has free space, then save again.`;
    case "ReadFailed":
      return `${detail} is missing ${FILE_SOURCE} or ${FILE_ANNOTATIONS} (${cause}). Pick a folder created by Save.`;
    case "NotMarkupFolder":
      return `${detail} is not a markup folder directly inside ${MARKUPS_LABEL}, so Collide will not delete it. Delete it in File Explorer if it should go.`;
    case "DeleteFailed":
      return `Deleting ${detail} failed (${cause}). Collide deletes only ${FILE_SOURCE}, ${FILE_ANNOTATIONS} and ${FILE_EXPORT}; close anything using the folder or remove what else is in it, then delete again.`;
  }
}

/** Typed storage failure. `message` is the cause plus the fix, ready for a Toast. */
export class MarkupStoreError extends Error {
  readonly kind: MarkupStoreErrorKind;
  /** The path or name the failure is about. */
  readonly detail: string;

  constructor(kind: MarkupStoreErrorKind, detail = "", cause = "") {
    super(storeMessage(kind, detail, cause));
    this.name = "MarkupStoreError";
    this.kind = kind;
    this.detail = detail;
  }
}

/** `<documents>/Collide/Markups`. */
export function markupsRoot(path: MarkupPath, documents: string): string {
  if (typeof documents !== "string" || documents === "" || !path.isAbsolute(documents)) {
    throw new MarkupStoreError("NoDocumentsFolder", "", `got ${JSON.stringify(documents)}`);
  }
  return path.resolve(documents, ...MARKUPS_SEGMENTS);
}

/** True when `target` is `root` or below it. Both must already be resolved (absolute, no `.` or `..`). */
export function isInside(path: MarkupPath, root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!path.isAbsolute(rel) && rel.split(path.sep)[0] !== "..");
}

const WINDOWS_RESERVED = /[<>:"|?*]/;
/** Names Windows gives to devices, with or without an extension (NUL, COM1.txt, ...). */
const WINDOWS_DEVICE = /^(CON|PRN|AUX|NUL|COM[0-9¹²³]|LPT[0-9¹²³])(\..*)?$/i;
// Control characters are never part of a name Collide writes (and cannot be on Windows).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f]/;

/**
 * True for a path segment that Windows would read as something other than the
 * name it looks like: a trailing dot or space is dropped (`".. "` becomes `..`),
 * `name:stream` is an alternate data stream, `NUL` is a device.
 */
function windowsWouldRewrite(segment: string): boolean {
  return /[. ]$/.test(segment) || WINDOWS_RESERVED.test(segment) || WINDOWS_DEVICE.test(segment);
}

const isWindows = (path: MarkupPath) => path.sep === "\\";

/**
 * Resolve `target` (absolute, or relative to `root`) and return it if it is `root`
 * or inside it; otherwise throw `OutsideMarkups`. Text only: no file access.
 */
export function resolveInScope(path: MarkupPath, root: string, target: string): string {
  const outside = () => new MarkupStoreError("OutsideMarkups", target);
  if (CONTROL.test(target)) throw outside();
  // Windows drops a trailing dot or space, so `".. "` is `..` there while `path` reads it as a name:
  // such a segment is refused as written, before it can be resolved away.
  if (isWindows(path) && target.split(/[\\/]/).some((s) => s !== "." && s !== ".." && /[. ]$/.test(s))) throw outside();
  const resolved = path.resolve(root, target);
  if (!isInside(path, root, resolved)) throw outside();
  if (isWindows(path)) {
    const rel = path.relative(root, resolved);
    if (rel !== "" && rel.split(path.sep).some(windowsWouldRewrite)) throw outside();
  }
  return resolved;
}

/** True when `name` is one plain folder name: no separators, not `.` or `..`, nothing Windows would rewrite. */
export function isFolderName(path: MarkupPath, name: unknown): name is string {
  if (typeof name !== "string" || name === "" || name === "." || name === "..") return false;
  if (/[\\/]/.test(name) || CONTROL.test(name)) return false;
  return !(isWindows(path) && windowsWouldRewrite(name));
}

/** A Uint8Array (a Node Buffer is one), whichever realm made it. */
const isBytes = (v: unknown): v is Uint8Array => ArrayBuffer.isView(v) && Object.prototype.toString.call(v) === "[object Uint8Array]";

function isMarkupFiles(v: unknown): v is MarkupFiles {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  if (!(isBytes(f.sourcePng) && typeof f.annotations === "string" && isBytes(f.exportPng))) return false;
  if (f.images === undefined) return true;
  return Array.isArray(f.images) && f.images.every((i) => typeof i === "object" && i !== null && typeof i.name === "string" && IMAGE_FILE.test(i.name) && isBytes(i.png));
}

export function createMarkups(deps: MarkupsDeps): Markups {
  const { fs, path } = deps;

  const root = (): string => {
    let documents: string;
    try {
      documents = deps.documents();
    } catch (e) {
      throw new MarkupStoreError("NoDocumentsFolder", "", detailOf(e));
    }
    return markupsRoot(path, documents);
  };

  /** `p` with links followed; null if nothing is there. A link that leads nowhere is refused: writing to it would create its target. */
  const real = (p: string, shown: string): string | null => {
    try {
      return fs.realpathSync(p);
    } catch {
      let dangling = false;
      try {
        dangling = fs.lstatSync(p).isSymbolicLink();
      } catch {
        /* nothing there */
      }
      if (dangling) throw new MarkupStoreError("OutsideMarkups", shown);
      return null;
    }
  };

  /**
   * After the text check: a link (or junction) inside Markups must not lead out of it.
   * A path that does not exist yet is judged by the nearest folder above it that does.
   */
  const followed = (rootDir: string, target: string, shown: string): string => {
    const realRoot = real(rootDir, shown);
    if (realRoot === null) return target; // no Markups folder yet, so nothing in it to follow
    let existing = target;
    let realTarget = real(existing, shown);
    while (realTarget === null && existing !== rootDir) {
      const parent = path.resolve(existing, "..");
      if (parent === existing) break;
      existing = parent;
      realTarget = real(existing, shown);
    }
    if (realTarget !== null && !isInside(path, realRoot, realTarget)) throw new MarkupStoreError("OutsideMarkups", shown);
    return target;
  };

  const scoped = (rootDir: string, target: string, shown = target): string => followed(rootDir, resolveInScope(path, rootDir, target), shown);

  return {
    save(folderName, files) {
      const rootDir = root();
      if (!isFolderName(path, folderName)) throw new MarkupStoreError("InvalidFolderName", String(folderName));
      if (!isMarkupFiles(files)) throw new MarkupStoreError("InvalidFiles");
      const dir = scoped(rootDir, path.join(rootDir, folderName), folderName);
      const write = (name: string, data: Uint8Array | string) => fs.writeFileSync(scoped(rootDir, path.join(dir, name), dir), data);
      try {
        fs.mkdirSync(dir, { recursive: true });
        followed(rootDir, dir, dir);
        write(FILE_SOURCE, files.sourcePng);
        write(FILE_ANNOTATIONS, files.annotations);
        write(FILE_EXPORT, files.exportPng);
        // Added images (T33); an image deleted since the last save leaves no file behind.
        const keep = new Set<string>();
        for (const img of files.images ?? []) {
          write(img.name, img.png);
          keep.add(img.name);
        }
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!e.isDirectory() && IMAGE_FILE.test(e.name) && !keep.has(e.name)) fs.unlinkSync(scoped(rootDir, path.join(dir, e.name), dir));
        }
      } catch (e) {
        if (e instanceof MarkupStoreError) throw e;
        throw new MarkupStoreError("WriteFailed", dir, detailOf(e));
      }
      return dir;
    },

    open(folder) {
      if (typeof folder !== "string" || folder === "") throw new MarkupStoreError("InvalidFolder");
      const rootDir = root();
      const dir = scoped(rootDir, folder);
      const file = (name: string) => scoped(rootDir, path.join(dir, name), folder);
      const source = file(FILE_SOURCE);
      const annotations = file(FILE_ANNOTATIONS);
      try {
        const text = fs.readFileSync(annotations, "utf8");
        const images = listedImages(text).map((name) => ({ name, png: fs.readFileSync(file(name)) }));
        return { sourcePng: fs.readFileSync(source), annotations: text, ...(images.length ? { images } : {}) };
      } catch (e) {
        throw new MarkupStoreError("ReadFailed", folder, detailOf(e));
      }
    },

    async pick() {
      const rootDir = root();
      try {
        fs.mkdirSync(rootDir, { recursive: true });
      } catch {
        /* the dialog still works without the default folder */
      }
      const result = await deps.showOpenDialog({ title: PICK_TITLE, defaultPath: rootDir, properties: ["openDirectory"] });
      const picked = result && !result.canceled && Array.isArray(result.filePaths) ? result.filePaths[0] : undefined;
      if (typeof picked !== "string" || picked === "") return null;
      return scoped(rootDir, picked);
    },

    remove(folder) {
      if (typeof folder !== "string" || folder === "") throw new MarkupStoreError("InvalidFolder");
      const rootDir = root();
      const dir = scoped(rootDir, folder);
      // A markup's own folder only: one level below Markups, and the folder itself, not a link to one.
      const rel = path.relative(rootDir, dir);
      if (rel === "" || rel.split(path.sep).length !== 1) throw new MarkupStoreError("NotMarkupFolder", folder);
      let link: boolean;
      try {
        link = fs.lstatSync(dir).isSymbolicLink();
      } catch (e) {
        throw new MarkupStoreError("DeleteFailed", folder, detailOf(e));
      }
      if (link) throw new MarkupStoreError("NotMarkupFolder", folder);
      try {
        let added: string[] = [];
        try {
          added = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.isDirectory() && IMAGE_FILE.test(e.name)).map((e) => e.name);
        } catch {
          /* the folder is checked again below */
        }
        for (const name of [FILE_SOURCE, FILE_ANNOTATIONS, FILE_EXPORT, ...added]) {
          const file = scoped(rootDir, path.join(dir, name), folder);
          try {
            fs.unlinkSync(file);
          } catch (e) {
            if ((e as { code?: unknown } | null)?.code !== "ENOENT") throw e; // already gone is fine
          }
        }
        fs.rmdirSync(dir);
      } catch (e) {
        if (e instanceof MarkupStoreError) throw e;
        throw new MarkupStoreError("DeleteFailed", folder, detailOf(e));
      }
    },

    list() {
      const rootDir = root();
      let entries: { name: string; isDirectory(): boolean }[];
      try {
        entries = fs.readdirSync(rootDir, { withFileTypes: true });
      } catch {
        return []; // nothing saved yet
      }
      return entries.filter((e) => e.isDirectory()).map((e) => path.join(rootDir, e.name));
    },
  };
}
