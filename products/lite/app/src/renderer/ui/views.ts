// The views in the center (L04), as the prototype draws them: About (sample signed notice and
// package details), a document as page sheets with Previous / Next and the page count, a model
// (viewport and parts list; ui/model-view.ts adds the 3D viewer, L06) and a note as
// read-only text. Every text goes in as a text node (L08 will show file names and file text
// from disk here): no innerHTML.
import { PACKAGE, PROJECTS, contentsSummary, type DocumentItem, type Item, type ModelItem, type NoteItem } from "../data/sample";
import { selectedItem, type AppState } from "../state";
import { el, type Child } from "./dom";
import { icon } from "./icons";

/** The view's content for the state: About when nothing is selected. */
export function renderView(s: AppState): Node[] {
  const item = selectedItem(s);
  if (!item) return aboutView();
  return itemView(item, s);
}

function itemView(item: Item, s: AppState): Node[] {
  if (item.type === "document") return documentView(item, s.page, s.highlight);
  if (item.type === "model") return modelView(item);
  return noteView(item);
}

export function aboutView(): Node[] {
  const row = (term: string, value: string) => [el("dt", {}, term), el("dd", {}, value)];
  return [
    el("h1", {}, PACKAGE.title),
    el("div", { class: "sub" }, PACKAGE.openedFrom),
    // RUN.md open question 2 (A): sample text only; there is no signature check in this run.
    el("div", { class: "l-ok" }, el("span", { class: "l-dot" }), el("span", {}, PACKAGE.signedNotice)),
    el(
      "div",
      { class: "l-card" },
      el("span", { class: "de-label" }, "Package"),
      el(
        "dl",
        {},
        ...row("Client or site", PACKAGE.client),
        ...row("Revision", PACKAGE.revision),
        ...row("Built", PACKAGE.built),
        ...row("Format", PACKAGE.format),
        ...row("Contents", contentsSummary()),
        ...row("Contact", PACKAGE.contact),
      ),
    ),
    el("div", { class: "l-card" }, el("span", { class: "de-label" }, "Projects"), el("dl", {}, ...PROJECTS.flatMap((p) => row(p.code, p.name)))),
    el("div", { class: "l-ro" }, PACKAGE.readOnlyNote),
  ];
}

export function documentView(item: DocumentItem, page: number, highlight: string): Node[] {
  const count = item.pages.length;
  return [
    el("h1", {}, item.title),
    el("div", { class: "sub" }, `Document · ${count} pages`),
    el(
      "div",
      { class: "l-pg" },
      el("button", { class: "l-b", id: "pp", type: "button", disabled: page === 0 }, "Previous"),
      el("span", { class: "pn" }, `Page ${page + 1} of ${count}`),
      el("button", { class: "l-b", id: "pn", type: "button", disabled: page === count - 1 }, "Next"),
    ),
    el("div", { class: "l-paper" }, el("h2", {}, item.title), el("p", {}, ...highlighted(item.pages[page] ?? "", highlight))),
  ];
}

/**
 * The model view's frame: the prototype's viewport (placeholder icon and hint) and parts list.
 * ui/model-view.ts puts the 3D viewer in the viewport and makes the parts selectable; the
 * rows are buttons for that, styled as the prototype's rows.
 */
export function modelView(item: ModelItem): Node[] {
  return [
    el("h1", {}, item.title),
    el("div", { class: "sub" }, "3D model · read only"),
    el("div", { class: "l-viewport", "data-state": "loading" }, icon("model", 96), el("span", { class: "hint" }, "Drag to orbit · scroll to zoom")),
    el(
      "div",
      { class: "l-parts" },
      ...item.parts.map((p) => el("button", { class: "l-part", type: "button", "data-part": p.name, "aria-pressed": "false" }, el("span", {}, p.name), el("span", {}, p.bodies))),
    ),
  ];
}

/** A note; from an opened folder also text files (plain read-only text, A) and files Lite lists but does not open. Markdown: ui/markdown-view.ts. */
export function noteView(item: NoteItem): Node[] {
  const src = item.source;
  if (src?.problem) return unopenedView(item.title, src.problem, src.size);
  const sub = src?.kind === "markdown" ? "Markdown · read only" : src?.kind === "text" ? "Text · read only" : "Note";
  return [el("h1", {}, item.title), el("div", { class: "sub" }, sub), el("div", { class: "l-note" }, item.text)];
}

/** A file that is listed but not opened (other types, too large, unreadable). */
export function unopenedView(title: string, reason: string, size: number): Node[] {
  return [el("h1", {}, title), el("div", { class: "sub" }, `File · ${formatSize(size)} · not opened`), el("div", { class: "l-note" }, reason)];
}

/** "512 bytes", "12.3 KB", "4.0 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * `text` split into text nodes and <mark>s around each case-insensitive match of `term` (the
 * prototype's hl()). Only pages that contain the term get marks (ISSUES.md 4).
 */
export function highlighted(text: string, term: string): Child[] {
  return splitMatches(text, term).map((part) => (part.match ? el("mark", {}, part.text) : part.text));
}

export interface TextPart {
  readonly text: string;
  readonly match: boolean;
}

/** Splits `text` at case-insensitive matches of `term` (taken literally). Pure, unit-tested. */
export function splitMatches(text: string, term: string): TextPart[] {
  if (!term) return text ? [{ text, match: false }] : [];
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > at) parts.push({ text: text.slice(at, start), match: false });
    parts.push({ text: m[0], match: true });
    at = start + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), match: false });
  return parts;
}
