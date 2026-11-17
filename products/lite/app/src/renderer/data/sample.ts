// The prototype's sample package, built into the app as data (RUN.md: no package format in
// this run). Copied from prototype/exports/P16-lite/index.html (the `P`, `QA` and `SUG`
// variables and the About view's text). The prototype is the source: change it there first.
// L03 uses the package, projects and items (tree, path bar); L04 the pages, parts and note
// text; L05 searches them; L07 uses the canned answers and suggestions.

import type { FileKind } from "../../native/folder";

export type ItemType = "document" | "model" | "note";

/** Where an item opened from disk comes from (L08). Sample items have none. */
export interface DiskSource {
  readonly kind: FileKind;
  /** Relative to the opened folder, "/"-separated. */
  readonly path: string;
  readonly size: number;
  /** Why the file is listed but not opened (other types, too large, unreadable). */
  readonly problem?: string;
}
export type ViewType = "about" | ItemType;

export interface DocumentItem {
  readonly id: string;
  readonly source?: DiskSource;
  readonly type: "document";
  readonly title: string;
  /** Page texts, page 1 first. */
  readonly pages: readonly string[];
}

export interface ModelPart {
  readonly name: string;
  /** As the prototype shows it, e.g. "3 bodies". */
  readonly bodies: string;
}

export interface ModelItem {
  readonly id: string;
  readonly source?: DiskSource;
  readonly type: "model";
  readonly title: string;
  readonly parts: readonly ModelPart[];
}

export interface NoteItem {
  readonly id: string;
  readonly source?: DiskSource;
  readonly type: "note";
  readonly title: string;
  /** Read-only text; paragraphs separated by a blank line. */
  readonly text: string;
}

export type Item = DocumentItem | ModelItem | NoteItem;

/** A project folder in the tree. */
export interface Project {
  /** Shown on About, e.g. "BC-Q-26041". */
  readonly code: string;
  readonly name: string;
  readonly items: readonly Item[];
}

/** The package the window opens (left side head, title bar, About view). */
export const PACKAGE = {
  title: "Site 7332 maintenance package",
  /** The line under the package name on the left side. */
  byline: "[Client or site] · Rev A · built by Block Concepts",
  openedFrom: "Opened from a Builder package. Lite shows it read only.",
  /** RUN.md open question 2 (A): sample text only, no signature check in this run. */
  signedNotice: "Signed by Block Concepts. Every file matches its hash.",
  client: "[Client or site]",
  revision: "A",
  built: "Nov 11, 2026",
  format: "Lite package v0.1",
  contact: "[Contact name and email]",
  readOnlyNote: "Lite never uploads anything from this package and needs no login.",
} as const;

/** "About this package": the first tree row, the path bar on About. */
export const ABOUT_LABEL = "About this package";

/** Sample package content (A, as the prototype). */
export const PROJECTS: readonly Project[] = [
  {
    code: "BC-Q-26041",
    name: "Palletizer retrofit",
    items: [
      {
        id: "d1",
        type: "document",
        title: "Process document, rev 3",
        pages: [
          "Process description. The palletizer builds layers of six cases at 9 s per cycle (A), wraps the pallet and sends it to the outfeed.",
          "Station schedule. 1 Infeed, 2 Inspect, 3 Pick and place, 4 Wrap, 5 Outfeed. Utilities: 480 V, 3 phase, 30 A; compressed air 80 psi.",
          "Sequence of operation. Cases arrive, labels are checked, rejects leave on the reject lane, good cases are picked and placed in layers.",
        ],
      },
      {
        id: "d2",
        type: "document",
        title: "GB-220 gearbox data sheet",
        pages: [
          "GB-220 gearbox. Ratio 20 to 1, rated output torque 220 N·m, service factor 1.4 (A).",
          "Mounting position. Oil volume depends on the mounting position; see the table for the fill quantity and the breather location.",
          "Mounting position. Fill quantities are 1.8 L for the horizontal position (A).",
          "Lubrication. Fill with ISO VG 220 synthetic gear oil. Change the oil every 8,000 operating hours or 12 months, whichever comes first. Check the oil level every 500 hours.",
          "Shaft loads. Maximum radial load 3,200 N at the shaft center. Axial load is limited to 1,100 N.",
          "Ordering information and part numbers.",
        ],
      },
      {
        id: "m1",
        type: "model",
        title: "Palletizer frame v4",
        parts: [
          { name: "Frame", bodies: "1 body" },
          { name: "Transfer axis", bodies: "3 bodies" },
          { name: "Guard door", bodies: "2 bodies" },
          { name: "Gearbox GB-220", bodies: "1 body" },
        ],
      },
      {
        id: "n1",
        type: "note",
        title: "Pneumatic cylinder sizing",
        text: "Cylinder bore sized at 63 mm (A). Check the extend force against the 6 bar supply before ordering.\n\nOpen item: confirm the rod diameter with the vendor.",
      },
    ],
  },
  {
    code: "ENG-RES",
    name: "Engineering resources",
    items: [
      {
        id: "d3",
        type: "document",
        title: "Lockout procedure LOTO-004",
        pages: [
          "Purpose. This procedure covers lockout of stored energy before servicing equipment.",
          "Scope. Applies to all powered equipment on the line, including the gearbox and pneumatic circuit.",
          "Steps. Before servicing the gearbox or changing the oil, apply lockout at the main disconnect and release stored energy at the pneumatic dump valve. Verify zero energy before you open any guard.",
        ],
      },
      {
        id: "m2",
        type: "model",
        title: "Standard guard layout",
        parts: [
          { name: "Guard panel", bodies: "4 bodies" },
          { name: "Door interlock", bodies: "2 bodies" },
        ],
      },
      {
        id: "n2",
        type: "note",
        title: "Handoff log template",
        text: "Date, shift, what changed, what is waiting, who to call.",
      },
    ],
  },
];

