// RUN3 T35: Collide files (`.collide`) on disk, in the main process. Scoped like the markup folders (markups.ts):
// (A) they live in the same folder, Documents/Collide/Markups, beside the markup folders; every path is resolved and
// checked against it (text first, then links on disk) and anything outside is refused.
// Only bytes cross here: the page packs and unpacks the zip (src/io/collideFile.ts) and validates its manifest.
// RUN3 T38: PDFs. Open's dialog also takes a .pdf from any folder (A: a PDF to mark up is wherever the user keeps
// it). The page can then read that one file and nothing else: the main process remembers each PDF the dialog
// returned this run, and `openPdf` refuses any other path outside Markups. Export writes `<name>-markup.pdf`
// into Markups, scoped like the Collide files.
// Nothing here imports Node or Electron: they are passed in, so the tests run with a temp folder and fakes.

import { FILE_ANNOTATIONS, isFolderName, markupsScope, MarkupStoreError, MARKUPS_LABEL, type MarkupFs, type MarkupPath } from "./markups";

export const COLLIDE_EXT = ".collide";
export const PDF_EXT = ".pdf";
export const OPEN_TITLE = "Open a PDF, a Collide file or a saved markup";
/** A PDF bigger than this is not read (A). */
export const MAX_PDF_BYTES = 256 * 1024 * 1024;
/** A Collide file bigger than this is not read (the page refuses anything that unpacks to more than 256 MB). */
export const MAX_COLLIDE_BYTES = 512 * 1024 * 1024;

export interface OpenFileDialogOptions {
  title: string;
  defaultPath: string;
  properties: ["openFile"];
  filters: { name: string; extensions: string[] }[];
}

export interface CollideFs extends MarkupFs {
  /** Follows links; throws if nothing is there. */
  statSync(p: string): { isDirectory(): boolean; size: number };
}

export interface CollideFilesDeps {
  fs: CollideFs;
  path: MarkupPath & { dirname(p: string): string; basename(p: string): string };
  documents: () => string;
  /** Main process: `dialog.showOpenDialog` on the editor window. */
  showOpenDialog: (options: OpenFileDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
}

/** What Open picked: a Collide file, or a markup folder (picked as the folder or as its annotations.json). */
export type OpenPick = { kind: "collide"; file: string } | { kind: "markup"; folder: string } | { kind: "pdf"; file: string } | null;

/** What the bridge's `collideFiles.*` channels call. Arguments arrive from the page, so they are `unknown` until checked. */
export interface CollideFiles {
  /**
   * Write `bytes` as `name` (one file name ending in .collide) in Markups. When a file of that name is there and
   * `replace` is not true, the next free name is used (`name-2.collide`, ...). Resolves with the file's path.
   */
  save(name: unknown, bytes: unknown, replace: unknown): string;
  /** Read a Collide file inside Markups. */
  open(file: unknown): Uint8Array;
  /** The Open dialog, starting in Markups: a PDF (any folder), a .collide file, or a markup (its folder or its annotations.json). Null if cancelled. */
  pick(): Promise<OpenPick>;
  /** RUN3 T38: read a PDF that Open picked this run, or one inside Markups. Anything else is refused. */
  openPdf(file: unknown): Uint8Array;
  /** RUN3 T38: write an exported PDF as `name` (one file name ending in .pdf) in Markups; a taken name gets `-2`, ... Resolves with the path. */
  exportPdf(name: unknown, bytes: unknown): string;
}

const isBytes = (v: unknown): v is Uint8Array => ArrayBuffer.isView(v) && Object.prototype.toString.call(v) === "[object Uint8Array]";
const detailOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isCollideName = (path: MarkupPath, name: unknown, ext = COLLIDE_EXT): name is string =>
  isFolderName(path, name) && name.length <= 160 && name.toLowerCase().endsWith(ext) && name.length > ext.length;
/** `%PDF-` within the first 1024 bytes, as the format allows. */
const PDF_HEAD = [0x25, 0x50, 0x44, 0x46, 0x2d];
const looksPdf = (b: Uint8Array) => {
  for (let i = 0; i <= Math.min(b.length - PDF_HEAD.length, 1024); i++) if (PDF_HEAD.every((c, k) => b[i + k] === c)) return true;
  return false;
};

/** Typed failures of the Collide files, as cause-and-fix text for a toast. */
export class CollideFileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollideFileStoreError";
  }
}

