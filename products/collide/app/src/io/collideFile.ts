// RUN3 T35: the Collide file (`.collide`, Grant 2026-11-15): one zip package that reopens fully editable.
// Package layout is Draft (not yet approved by Grant), as in ../../../layout-prototype.html:
//   manifest.json  format, version, kind (snip | markdown), the tab title and every item (shape, bubble, note,
//                  card settings) in draw order, back to front; the callout list shows them front to back
//                  (RUN3 T38: a PDF package lists its pages, each with its size in points and its own items, and
//                  the page that was in front)
//   sources/       the sources in their own formats: a snip's source.png and its added image-<n>.png files,
//                  the .md file and the pictures it links (images/...), or the original PDF's bytes (source.pdf)
//   preview.png    what Copy gives, for thumbnails
// Pure: encode and decode bytes here; the shell reads and writes the file (Electron: the main process, scoped).
// Decoding never trusts the package: every entry name is checked before anything is unpacked (no zip-slip),
// the size is capped, manifest.json is validated with zod, and every source it lists must be there and nothing else.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { z } from "zod";
import type { ZodIssue } from "zod";
import { CropSchema, formatPath, ShapeSchema, type AnnotationsDoc, type Shape } from "../model";
import { isPng, MarkupError, type ImageFile } from "./markupStore";

export const COLLIDE_EXT = ".collide";
export const MANIFEST = "manifest.json";
export const PREVIEW = "preview.png";
export const SOURCES = "sources/";
/** A snip's base image inside the package. */
export const SNIP_SOURCE = `${SOURCES}source.png`;
export const FORMAT = "collide";
export const VERSION = 1;

/** A package bigger than this unpacked is refused (a zip bomb, or not a Collide file). */
export const MAX_UNPACKED = 256 * 1024 * 1024;
export const MAX_ENTRIES = 2000;

export const OPEN_FAILED = "Could not open the Collide file";
export const SAVE_FAILED = "Could not save the Collide file";

/** Pictures a Markdown package may carry, by extension. */
export const PICTURE_TYPES: Readonly<Record<string, string>> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export interface SnipPackage {
  kind: "snip";
  /** The tab title. */
  title: string;
  /** Shapes back to front (draw order); `images` lists the added images' files. */
  doc: AnnotationsDoc;
  /** source.png, as the tab keeps it. */
  source: Uint8Array;
  /** Added images (`image-<n>.png`), as the markup folder keeps them. */
  images: ImageFile[];
  preview: Uint8Array;
}

export interface MarkdownPackage {
  kind: "markdown";
  title: string;
  /** The .md file's name. */
  file: string;
  text: string;
  /** The page markup (page pixels), back to front. */
  shapes: Shape[];
  /** Pictures the text links, by their path from the zip's root (`images/x.png`), in their own formats. */
  pictures: { path: string; bytes: Uint8Array }[];
  preview: Uint8Array;
}

/** RUN3 T38: a PDF with its markup, page by page. The PDF goes in unchanged. */
export interface PdfPackage {
  kind: "pdf";
  title: string;
  /** The PDF's own file name (shown in the tab and the status bar). */
  name: string;
  /** The original PDF, byte for byte. */
  pdf: Uint8Array;
  /** The page in front, from 0. */
  page: number;
  /** Every page: its size as shown (PDF points) and its items in shown points, back to front. */
  pages: { width: number; height: number; shapes: Shape[] }[];
  preview: Uint8Array;
}

export type CollidePackage = SnipPackage | MarkdownPackage | PdfPackage;

/** A PDF's bytes start with `%PDF-` (some writers put a few bytes before it; the format allows up to 1024). */
export function isPdf(b: Uint8Array): boolean {
  const head = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const end = Math.min(b.length - head.length, 1024);
  for (let i = 0; i <= end; i++) if (head.every((c, k) => b[i + k] === c)) return true;
  return false;
}
export const PDF_SOURCE = `${SOURCES}source.pdf`;

// ---------- Entry names ----------

/** One path segment: letters, digits, `_`, `-`, `.` and space; not hidden, not `.`/`..`, no trailing dot or space. */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._ ()-]{0,127}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * True for a zip entry name Collide will unpack: a relative path of plain segments joined by `/`.
 * Refuses `..`, absolute paths, drive letters, backslashes, empty segments and control characters (zip-slip).
 * A folder entry (ending in `/`) is judged by its path without the slash.
 */
