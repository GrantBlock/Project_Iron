// The views in the center (L04), as the prototype draws them: About (sample signed notice and
// package details), a document as page sheets with Previous / Next and the page count, a model
// (viewport placeholder and parts list; L06 puts the 3D viewer in the viewport) and a note as
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

export function modelView(item: ModelItem): Node[] {
  return [
    el("h1", {}, item.title),
    el("div", { class: "sub" }, "3D model · read only"),
    el("div", { class: "l-viewport" }, icon("model", 96), el("span", { class: "hint" }, "Drag to orbit · scroll to zoom")),
    el("div", { class: "l-parts" }, ...item.parts.map((p) => el("div", { class: "l-part" }, el("span", {}, p.name), el("span", {}, p.bodies)))),
  ];
}

export function noteView(item: NoteItem): Node[] {
  return [el("h1", {}, item.title), el("div", { class: "sub" }, "Note"), el("div", { class: "l-note" }, item.text)];
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
