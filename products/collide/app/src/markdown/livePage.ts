// T49: the CodeMirror 6 setup of the one live Markdown page. The Markdown marks stay in the text and on screen,
// dimmed (`.md-mark`); headings (line classes `md-h1`..`md-h6`), bold (`.md-strong`), italic (`.md-em`), code
// (`.md-code`, code blocks `md-codeblock`), links (`.md-link`), block quotes (`md-quote`) and tables (`md-table`) are
// styled in place. A picture link shows its picture under its line (from the zip only, as render.ts does).
// The look is in markdown.css (design-system tokens).
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { Facet, RangeSetBuilder, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { renderMarkdown, type Resolve } from "./render";

/** Syntax nodes that are Markdown marks. */
const MARKS = new Set(["HeaderMark", "EmphasisMark", "CodeMark", "ListMark", "QuoteMark", "LinkMark", "TableDelimiter", "CodeInfo", "StrikethroughMark", "TaskMarker", "HorizontalRule"]);
/** Syntax nodes styled across their text. */
const SPANS: Record<string, string> = { StrongEmphasis: "md-strong", Emphasis: "md-em", InlineCode: "md-code", Link: "md-link", Image: "md-link", URL: "md-url", Strikethrough: "md-strike" };
/** Syntax nodes that style each of their lines. */
const LINES: Record<string, string> = {
  ATXHeading1: "md-h1", ATXHeading2: "md-h2", ATXHeading3: "md-h3", ATXHeading4: "md-h4", ATXHeading5: "md-h5", ATXHeading6: "md-h6",
  SetextHeading1: "md-h1", SetextHeading2: "md-h2",
  FencedCode: "md-codeblock", CodeBlock: "md-codeblock", Blockquote: "md-quote", Table: "md-table", HorizontalRule: "md-hr",
};

const markDeco = Decoration.mark({ class: "md-mark" });
const spanDeco: Record<string, Decoration> = Object.fromEntries(Object.entries(SPANS).map(([k, c]) => [k, Decoration.mark({ class: c })]));
const lineDeco: Record<string, Decoration> = Object.fromEntries([...new Set(Object.values(LINES))].map((c) => [c, Decoration.line({ class: c })]));

function styles(view: EditorView): DecorationSet {
  const out: Range<Decoration>[] = [];
  const { state } = view;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (n) => {
        if (n.from === n.to) return;
        if (MARKS.has(n.name)) out.push(markDeco.range(n.from, n.to));
        const span = spanDeco[n.name];
        if (span) out.push(span.range(n.from, n.to));
        const line = LINES[n.name];
        if (line) {
          for (let l = state.doc.lineAt(n.from); ; l = state.doc.line(l.number + 1)) {
            out.push(lineDeco[line].range(l.from));
            if (l.to >= n.to || l.number >= state.doc.lines) break;
          }
        }
      },
    });
  }
  return Decoration.set(out, true);
}

const styling = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = styles(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = styles(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/** Where the page's picture links resolve (the zip's files). */
export const resolveFacet = Facet.define<Resolve, Resolve | null>({ combine: (v) => v[v.length - 1] ?? null });

/** A picture under its link's line: markdown-it's own image rule, so the page shows only the zip's pictures. */
class PictureWidget extends WidgetType {
  constructor(readonly html: string) {
    super();
  }
  eq(o: PictureWidget) {
    return o.html === this.html;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "md-picture";
    el.innerHTML = this.html; // markdown-it with html: false: an <img> of a data/blob URL, or the missing-picture box
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

const PICTURE = /!\[[^\]\n]*\]\([^)\n]+\)/g;

function pictures(state: EditorState): DecorationSet {
  const resolve = state.facet(resolveFacet) ?? undefined;
  const b = new RangeSetBuilder<Decoration>();
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const found = line.text.match(PICTURE);
    if (!found) continue;
    const html = found.map((m) => renderMarkdown(m, resolve).replace(/^<p>|<\/p>\s*$/g, "")).join("");
    b.add(line.to, line.to, Decoration.widget({ widget: new PictureWidget(html), block: true, side: 1 }));
  }
  return b.finish();
}

const pictureField = StateField.define<DecorationSet>({
  create: pictures,
  update: (deco, tr) => (tr.docChanged || tr.startState.facet(resolveFacet) !== tr.state.facet(resolveFacet) ? pictures(tr.state) : deco),
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * (A) The whole page is drawn, not only the part in view: the page sits under the markup canvas (transformed, in a
 * pane that clips it), callouts are placed on any of it, and every line must be in the DOM for the page's height
 * and its picture. CodeMirror limits drawing to the visible part except while printing; this keeps that switch on.
 */
const wholePage = ViewPlugin.define((view) => {
  const vs = (view as unknown as { viewState?: object }).viewState;
  if (vs) Object.defineProperty(vs, "printing", { configurable: true, get: () => true, set: () => {} });
  view.requestMeasure();
  return {};
});

/** The language, the styling and the pictures of the live page. */
export function livePage(): Extension {
  return [markdown({ base: markdownLanguage, addKeymap: false, completeHTMLTags: false, pasteURLAsLink: false }), styling, pictureField, wholePage, EditorView.lineWrapping];
}