export function isSafeEntryName(name: string): boolean {
  if (typeof name !== "string" || name === "" || name.length > 512 || CONTROL.test(name) || name.includes("\\")) return false;
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) return false;
  const parts = (name.endsWith("/") ? name.slice(0, -1) : name).split("/");
  return parts.every((p) => p !== "." && p !== ".." && SEGMENT.test(p) && !/[. ]$/.test(p));
}

/** A path inside `sources/` for a Markdown picture link (`images/x.png`); null when it cannot go in a package. */
export function picturePath(link: string): string | null {
  const rel = link.replace(/^(\.\/|\/)+/, "");
  const ext = /\.([a-z0-9]+)$/i.exec(rel)?.[1]?.toLowerCase();
  if (!ext || !(ext in PICTURE_TYPES)) return null;
  return isSafeEntryName(`${SOURCES}${rel}`) ? rel : null;
}

/** A file name for the package on disk: `<name>.collide` from the tab title (a snip) or the .md file's name. */
export function collideFileName(p: { kind: "snip" | "markdown" | "pdf"; title: string; file?: string }): string {
  const stem =
    p.kind !== "snip"
      ? (p.file ?? p.title).replace(/\.(md|pdf)$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "")
      : p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${stem.slice(0, 96) || (p.kind === "snip" ? "snip" : "document")}${COLLIDE_EXT}`;
}

// ---------- The manifest ----------

const num = z.number().finite();
const title = z.string().max(500);
const SnipManifest = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  kind: z.literal("snip"),
  title,
  order: z.literal("back-to-front"),
  source: z.object({ file: z.literal(SNIP_SOURCE), width: num.positive(), height: num.positive(), crop: CropSchema.optional() }),
  images: z.array(z.object({ file: z.string().regex(/^sources\/image-[1-9][0-9]{0,5}\.png$/), width: num.positive(), height: num.positive() })),
  items: z.array(ShapeSchema),
  preview: z.literal(PREVIEW),
});
const MarkdownManifest = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  kind: z.literal("markdown"),
  title,
  order: z.literal("back-to-front"),
  source: z.object({ file: z.string().regex(/^sources\/[^/]+\.md$/i) }),
  pictures: z.array(z.object({ file: z.string().startsWith(SOURCES) })),
  items: z.array(ShapeSchema),
  preview: z.literal(PREVIEW),
});
const PdfManifest = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  kind: z.literal("pdf"),
  title,
  order: z.literal("back-to-front"),
  source: z.object({ file: z.literal(PDF_SOURCE), name: z.string().min(1).max(260) }),
  page: z.number().int().min(0),
  pages: z.array(z.object({ width: num.positive(), height: num.positive(), items: z.array(ShapeSchema) })).min(1).max(5000),
  preview: z.literal(PREVIEW),
});
export const ManifestSchema = z.discriminatedUnion("kind", [SnipManifest, MarkdownManifest, PdfManifest]);
export type Manifest = z.infer<typeof ManifestSchema>;

const refuse = (why: string) => new MarkupError(OPEN_FAILED, `${why} Save it again from Collide, or open another file.`);

// ---------- Encode ----------

/** Bytes of this realm: fflate tells a file from a folder with `instanceof Uint8Array` (a test's or the bridge's bytes may come from another realm). */
const own = (b: Uint8Array) => (b instanceof Uint8Array ? b : new Uint8Array(b));
const stored = (b: Uint8Array): Zippable[string] => [own(b), { level: 0 }];
const packed = (text: string): Zippable[string] => [own(strToU8(text)), { level: 6 }];

/** The package's bytes. Throws a MarkupError (SAVE_FAILED) for content that cannot go in a package. */
export function encodeCollide(pkg: CollidePackage): Uint8Array {
  const files: Zippable = {};
  let manifest: Manifest;
  if (pkg.kind === "snip") {
    const listed = pkg.doc.images ?? [];
    const images = listed.flatMap((i) => {
      const f = pkg.images.find((x) => x.name === i.file);
      return f ? [{ meta: i, png: f.png }] : [];
    });
    manifest = {
      format: FORMAT,
      version: VERSION,
      kind: "snip",
      title: pkg.title,
      order: "back-to-front",
      source: { file: SNIP_SOURCE, width: pkg.doc.source.width, height: pkg.doc.source.height, ...(pkg.doc.source.crop ? { crop: pkg.doc.source.crop } : {}) },
      images: images.map((i) => ({ file: `${SOURCES}${i.meta.file}`, width: i.meta.width, height: i.meta.height })),
      items: pkg.doc.shapes,
      preview: PREVIEW,
    };
    files[SNIP_SOURCE] = stored(pkg.source);
    for (const i of images) files[`${SOURCES}${i.meta.file}`] = stored(i.png);
  } else if (pkg.kind === "pdf") {
    if (!isPdf(pkg.pdf)) throw new MarkupError(SAVE_FAILED, "The PDF to save is not a PDF. Open the PDF again, then save.");
    manifest = {
      format: FORMAT,
      version: VERSION,
      kind: "pdf",
      title: pkg.title,
      order: "back-to-front",
      source: { file: PDF_SOURCE, name: pkg.name },
      page: Math.max(0, Math.min(pkg.page, pkg.pages.length - 1)),
      pages: pkg.pages.map((p) => ({ width: p.width, height: p.height, items: p.shapes })),
      preview: PREVIEW,
    };
    files[PDF_SOURCE] = stored(pkg.pdf);
  } else {
    const md = `${SOURCES}${pkg.file}`;
    if (!/\.md$/i.test(pkg.file) || !isSafeEntryName(md)) throw new MarkupError(SAVE_FAILED, `"${pkg.file}" cannot be used as the .md file's name in a Collide file. Rename the file, then save again.`);
    const pictures = pkg.pictures.filter((p) => picturePath(p.path) === p.path && `${SOURCES}${p.path}` !== md);
    manifest = {
      format: FORMAT,
      version: VERSION,
      kind: "markdown",
      title: pkg.title,
      order: "back-to-front",
      source: { file: md },
      pictures: pictures.map((p) => ({ file: `${SOURCES}${p.path}` })),
      items: pkg.shapes,
      preview: PREVIEW,
    };
    files[md] = packed(pkg.text);
    for (const p of pictures) files[`${SOURCES}${p.path}`] = stored(p.bytes);
  }
  files[MANIFEST] = packed(JSON.stringify(manifest, null, 2));
  files[PREVIEW] = stored(pkg.preview);
  return zipSync(files);
}