export function createCollideFiles(deps: CollideFilesDeps): CollideFiles {
  const { fs, path } = deps;
  const { root, followed, scoped } = markupsScope(deps);
  /** PDFs the Open dialog returned this run (resolved paths): the only PDFs outside Markups the page may read. */
  const pickedPdfs = new Set<string>();
  const exists = (p: string) => {
    try {
      fs.lstatSync(p);
      return true;
    } catch {
      return false;
    }
  };

  return {
    save(name, bytes, replace) {
      const rootDir = root();
      if (!isCollideName(path, name)) {
        throw new CollideFileStoreError(`"${String(name)}" cannot be used as a Collide file name: it must be one file name ending in ${COLLIDE_EXT}. Save again.`);
      }
      if (!isBytes(bytes) || bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new CollideFileStoreError("The Collide file to save is not a package. Save again.");
      const stem = name.slice(0, -COLLIDE_EXT.length);
      let file = scoped(rootDir, path.join(rootDir, name), name);
      for (let n = 2; replace !== true && exists(file); n++) {
        if (n > 999) throw new CollideFileStoreError(`Too many Collide files are named ${name} in ${MARKUPS_LABEL}. Delete or rename some, then save again.`);
        file = scoped(rootDir, path.join(rootDir, `${stem}-${n}${COLLIDE_EXT}`), name);
      }
      try {
        fs.mkdirSync(rootDir, { recursive: true });
        followed(rootDir, file, name);
        fs.writeFileSync(file, bytes);
      } catch (e) {
        if (e instanceof MarkupStoreError) throw e;
        throw new MarkupStoreError("WriteFailed", file, detailOf(e));
      }
      return file;
    },

    open(file) {
      if (typeof file !== "string" || file === "") throw new CollideFileStoreError("No Collide file was given. Pick a .collide file.");
      const rootDir = root();
      const target = scoped(rootDir, file);
      if (!target.toLowerCase().endsWith(COLLIDE_EXT)) throw new CollideFileStoreError(`${file} is not a Collide file. Pick a ${COLLIDE_EXT} file.`);
      try {
        const st = fs.statSync(target);
        if (st.isDirectory()) throw new Error("it is a folder");
        if (st.size > MAX_COLLIDE_BYTES) throw new CollideFileStoreError(`${file} is larger than ${MAX_COLLIDE_BYTES / 1024 / 1024} MB, so Collide will not open it.`);
        return fs.readFileSync(target);
      } catch (e) {
        if (e instanceof CollideFileStoreError) throw e;
        throw new CollideFileStoreError(`Reading ${file} failed (${detailOf(e)}). Check that the file is there, then open it again.`);
      }
    },

    async pick() {
      const rootDir = root();
      try {
        fs.mkdirSync(rootDir, { recursive: true });
      } catch {
        /* the dialog still works without the default folder */
      }
      const result = await deps.showOpenDialog({
        title: OPEN_TITLE,
        defaultPath: rootDir,
        properties: ["openFile"],
        filters: [{ name: "PDFs, Collide files and saved markups", extensions: ["pdf", "collide", "json"] }],
      });
      const picked = result && !result.canceled && Array.isArray(result.filePaths) ? result.filePaths[0] : undefined;
      if (typeof picked !== "string" || picked === "") return null;
      // A PDF may be in any folder: the user chose it in the dialog. Only this file is let through to openPdf.
      if (picked.toLowerCase().endsWith(PDF_EXT)) {
        const file = path.resolve(picked);
        pickedPdfs.add(file);
        return { kind: "pdf", file };
      }
      const target = scoped(rootDir, picked);
      let folder = false;
      try {
        folder = fs.statSync(target).isDirectory();
      } catch {
        /* judged by its name below; opening it reports what is missing */
      }
      if (folder) return { kind: "markup", folder: target };
      if (path.basename(target) === FILE_ANNOTATIONS) return { kind: "markup", folder: scoped(rootDir, path.dirname(target), picked) };
      if (target.toLowerCase().endsWith(COLLIDE_EXT)) return { kind: "collide", file: target };
      throw new CollideFileStoreError(`${picked} is not a Collide file or a saved markup. Pick a ${COLLIDE_EXT} file, or the ${FILE_ANNOTATIONS} in a markup's folder.`);
    },

    openPdf(file) {
      if (typeof file !== "string" || file === "") throw new CollideFileStoreError("No PDF was given. Pick a .pdf file with Open.");
      if (!file.toLowerCase().endsWith(PDF_EXT)) throw new CollideFileStoreError(`${file} is not a PDF. Pick a ${PDF_EXT} file.`);
      const resolved = path.resolve(file);
      // Picked in the dialog this run, or inside Markups (checked like every other path there).
      const target = pickedPdfs.has(resolved) ? resolved : scoped(root(), file);
      let bytes: Uint8Array;
      try {
        const st = fs.statSync(target);
        if (st.isDirectory()) throw new Error("it is a folder");
        if (st.size > MAX_PDF_BYTES) throw new CollideFileStoreError(`${file} is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB, so Collide will not open it.`);
        bytes = fs.readFileSync(target);
      } catch (e) {
        if (e instanceof CollideFileStoreError) throw e;
        throw new CollideFileStoreError(`Reading ${file} failed (${detailOf(e)}). Check that the file is there, then open it again.`);
      }
      if (!looksPdf(bytes)) throw new CollideFileStoreError(`${file} is not a PDF (it does not start with %PDF-). Open another file.`);
      return bytes;
    },

    exportPdf(name, bytes) {
      const rootDir = root();
      if (!isCollideName(path, name, PDF_EXT)) throw new CollideFileStoreError(`"${String(name)}" cannot be used as a PDF file name: it must be one file name ending in ${PDF_EXT}. Export again.`);
      if (!isBytes(bytes) || !looksPdf(bytes)) throw new CollideFileStoreError("The PDF to export is not a PDF. Export again.");
      const stem = name.slice(0, -PDF_EXT.length);
      let file = scoped(rootDir, path.join(rootDir, name), name);
      for (let n = 2; exists(file); n++) {
        if (n > 999) throw new CollideFileStoreError(`Too many PDFs are named ${name} in ${MARKUPS_LABEL}. Delete or rename some, then export again.`);
        file = scoped(rootDir, path.join(rootDir, `${stem}-${n}${PDF_EXT}`), name);
      }
      try {
        fs.mkdirSync(rootDir, { recursive: true });
        followed(rootDir, file, name);
        fs.writeFileSync(file, bytes);
      } catch (e) {
        if (e instanceof MarkupStoreError) throw e;
        throw new MarkupStoreError("WriteFailed", file, detailOf(e));
      }
      return file;
    },
  };
}
