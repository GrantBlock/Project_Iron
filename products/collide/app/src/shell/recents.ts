// Recents (RUN3 T31): the snips and zip files in the left panel, grouped Today / Earlier.
// Real rows come from the markup store (T16); the reference fixture loads the prototype's sample rows (sample.ts).
import type { AnnotationsDoc, Shape } from "../model";

export type Day = "Today" | "Earlier";

export interface RecentSnip {
  kind: "snip";
  /** Unique among Recents rows. */
  id: string;
  name: string;
  day: Day;
  /** Shown as "N callouts · W × H" once known. */
  callouts: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  /** Notes, for Search. */
  notes: string[];
  /** A picture for the row, or null for the scissors icon. */
  thumb: string | null;
  /** Sample rows only: stored on the server (cloud) or only on this PC (cloud with an arrow). */
  saved?: boolean;
  /** Where it opens from: a markup folder of the store, or a sample of sample.ts. */
  source: { from: "store"; folder: string } | { from: "sample"; sample: string } | { from: "collide"; file: string };
}

export interface TreeNode {
  name: string;
  /** A folder has kids; a file has a type. */
  kids?: TreeNode[];
  type?: "md" | "image" | "code";
  text?: string;
  /** A picture's data URL (pasted or inserted into the zip's images/ folder this session, RUN3 T34). */
  url?: string;
  /** Sample zips only: the sample snip whose picture this file is. */
  sample?: string;
  /** A Markdown file's page markup (page pixels), as last saved (RUN3 T34). */
  marks?: Shape[];
}

export interface RecentZip {
  kind: "zip";
  id: string;
  name: string;
  day: Day;
  /** "14 files · 2.1 MB" */
  meta: string;
  tree: TreeNode;
}

export type RecentItem = RecentSnip | RecentZip;

export interface FlatFile extends TreeNode {
  /** `<zip id>/folder/file`: unique, and what a tree row opens. */
  path: string;
}

/** Every file of a zip's tree with its path. */
export function flatFiles(node: TreeNode, path: string, out: FlatFile[] = []): FlatFile[] {
  for (const k of node.kids ?? []) {
    const p = `${path}/${k.name}`;
    if (k.kids) flatFiles(k, p, out);
    else out.push({ ...k, path: p });
  }
  return out;
}

const searchText = (r: RecentItem) => (r.kind === "snip" ? [r.name, ...r.notes, ...r.tags].join(" ") : r.name).toLowerCase();

/** Search: rows whose name, notes or tags contain the text. Empty text keeps every row. */
export function filterRecents<T extends RecentItem>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => searchText(r).includes(q)) : [...rows];
}

/** Today first, then Earlier; a group with no rows is left out. */
export function groupRecents<T extends RecentItem>(rows: readonly T[]): { day: Day; rows: T[] }[] {
  return (["Today", "Earlier"] as const).map((day) => ({ day, rows: rows.filter((r) => r.day === day) })).filter((g) => g.rows.length > 0);
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dayStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Last path segment: the markup's folder name. */
export const folderBase = (folder: string) => folder.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? folder;

/** A saved markup folder (`YYYY-MM-DD_<slug>`, as Save names it) as a Recents row; the newest date first when sorted by name. */
export function storeRow(folder: string, today: Date, doc?: AnnotationsDoc, thumb: string | null = null): RecentSnip {
  const name = folderBase(folder);
  const date = /^(\d{4}-\d{2}-\d{2})_/.exec(name)?.[1];
  return {
    kind: "snip",
    id: `markup:${name}`,
    name,
    day: date === dayStamp(today) ? "Today" : "Earlier",
    callouts: doc ? doc.shapes.filter((s) => s.callout !== undefined).length : null,
    width: doc ? doc.source.width : null,
    height: doc ? doc.source.height : null,
    tags: [],
    notes: doc ? doc.shapes.map((s) => s.note ?? "").filter(Boolean) : [],
    thumb,
    source: { from: "store", folder },
  };
}

/** Newest first: Save puts the date at the start of the folder name. */
export const sortFolders = (folders: readonly string[]) => [...folders].sort((a, b) => folderBase(b).localeCompare(folderBase(a)));

/**
 * T43 (8.2): a Collide file saved this session (its path, or its name in a browser) as a Recents row that opens it.
 * (A) Rows for .collide files are kept for this session only; Recents does not read .collide files from disk.
 */
export function collideRow(file: string): RecentSnip {
  return { kind: "snip", id: `collide:${file}`, name: folderBase(file), day: "Today", callouts: null, width: null, height: null, tags: [], notes: [], thumb: null, source: { from: "collide", file } };
}

export const snipMeta = (r: RecentSnip) => (r.source.from === "collide" ? "Collide file" : r.callouts === null || r.width === null || r.height === null ? "Markup" : `${r.callouts} callout${r.callouts === 1 ? "" : "s"} · ${r.width} × ${r.height}`);

// ---------- A zip's files (RUN3 T34: the Markdown editor reads its pictures and writes its pictures and saves) ----------

/** The file at `rel` (a path from the zip's root, `images/x.png`), or null. */
export function zipFile(tree: TreeNode, rel: string): TreeNode | null {
  let node: TreeNode | undefined = tree;
  for (const part of rel.split("/").filter(Boolean)) {
    node = node?.kids?.find((k) => k.name === part);
    if (!node) return null;
  }
  return node && !node.kids ? node : null;
}

/** The tree with the file at `rel` changed by `patch` (a new tree; the old one is left as it was). */
export function patchZipFile(tree: TreeNode, rel: string, patch: Partial<TreeNode>): TreeNode {
  const [head, ...rest] = rel.split("/").filter(Boolean);
  if (!head || !tree.kids) return tree;
  return {
    ...tree,
    kids: tree.kids.map((k) => (k.name !== head ? k : rest.length === 0 ? (k.kids ? k : { ...k, ...patch }) : patchZipFile(k, rest.join("/"), patch))),
  };
}

/** The zip's pictures folder, at its root (the prototype's `images/`). */
export const PICTURES = "images";

/** File names already in the pictures folder. */
export function pictureNames(tree: TreeNode): Set<string> {
  const folder = tree.kids?.find((k) => k.name === PICTURES && k.kids);
  return new Set((folder?.kids ?? []).map((k) => k.name));
}

/** The tree with a picture added to its pictures folder (made when missing). */
export function withPicture(tree: TreeNode, name: string, url: string): TreeNode {
  const kids = tree.kids ?? [];
  const file: TreeNode = { name, type: "image", url };
  const has = kids.some((k) => k.name === PICTURES && k.kids);
  return {
    ...tree,
    kids: has ? kids.map((k) => (k.name === PICTURES && k.kids ? { ...k, kids: [...k.kids.filter((x) => x.name !== name), file] } : k)) : [...kids, { name: PICTURES, kids: [file] }],
  };
}

/** The tags on the snips in Recents, each once (case-insensitive), in the order first seen. */
export function recentTags(rows: readonly RecentItem[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) if (r.kind === "snip") for (const t of r.tags) if (t.trim() && !seen.has(t.trim().toLowerCase())) seen.set(t.trim().toLowerCase(), t.trim());
  return [...seen.values()];
}
