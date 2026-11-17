// An opened folder as a second package (L08): its listing (from the main process) turned into
// a tree of folders and items the views, the tree and search (search.ts) already understand.
// PDFs become documents (page texts for search), Markdown and text become notes (shown as
// plain read-only text, A), GLBs become models (parts from the file), anything else is listed
// but not opened (A). Readers are passed in, so this is unit-tested without Electron or pdf.js.
import type { FolderListing } from "../bridge";
import { MAX_FILE_BYTES } from "../../native/folder";
import type { DiskSource, Item } from "../data/sample";
import { bodiesLabel, glbParts, readGlbJson } from "../viewer/glb";

export interface DiskFolder {
  readonly name: string;
  /** "" for the opened folder itself. */
  readonly path: string;
  readonly folders: readonly DiskFolder[];
  readonly files: readonly Item[];
}

export interface DiskPackage {
  readonly name: string;
  readonly root: DiskFolder;
  readonly truncated: boolean;
}

export interface PackageReaders {
  read(path: string): Promise<Uint8Array>;
  /** The text of each page of a PDF. */
  pdfPages(bytes: Uint8Array): Promise<string[]>;
}

/** Item ids of opened files: "f:" + the relative path (sample ids never contain ":"). */
export const DISK_ID_PREFIX = "f:";
export const diskId = (path: string) => DISK_ID_PREFIX + path;
export const isDiskId = (id: string) => id.startsWith(DISK_ID_PREFIX);

export const NOT_OPENED = "Lite lists this file but does not open this type. It opens PDF, Markdown, text and GLB files.";
export const TOO_LARGE = "This file is larger than 50 MB, so Lite lists it but does not open it.";

export async function loadPackage(listing: FolderListing, readers: PackageReaders): Promise<DiskPackage> {
  type Mutable = { name: string; path: string; folders: Mutable[]; files: Item[] };
  const root: Mutable = { name: listing.name, path: "", folders: [], files: [] };
  const byPath = new Map<string, Mutable>([["", root]]);
  const parentOf = (path: string) => byPath.get(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "") ?? root;
  for (const entry of listing.entries) {
    if (entry.kind === "folder") {
      const folder: Mutable = { name: entry.name, path: entry.path, folders: [], files: [] };
      byPath.set(entry.path, folder);
      parentOf(entry.path).folders.push(folder);
    } else {
      parentOf(entry.path).files.push(await loadItem(entry.path, entry.name, entry.kind, entry.size ?? 0, readers));
    }
  }
  return { name: listing.name, root, truncated: listing.truncated };
}

async function loadItem(path: string, title: string, kind: DiskSource["kind"], size: number, readers: PackageReaders): Promise<Item> {
  const id = diskId(path);
  const unopened = (problem: string): Item => ({ id, type: "note", title, text: "", source: { kind, path, size, problem } });
  if (kind === "other") return unopened(NOT_OPENED);
  if (size > MAX_FILE_BYTES) return unopened(TOO_LARGE);
  const source: DiskSource = { kind, path, size };
  try {
    const bytes = await readers.read(path);
    if (kind === "pdf") {
      const pages = await readers.pdfPages(bytes);
      if (!pages.length) return unopened("This PDF has no pages Lite can show.");
      return { id, type: "document", title, pages, source };
    }
    if (kind === "glb") {
      const parts = glbParts(readGlbJson(bytes)).map((p) => ({ name: p.name, bodies: bodiesLabel(p.bodies) }));
      return { id, type: "model", title, parts, source };
    }
    return { id, type: "note", title, text: new TextDecoder("utf-8").decode(bytes), source };
  } catch {
    return unopened(`Lite could not read this ${kind === "glb" ? "GLB" : kind === "pdf" ? "PDF" : "file"}.`);
  }
}

/** Every item of the package, folders first (tree order). */
export function packageItems(pkg: DiskPackage): Item[] {
  const out: Item[] = [];
  const walk = (f: DiskFolder) => {
    for (const sub of f.folders) walk(sub);
    out.push(...f.files);
  };
  walk(pkg.root);
  return out;
}
