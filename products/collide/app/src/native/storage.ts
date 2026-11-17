// RUN3 T36: storage on the server PC (Server mode), in the main process (Electron's Node side: there is no
// separate network server in this task). One storage folder holds the saved snips (markup folders) and the
// Collide files: the same scoped folder as markups.ts and collideFiles.ts, Documents/Collide/Markups (A, ISSUES).
// Retention: "keep the newest N" (storage.json in the user-data folder; off until set: no default deletion, (A)).
// After each save the page asks for `prune(open)`: the oldest items beyond N are deleted, never an open one, with
// no question asked, and each deletion is written to storage.log in the user-data folder.
// Nothing here imports Node or Electron: `fs`, `path`, the folders and the clock are passed in.

import { COLLIDE_EXT } from "./collideFiles";
import { FILE_ANNOTATIONS, FILE_EXPORT, FILE_SOURCE, IMAGE_FILE, markupsScope, MarkupStoreError, type MarkupFs, type Markups, type MarkupPath } from "./markups";

export const STORAGE_SETTINGS_FILE = "storage.json";
export const STORAGE_LOG_FILE = "storage.log";
/** The largest "keep the newest N" accepted. */
export const MAX_KEEP = 100000;

interface Entry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

/** The part of `node:fs` used here. */
export interface StorageFs {
  readdirSync(dir: string, options: { withFileTypes: true }): Entry[];
  /** Follows links; throws if nothing is there. */
  statSync(p: string): { size: number; mtimeMs: number };
  /** The entry itself (a link is not followed). */
  lstatSync(p: string): { isSymbolicLink(): boolean; isFile(): boolean };
  realpathSync(p: string): string;
  readFileSync(file: string, encoding: "utf8"): string;
  writeFileSync(file: string, data: string): void;
  appendFileSync(file: string, data: string): void;
  mkdirSync(dir: string, options: { recursive: true }): unknown;
  unlinkSync(file: string): void;
}

export interface StorageDeps {
  fs: StorageFs;
  path: MarkupPath & { basename(p: string): string };
  /** Main process: `app.getPath("documents")`. The storage folder is `<documents>/Collide/Markups`. */
  documents: () => string;
  /** Main process: `app.getPath("userData")`: storage.json and storage.log. */
  userData: () => string;
  /** The clock for the log lines. */
  now: () => Date;
  /** Deletes a markup folder (markups.ts: only Save's files, then the folder). */
  markups: Pick<Markups, "remove">;
}

export interface StorageItem {
  name: string;
  kind: "markup" | "collide";
  /** Last saved (ms since 1970): annotations.json for a markup, the file itself for a Collide file. */
  time: number;
  bytes: number;
}

/** What Settings → Storage shows. */
export interface StorageInfo {
  folder: string;
  items: number;
  bytes: number;
  /** Keep the newest this many; null = off, every item is kept. */
  keep: number | null;
}

export interface PruneResult {
  /** The names deleted, oldest first. */
  deleted: string[];
  info: StorageInfo;
}