// ---------- Decode ----------

/** Unpack the zip, checking every entry name and the size before anything is inflated. */
function unpack(input: Uint8Array): Record<string, Uint8Array> {
  if (!ArrayBuffer.isView(input)) throw refuse("This file is not a Collide file (it is not a zip package).");
  const bytes = own(input);
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw refuse("This file is not a Collide file (it is not a zip package).");
  let total = 0;
  let count = 0;
  let bad: string | null = null;
  let out: Record<string, Uint8Array>;
  try {
    out = unzipSync(bytes, {
      filter: (f) => {
        if (bad !== null) return false;
        if (!isSafeEntryName(f.name)) bad = `It has an entry named "${f.name.slice(0, 120)}", which points outside the package.`;
        else if (++count > MAX_ENTRIES) bad = `It has more than ${MAX_ENTRIES} entries.`;
        else if ((total += f.originalSize) > MAX_UNPACKED) bad = `It unpacks to more than ${MAX_UNPACKED / 1024 / 1024} MB.`;
        return bad === null && !f.name.endsWith("/");
      },
    });
  } catch (e) {
    if (bad !== null) throw refuse(bad);
    throw refuse(`The package is damaged (${e instanceof Error ? e.message : String(e)}).`);
  }
  if (bad !== null) throw refuse(bad);
  return out;
}

function describe(issue: ZodIssue): string {
  return `${MANIFEST}: ${formatPath(issue.path)} ${issue.message.charAt(0).toLowerCase()}${issue.message.slice(1)}.`;
}

