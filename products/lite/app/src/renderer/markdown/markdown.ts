// Markdown (L10, Grant 2026-11-17, ISSUES.md 9): markdown-it parses, this module turns its tokens
// into a small tree of allowed elements, and ui/markdown-view.ts builds the DOM from that tree
// with element and text nodes. No HTML string is ever produced or parsed:
// - raw HTML is off (`html: false`): `<script>` and other tags stay visible text, never markup;
// - linkify is off; links keep their text but are not navigable (no href: Lite is offline);
// - images are kept as { src, alt }; the view shows one only if it resolves to a file inside the
//   opened folder (resolveInside), otherwise its alt text;
// - only the tags below are produced; anything else becomes its text.
// Pure (no DOM), unit-tested in Node.
import MarkdownIt, { type Token } from "markdown-it";

/** The elements Markdown may produce. Headings are shifted down one level (the view's title is the h1). */
export type MdTag =
  | "p" | "h2" | "h3" | "h4" | "h5" | "h6" | "ul" | "ol" | "li" | "blockquote" | "hr" | "pre" | "code" | "br"
  | "strong" | "em" | "s" | "table" | "thead" | "tbody" | "tr" | "th" | "td";

export type MdNode =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "element"; readonly tag: MdTag; readonly attrs: Readonly<Record<string, string>>; readonly children: readonly MdNode[] }
  /** A link: its text only, never navigable. `href` is kept for the tooltip. */
  | { readonly kind: "link"; readonly href: string; readonly children: readonly MdNode[] }
  | { readonly kind: "image"; readonly src: string; readonly alt: string };

const md = new MarkdownIt("default", { html: false, linkify: false, typographer: false, breaks: false });

/** Parses Markdown into the allowed tree. */
export function parseMarkdown(source: string): MdNode[] {
  return convert(md.parse(source, {}));
}

type Frame = { children: MdNode[] };

const BLOCK_TAGS: Record<string, MdTag> = {
  paragraph_open: "p",
  bullet_list_open: "ul",
  ordered_list_open: "ol",
  list_item_open: "li",
  blockquote_open: "blockquote",
  table_open: "table",
  thead_open: "thead",
  tbody_open: "tbody",
  tr_open: "tr",
  th_open: "th",
  td_open: "td",
  strong_open: "strong",
  em_open: "em",
  s_open: "s",
};

function convert(tokens: readonly Token[]): MdNode[] {
  const root: Frame = { children: [] };
  const stack: Frame[] = [root];
  const top = () => stack[stack.length - 1];
  for (const t of tokens) {
    if (t.nesting === 1) {
      const frame = open(t);
      if (frame.node) top().children.push(frame.node);
      // A hidden or unknown opening (e.g. the paragraphs of a tight list) adds no element: its
      // children go to the parent.
      stack.push(frame.node && "children" in frame.node ? (frame.node as unknown as Frame) : { children: top().children });
    } else if (t.nesting === -1) {
      if (stack.length > 1) stack.pop();
    } else {
      top().children.push(...leaf(t));
    }
  }
  return root.children;
}

/** A token attribute as a string ("" when absent). */
const attr = (t: Token, name: string): string => String(t.attrGet(name) ?? "");

function element(tag: MdTag, attrs: Record<string, string> = {}, children: MdNode[] = []): MdNode {
  return { kind: "element", tag, attrs, children };
}

function open(t: Token): { node: MdNode | null } {
  if (t.hidden) return { node: null };
  if (t.type === "heading_open") {
    const level = Math.min(Number(t.tag.slice(1)) + 1, 6);
    return { node: element(`h${level}` as MdTag) };
  }
  if (t.type === "link_open") return { node: { kind: "link", href: attr(t, "href"), children: [] } };
  const tag = BLOCK_TAGS[t.type];
  if (!tag) return { node: null };
  const attrs: Record<string, string> = {};
  if (tag === "ol") {
    const start = Number(attr(t, "start") || 1);
    if (Number.isInteger(start) && start !== 1) attrs.start = String(start);
  }
  if (tag === "th" || tag === "td") {
    const align = /text-align:(left|center|right)/.exec(attr(t, "style"))?.[1];
    if (align) attrs["data-align"] = align;
  }
  return { node: element(tag, attrs) };
}

function leaf(t: Token): MdNode[] {
  switch (t.type) {
    case "inline":
      return convert(t.children ?? []);
    case "text":
      return t.content ? [{ kind: "text", text: t.content }] : [];
    case "softbreak":
      return [{ kind: "text", text: "\n" }];
    case "hardbreak":
      return [element("br")];
    case "code_inline":
      return [element("code", {}, [{ kind: "text", text: t.content }])];
    case "fence":
    case "code_block":
      return [element("pre", {}, [element("code", {}, [{ kind: "text", text: t.content }])])];
    case "hr":
      return [element("hr")];
    case "image":
      return [{ kind: "image", src: attr(t, "src"), alt: plainText(convert(t.children ?? [])) }];
    default:
      // html_block / html_inline cannot appear with html:false; anything unknown shows as text.
      return t.content ? [{ kind: "text", text: t.content }] : [];
  }
}

const BLOCKS = new Set<MdTag>(["p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "pre", "table", "tr", "br"]);

/** The visible text of a tree (images by their alt text), blocks on their own lines: what search looks through. */
export function plainText(nodes: readonly MdNode[]): string {
  let out = "";
  const walk = (n: MdNode) => {
    if (n.kind === "text") out += n.text;
    else if (n.kind === "image") out += n.alt;
    else {
      const block = n.kind === "element" && BLOCKS.has(n.tag);
      if (block && out && !out.endsWith("\n")) out += "\n";
      n.children.forEach(walk);
      if (n.kind === "element" && (n.tag === "th" || n.tag === "td")) out += " ";
      if (block && !out.endsWith("\n")) out += "\n";
    }
  };
  nodes.forEach(walk);
  return out.trim();
}

/** The visible text of Markdown source. */
export function markdownText(source: string): string {
  return plainText(parseMarkdown(source));
}

/**
 * An image's `src` as a path inside the opened folder, relative to its root, or null: resolved
 * against the Markdown file's folder; URLs with a scheme (http:, data:, file:, ...), absolute
 * and protocol-relative paths, and paths that climb out of the folder give null. The main
 * process checks the path again before it reads anything (src/native/folder.ts).
 */
export function resolveInside(markdownPath: string, src: string): string | null {
  let s = src.trim();
  if (!s || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("/") || s.startsWith("\\")) return null;
  s = s.replace(/[?#].*$/, "");
  try {
    s = decodeURIComponent(s);
  } catch {
    return null;
  }
  if (s.includes("\\") || s.includes("\0")) return null;
  const parts = markdownPath.split("/").slice(0, -1);
  for (const seg of s.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.length ? parts.join("/") : null;
}

/** Image types the Markdown view shows (raster only), by extension. */
export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** The MIME type of an image path, or null if Lite does not show that type. */
export function imageType(path: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "";
  return IMAGE_TYPES[ext] ?? null;
}
