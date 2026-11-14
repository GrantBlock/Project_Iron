// Markup folder storage behind a small interface (T06): `source.png`, `annotations.json`, `export.png`.
// TauriMarkupStore (tauriStore.ts) writes real folders; MemoryMarkupStore backs Vitest and the browser/e2e build.
import { parse, serialize, type AnnotationsDoc } from "../model";

export const MARKUPS_SUBPATH = "Collide/Markups";
export const FILE_SOURCE = "source.png";
export const FILE_ANNOTATIONS = "annotations.json";
export const FILE_EXPORT = "export.png";

export interface SaveInput {
  sourcePng: Uint8Array;
  annotations: AnnotationsDoc;
  exportPng: Uint8Array;
}

export interface OpenedMarkup {
  /** Folder name (last path segment). */
  folderName: string;
  sourcePng: Uint8Array;
  annotations: AnnotationsDoc;
}

export interface MarkupStore {
  /** Write the three files into `folderName` under the markups root. Resolves with the folder's id. */
  save(folderName: string, input: SaveInput): Promise<string>;
  /** Read a markup folder (an id returned by save/pick/list). */
  open(folder: string): Promise<OpenedMarkup>;
  /** Let the user choose a folder to open; null if cancelled. */
  pick(): Promise<string | null>;
  list?(): Promise<string[]>;
}

/** A save/open failure whose message names the cause and the fix (shown in a Toast). */
export class MarkupError extends Error {
  constructor(
    public readonly title: string,
    message: string,
  ) {
    super(message);
    this.name = "MarkupError";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD_<slug>` from the source file name (local date). */
export function markupFolderName(sourceName: string, date: Date = new Date()): string {
  const base = sourceName.replace(/\.[^./\\]+$/, "");
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/, "") || "markup";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${slug}`;
}

/** Parse annotations.json text; a bad file becomes a MarkupError naming the cause and fix. */
export function parseAnnotations(json: string): AnnotationsDoc {
  const r = parse(json);
  if (!r.ok) throw new MarkupError("Could not open markup", `${r.error}.`);
  return r.doc;
}

export function annotationsText(doc: AnnotationsDoc): string {
  return serialize(doc);
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47];
export const isPng = (b: Uint8Array) => PNG_SIG.every((v, i) => b[i] === v);

// ---- Memory store (browser / e2e). Persists to localStorage so it survives a reload (A). ----

const LS_KEY = "collide.markups.v1";

interface Entry {
  source: string; // base64
  annotations: string;
  export: string; // base64
  savedAt: number;
}

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export class MemoryMarkupStore implements MarkupStore {
  private map = new Map<string, Entry>();
  constructor(private readonly persist: boolean = false) {
    if (persist) this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.map = new Map(Object.entries(JSON.parse(raw) as Record<string, Entry>));
    } catch {
      /* storage unavailable or corrupt: start empty */
    }
  }

  private flush() {
    if (!this.persist) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(this.map)));
    } catch {
      throw new MarkupError("Could not save markup", "Browser storage is full or blocked. Free some space or allow site data, then save again.");
    }
  }

  async save(folderName: string, input: SaveInput): Promise<string> {
    this.map.set(folderName, {
      source: toB64(input.sourcePng),
      annotations: annotationsText(input.annotations),
      export: toB64(input.exportPng),
      savedAt: Date.now(),
    });
    this.flush();
    return folderName;
  }

  async open(folder: string): Promise<OpenedMarkup> {
    const e = this.map.get(folder);
    if (!e) throw new MarkupError("Could not open markup", `No saved markup named "${folder}". Save one first or pick another.`);
    return { folderName: folder, sourcePng: fromB64(e.source), annotations: parseAnnotations(e.annotations) };
  }

  async list(): Promise<string[]> {
    return [...this.map.entries()].sort((a, b) => b[1].savedAt - a[1].savedAt).map(([k]) => k);
  }

  /** No dialog in the browser: opens the most recently saved markup (A). */
  async pick(): Promise<string | null> {
    return (await this.list())[0] ?? null;
  }

  /** Test helper: overwrite the stored annotations text (to simulate a corrupt file). */
  setRawAnnotations(folder: string, text: string) {
    const e = this.map.get(folder);
    if (e) this.map.set(folder, { ...e, annotations: text });
  }
}