/** Read a package. Never trusts it: a bad one becomes a MarkupError (OPEN_FAILED) that names the cause and the fix. */
export function decodeCollide(bytes: Uint8Array): CollidePackage {
  const entries = unpack(bytes);
  const take = (name: string, what: string): Uint8Array => {
    const b = entries[name];
    if (!b) throw refuse(`${what} (${name}) is missing from the package.`);
    return b;
  };
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(take(MANIFEST, "The manifest")));
  } catch (e) {
    if (e instanceof MarkupError) throw e;
    throw refuse(`${MANIFEST} is not valid JSON.`);
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) throw refuse(describe(parsed.error.issues[0]));
  const m = parsed.data;
  for (const items of m.kind === "pdf" ? m.pages.map((p) => p.items) : [m.items]) {
    const ids = new Set<string>();
    for (const s of items) {
      if (ids.has(s.id)) throw refuse(`${MANIFEST}: two items have the id "${s.id}".`);
      ids.add(s.id);
    }
  }
  const preview = take(PREVIEW, "The preview");
  const listed = new Set([MANIFEST, PREVIEW, m.source.file, ...(m.kind === "snip" ? m.images : m.kind === "markdown" ? m.pictures : []).map((x) => x.file)]);
  const extra = Object.keys(entries).find((n) => !listed.has(n));
  if (extra !== undefined) throw refuse(`It has a file the manifest does not list (${extra}).`);

  if (m.kind === "snip") {
    const source = take(SNIP_SOURCE, "The source image");
    if (!isPng(source)) throw refuse(`${SNIP_SOURCE} is not a PNG.`);
    const images = m.images.map((i) => {
      const png = take(i.file, "An added image");
      if (!isPng(png)) throw refuse(`${i.file} is not a PNG.`);
      return { name: i.file.slice(SOURCES.length), png };
    });
    const files = new Set(images.map((i) => i.name));
    const orphan = m.items.find((s) => s.type === "image" && !files.has(s.src));
    if (orphan?.type === "image") throw refuse(`${MANIFEST}: item "${orphan.id}" shows ${orphan.src}, which the package does not have.`);
    const doc: AnnotationsDoc = {
      version: 1,
      source: { kind: "image", width: m.source.width, height: m.source.height, ...(m.source.crop ? { crop: m.source.crop } : {}) },
      shapes: m.items,
      ...(m.images.length ? { images: m.images.map((i) => ({ file: i.file.slice(SOURCES.length), width: i.width, height: i.height })) } : {}),
    };
    return { kind: "snip", title: m.title, doc, source, images, preview };
  }

  if (m.kind === "pdf") {
    const pdf = take(PDF_SOURCE, "The PDF");
    if (!isPdf(pdf)) throw refuse(`${PDF_SOURCE} is not a PDF.`);
    if (m.page >= m.pages.length) throw refuse(`${MANIFEST}: page ${m.page + 1} is in front, but the PDF has ${m.pages.length} page${m.pages.length === 1 ? "" : "s"}.`);
    const pic = m.pages.flatMap((p) => p.items).find((s) => s.type === "image");
    if (pic) throw refuse(`${MANIFEST}: item "${pic.id}" is an image, which a PDF page cannot hold.`);
    return { kind: "pdf", title: m.title, name: m.source.name, pdf, page: m.page, pages: m.pages.map((p) => ({ width: p.width, height: p.height, shapes: p.items })), preview };
  }
  const img = m.items.find((s) => s.type === "image");
  if (img) throw refuse(`${MANIFEST}: item "${img.id}" is an image, which a Markdown page cannot hold.`);
  const pictures = m.pictures.map((p) => {
    const path = p.file.slice(SOURCES.length);
    if (picturePath(path) !== path) throw refuse(`${p.file} is not a picture Collide can show (PNG, JPEG, GIF or WebP).`);
    return { path, bytes: take(p.file, "A picture") };
  });
  const file = m.source.file.slice(SOURCES.length);
  return { kind: "markdown", title: m.title, file, text: strFromU8(take(m.source.file, "The .md file")), shapes: m.items, pictures, preview };
}

// ---------- The toast's words (the prototype's saveCollide) ----------

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** `2 sources and 5 items`: the base image plus one per added image, and every item. */
export function snipSummary(shapes: readonly Shape[]): string {
  const imgs = shapes.filter((s) => s.type === "image").length;
  return `${1 + imgs} source${imgs ? "s" : ""} and ${plural(shapes.length, "item")}`;
}

/** `the .md file with 2 items`, or `the .md file and 1 pasted image with 2 items` (pasted = linked `images/pasted-…`). */
export function markdownSummary(text: string, shapes: readonly Shape[]): string {
  const pasted = (text.match(/\]\(images\/pasted-[^)]+\)/g) ?? []).length;
  return `the .md file${pasted ? ` and ${pasted} pasted image${pasted > 1 ? "s" : ""}` : ""} with ${plural(shapes.length, "item")}`;
}

/** `the PDF (2 pages) with 3 items`. */
export function pdfSummary(pages: readonly { shapes: readonly Shape[] }[]): string {
  return `the PDF (${plural(pages.length, "page")}) with ${plural(pages.reduce((n, p) => n + p.shapes.length, 0), "item")}`;
}

/** The picture links (`![alt](path)`) of a Markdown text, by path, each once. */
export function pictureLinks(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.add(m[1]);
  return [...out];
}

/** A data URL for a picture's bytes, by its extension; null for a type Collide does not show. */
export function pictureDataUrl(path: string, bytes: Uint8Array): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "";
  const type = PICTURE_TYPES[ext];
  if (!type) return null;
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}

/** A data URL's bytes (base64 or percent-encoded). */
export function dataUrlBytes(url: string): Uint8Array | null {
  const m = /^data:([^,]*?)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  try {
    return m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : strToU8(decodeURIComponent(m[3]));
  } catch {
    return null;
  }
}