/** What the bridge's `storage.*` channels call. Arguments arrive from the page, so they are `unknown` until checked. */
export interface Storage {
  info(): StorageInfo;
  /** Set "keep the newest N" (a whole number from 1 to MAX_KEEP), or null for off. Deletes nothing by itself. */
  setKeep(keep: unknown): StorageInfo;
  /** Delete the oldest items beyond N, except the open ones (names or paths of the items open in tabs). */
  prune(open: unknown): PruneResult;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const lastSegment = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;

/** Newest first; the same time goes by name, the later name first (markup folders start with the date). */
export function newestFirst(items: StorageItem[]): StorageItem[] {
  return [...items].sort((a, b) => b.time - a.time || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

/** The items to delete for "keep the newest `keep`": every item past the newest `keep`, except the open ones. Oldest first. */
export function itemsToDelete(items: StorageItem[], keep: number | null, open: ReadonlySet<string>): StorageItem[] {
  if (keep === null) return [];
  return newestFirst(items)
    .slice(keep)
    .filter((i) => !open.has(i.name))
    .reverse();
}

const isKeep = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_KEEP;

export function createStorage(deps: StorageDeps): Storage {
  const { fs, path } = deps;
  // The scope check reads only realpathSync and lstatSync, which StorageFs has.
  const { root, scoped } = markupsScope({ fs: fs as unknown as MarkupFs, path, documents: deps.documents });
  const settingsFile = () => path.join(deps.userData(), STORAGE_SETTINGS_FILE);

  const readKeep = (): number | null => {
    try {
      const raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8")) as { keep?: unknown } | null;
      return isKeep(raw?.keep) ? raw.keep : null;
    } catch {
      return null; // no file yet, or unreadable: off
    }
  };

  const log = (line: string) => {
    try {
      fs.mkdirSync(deps.userData(), { recursive: true });
      fs.appendFileSync(path.join(deps.userData(), STORAGE_LOG_FILE), `${deps.now().toISOString()} ${line}\n`);
    } catch {
      /* the log is a record only: a deletion is never held back by it */
    }
  };

  const fileSize = (p: string) => {
    try {
      return fs.statSync(p).size;
    } catch {
      return 0;
    }
  };

  /** The items directly in the storage folder: real markup folders and real .collide files. Links are never items. */
  const items = (rootDir: string): StorageItem[] => {
    let entries: Entry[];
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch {
      return []; // nothing saved yet
    }
    const out: StorageItem[] = [];
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      let full: string;
      try {
        full = scoped(rootDir, path.join(rootDir, e.name), e.name);
      } catch {
        continue;
      }
      try {
        if (e.isDirectory()) {
          let bytes = 0;
          for (const f of fs.readdirSync(full, { withFileTypes: true })) if (f.isFile()) bytes += fileSize(path.join(full, f.name));
          let time: number;
          try {
            time = fs.statSync(path.join(full, FILE_ANNOTATIONS)).mtimeMs;
          } catch {
            time = fs.statSync(full).mtimeMs;
          }
          out.push({ name: e.name, kind: "markup", time, bytes });
        } else if (e.isFile() && e.name.toLowerCase().endsWith(COLLIDE_EXT)) {
          const st = fs.statSync(full);
          out.push({ name: e.name, kind: "collide", time: st.mtimeMs, bytes: st.size });
        }
      } catch {
        /* gone or unreadable: not counted */
      }
    }
    return out;
  };

  const info = (): StorageInfo => {
    const rootDir = root();
    const list = items(rootDir);
    return { folder: rootDir, items: list.length, bytes: list.reduce((n, i) => n + i.bytes, 0), keep: readKeep() };
  };

  /** A markup folder is deleted only when it holds nothing but Save's files, so a deletion never stops half way. */
  const onlySavedFiles = (rootDir: string, name: string) => {
    const dir = scoped(rootDir, path.join(rootDir, name), name);
    const extra = fs.readdirSync(dir, { withFileTypes: true }).find((e) => !(e.isFile() && ([FILE_SOURCE, FILE_ANNOTATIONS, FILE_EXPORT].includes(e.name) || IMAGE_FILE.test(e.name))));
    if (extra) throw new StorageError(`it holds ${extra.name}, which Collide did not write`);
  };

  const removeCollide = (rootDir: string, name: string) => {
    const file = scoped(rootDir, path.join(rootDir, name), name);
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || !st.isFile()) throw new MarkupStoreError("NotMarkupFolder", name);
    fs.unlinkSync(file);
  };

  return {
    info,

    setKeep(keep) {
      if (keep !== null && !isKeep(keep)) throw new StorageError(`"${String(keep)}" is not a number of files Collide can keep: use a whole number from 1 to ${MAX_KEEP}, or leave it empty to keep every file.`);
      try {
        fs.mkdirSync(deps.userData(), { recursive: true });
        fs.writeFileSync(settingsFile(), `${JSON.stringify({ keep }, null, 2)}\n`);
      } catch (e) {
        throw new StorageError(`Saving the storage setting failed (${detailOf(e)}). Check that Collide's settings folder is writable, then save again.`);
      }
      log(keep === null ? "retention off: every file is kept" : `retention set: keep the newest ${keep}`);
      return info();
    },

    prune(open) {
      const rootDir = root();
      const keep = readKeep();
      const openNames = new Set(Array.isArray(open) ? open.filter((o): o is string => typeof o === "string" && o !== "").map(lastSegment) : []);
      const deleted: string[] = [];
      for (const item of itemsToDelete(items(rootDir), keep, openNames)) {
        try {
          if (item.kind === "markup") {
            onlySavedFiles(rootDir, item.name);
            deps.markups.remove(path.join(rootDir, item.name));
          }
          else removeCollide(rootDir, item.name);
          deleted.push(item.name);
          log(`deleted ${item.name} (keep the newest ${keep})`);
        } catch (e) {
          log(`not deleted ${item.name}: ${detailOf(e)}`);
        }
      }
      return { deleted, info: info() };
    },
  };
}