/** A source an answer cites: opens `itemId` at `page` (0-based; 0 for notes). */
export interface Source {
  readonly itemId: string;
  readonly page: number;
  /** Source row text after the title, e.g. "p. 4" or "note". */
  readonly label: string;
}

/** A canned Assistant answer. `[n]` in the text is a citation chip for `sources[n - 1]`. */
export interface CannedAnswer {
  readonly keywords: RegExp;
  readonly text: string;
  readonly sources: readonly Source[];
}

/** Sample answers from the package only (A), in the prototype's order: the first match wins. */
export const ANSWERS: readonly CannedAnswer[] = [
  {
    keywords: /oil|lubric|gearbox.*(interval|change)/i,
    text: "Change the GB-220 gearbox oil every 8,000 operating hours or 12 months, whichever comes first, and check the level every 500 hours [1]. Use ISO VG 220 synthetic gear oil [1]. Lock out the machine first [2].",
    sources: [
      { itemId: "d2", page: 3, label: "p. 4" },
      { itemId: "d3", page: 2, label: "p. 3" },
    ],
  },
  {
    // Grant 2026-11-17 (ISSUES.md 1): "servicing" matches too (the prototype's /service/ missed it,
    // so its suggested question got the fallback). "service" itself matches as before.
    keywords: /lock|loto|energy|servic(?:e|ing)/i,
    text: "Apply lockout at the main disconnect, release stored energy at the pneumatic dump valve, and verify zero energy before you open any guard [1].",
    sources: [{ itemId: "d3", page: 2, label: "p. 3" }],
  },
  {
    keywords: /cylinder|bore|pneumatic/i,
    text: "The cylinder bore was sized at 63 mm (A). Check the extend force against the 6 bar supply before ordering, and confirm the rod diameter with the vendor [1].",
    sources: [{ itemId: "n1", page: 0, label: "note" }],
  },
  {
    keywords: /torque|ratio|load|shaft/i,
    text: "The GB-220 has a 20 to 1 ratio and 220 N·m rated output torque [1]. Maximum radial shaft load is 3,200 N and axial load is 1,100 N [2].",
    sources: [
      { itemId: "d2", page: 0, label: "p. 1" },
      { itemId: "d2", page: 4, label: "p. 5" },
    ],
  },
];

export const SUGGESTIONS: readonly string[] = [
  "What is the gearbox oil change interval?",
  "What do I do before servicing the gearbox?",
  "What bore was chosen for the cylinder?",
];

export const ASSISTANT_TEXT = {
  greeting: "I answer from this package only, and everything runs on this computer. Ask about the documents, models or notes.",
  fallback: "I could not find that in this package. I only answer from its documents, models and notes. Try naming a part, a procedure or a document.",
  placeholder: "Ask about this package",
  note: "I answer only from this package and cite the page.",
  /** The prototype answers after this delay (ms). */
  delayMs: 350,
} as const;

/** Every item, in tree order. */
export function allItems(): Item[] {
  return PROJECTS.flatMap((p) => p.items);
}

export function findItem(id: string): Item | undefined {
  return allItems().find((i) => i.id === id);
}

/** The project folder an item is in. */
export function projectOf(id: string): Project | undefined {
  return PROJECTS.find((p) => p.items.some((i) => i.id === id));
}

/** About's Contents line, e.g. "3 documents, 2 models, 2 notes" (counted, as the prototype does). */
export function contentsSummary(): string {
  const n = (t: ItemType) => allItems().filter((i) => i.type === t).length;
  return `${n("document")} documents, ${n("model")} models, ${n("note")} notes`;
}

/** The first canned answer whose keywords match, or undefined (the fallback answer). */
export function cannedAnswer(question: string): CannedAnswer | undefined {
  return ANSWERS.find((a) => a.keywords.test(question));
}
