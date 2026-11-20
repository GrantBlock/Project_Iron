// T49: the Markdown text tools on a CodeMirror selection. text.ts (pure, unchanged) stays the source of every edit;
// this adapter turns its result into one CodeMirror transaction: the smallest change that gives text.ts's text,
// the selection text.ts puts back, and its own undo step (isolated from typing around it).
import { isolateHistory } from "@codemirror/commands";
import { Transaction, type EditorState, type TransactionSpec } from "@codemirror/state";
import { bold, insertImageLink, insertTable, link, linePrefix, type TextEdit } from "./text";

/** The smallest replacement that turns `a` into `b` (common start and end kept). */
function change(a: string, b: string): { from: number; to: number; insert: string } {
  const m = Math.min(a.length, b.length);
  let s = 0;
  while (s < m && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let e = 0;
  while (e < m - s && a.charCodeAt(a.length - 1 - e) === b.charCodeAt(b.length - 1 - e)) e++;
  return { from: s, to: a.length - e, insert: b.slice(s, b.length - e) };
}

/** text.ts's edit of the main selection as one transaction. */
export function toolSpec(state: EditorState, fn: (text: string, start: number, end: number) => TextEdit, keepLines = false): TransactionSpec {
  const text = state.doc.toString();
  const { from, to } = state.selection.main;
  const r = fn(text, from, to);
  // (A) A line tool on a selection keeps the changed lines selected (text.ts puts the caret after them), so the same
  // tool again takes its mark off every line. With only a caret, the caret goes where text.ts puts it.
  const lineStart = state.doc.lineAt(from).from;
  const selection = keepLines && from !== to ? { anchor: lineStart, head: r.end } : { anchor: r.start, head: r.end };
  return {
    changes: change(text, r.text),
    selection,
    scrollIntoView: true,
    annotations: [Transaction.userEvent.of("input.tool"), isolateHistory.of("full")],
  };
}

/** Heading 1..6 on the selected lines; 0 = Normal text (the mark comes off). */
export const headingTool = (state: EditorState, level: number) =>
  toolSpec(state, (t, s, e) => linePrefix(t, s, e, level <= 0 ? "" : "#".repeat(Math.min(6, level)) + " ", true), true);
export const listTool = (state: EditorState) => toolSpec(state, (t, s, e) => linePrefix(t, s, e, "- "), true);
export const numListTool = (state: EditorState) => toolSpec(state, (t, s, e) => linePrefix(t, s, e, "1. "), true);
export const labelTool = (state: EditorState) => toolSpec(state, (t, s, e) => linePrefix(t, s, e, "**Label:** "), true);
export const tableTool = (state: EditorState) => toolSpec(state, insertTable);
export const boldTool = (state: EditorState) => toolSpec(state, bold);
export const linkTool = (state: EditorState) => toolSpec(state, link);

/** An image link on its own line at the caret; `atEnd`: at the end of the file (the editor never had a caret). */
export const imageLinkTool = (state: EditorState, line: string, opts: { atEnd?: boolean } = {}) =>
  toolSpec(state, (t, s, e) => (opts.atEnd ? insertImageLink(t, null, null, line) : insertImageLink(t, s, e, line)));
