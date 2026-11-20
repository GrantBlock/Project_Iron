// T49 (tests first, Lydia): the Markdown text tools act on a CodeMirror selection. text.ts (pure, tested in text.test.ts) stays the
// source of the edits; `src/markdown/cmTools.ts` is the adapter the Coder writes. Assumed API, all from an EditorState to a
// TransactionSpec (apply with `state.update(spec).state`); the new doc and the main selection must equal what text.ts returns:
//   headingTool(state, level: 0..6)   0 = Normal text      listTool(state)      tableTool(state)
//   labelTool(state)                  numListTool(state)   boldTool(state)      linkTool(state)
//   imageLinkTool(state, line: string, opts?: { atEnd?: boolean }): the image link line at the caret, or at the end of the file with atEnd
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { boldTool, headingTool, imageLinkTool, labelTool, linkTool, listTool, numListTool, tableTool } from "./cmTools";
import { bold, insertImageLink, insertTable, link, linePrefix, TABLE } from "./text";

const make = (doc: string, anchor: number, head = anchor) => EditorState.create({ doc, selection: { anchor, head } });
const run = (s: EditorState, spec: ReturnType<typeof boldTool>) => s.update(spec).state;
const sel = (s: EditorState) => [s.selection.main.from, s.selection.main.to];
const SRC = "# Title\n\nIntro\n- Left: a\n- Centre: b\n- Right: c\n";
const at = (text: string, line: number) => text.split("\n").slice(0, line).join("\n").length + (line ? 1 : 0);

describe("CodeMirror text tools (T49)", () => {
  it("Heading puts the mark on the caret's line and replaces the old one; Normal text takes it off", () => {
    const s3 = run(make(SRC, at(SRC, 2) + 2), headingTool(make(SRC, at(SRC, 2) + 2), 3));
    expect(s3.doc.line(3).text).toBe("### Intro");
    const s2 = run(s3, headingTool(s3, 2));
    expect(s2.doc.line(3).text).toBe("## Intro");
    expect(run(s2, headingTool(s2, 0)).doc.line(3).text).toBe("Intro");
    const want = linePrefix(SRC, at(SRC, 2) + 2, at(SRC, 2) + 2, "### ", true);
    expect(s3.doc.toString()).toBe(want.text);
    expect(sel(s3)).toEqual([want.start, want.end]);
  });

  it("List, Num list and Label work on every selected line, as text.ts does", () => {
    const from = at(SRC, 3);
    const to = at(SRC, 5) + 3;
    const s0 = make(SRC, from, to);
    const num = run(s0, numListTool(s0));
    expect(num.doc.toString().split("\n").slice(3, 6)).toEqual(["1. Left: a", "2. Centre: b", "3. Right: c"]);
    expect(num.doc.toString()).toBe(linePrefix(SRC, from, to, "1. ").text);
    const list = run(make("a\nb\n", 0, 3), listTool(make("a\nb\n", 0, 3)));
    expect(list.doc.toString()).toBe("- a\n- b\n");
    const off = run(list, listTool(list));
    expect(off.doc.toString()).toBe("a\nb\n");
    const lab = make("Status: PASS", 3);
    expect(run(lab, labelTool(lab)).doc.toString()).toBe("**Label:** Status: PASS");
  });

  it("Table goes in on its own lines at the caret, caret after it", () => {
    const s0 = make("Intro", 5);
    const s = run(s0, tableTool(s0));
    expect(s.doc.toString()).toBe(insertTable("Intro", 5, 5).text);
    expect(s.doc.toString()).toContain(TABLE);
    expect(sel(s)[0]).toBe(s.doc.length);
  });

  it("Bold wraps the selection; with no selection the caret goes between the marks", () => {
    const s0 = make("make this bold", 5, 9);
    const s = run(s0, boldTool(s0));
    expect(s.doc.toString()).toBe("make **this** bold");
    expect(sel(s)).toEqual([bold("make this bold", 5, 9).start, bold("make this bold", 5, 9).end]);
    const e0 = make("x", 1);
    const e = run(e0, boldTool(e0));
    expect(e.doc.toString()).toBe("x****");
    expect(sel(e)).toEqual([3, 3]);
  });

  it("Link makes [text](url) from the selection and selects the url to type over", () => {
    const s0 = make("see docs here", 4, 8);
    const s = run(s0, linkTool(s0));
    expect(s.doc.toString()).toBe("see [docs](url) here");
    expect(sel(s)).toEqual([link("see docs here", 4, 8).start, link("see docs here", 4, 8).end]);
    expect(s.sliceDoc(sel(s)[0], sel(s)[1])).toBe("url");
  });

  it("a tool is one undoable change (it can be undone in a single history step)", () => {
    const s0 = make("abc", 0, 3);
    const spec = boldTool(s0);
    const tr = s0.update(spec);
    // One transaction, so one undo step; it carries a user event for the history.
    expect(tr.docChanged).toBe(true);
    expect(tr.state.doc.toString()).toBe("**abc**");
  });

  it("the image link goes at the caret on its own line; with no caret yet, at the end of the file", () => {
    const line = "![pic](images/pic.png)";
    const mid = make("One\n\nTwo\n", 3);
    expect(run(mid, imageLinkTool(mid, line)).doc.toString()).toBe(insertImageLink("One\n\nTwo\n", 3, 3, line).text);
    const end = make("One\n\nTwo\n", 0);
    // The editor never focused: the caret is still the default 0 and the page asks for the end instead.
    expect(run(end, imageLinkTool(end, line, { atEnd: true })).doc.toString()).toBe(insertImageLink("One\n\nTwo\n", null, null, line).text);
  });
});
