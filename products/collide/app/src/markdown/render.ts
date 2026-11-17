// Markdown to HTML for the Markdown editor's page (RUN3 T34), with markdown-it (approved).
// No raw HTML from the file (html: false), so a .md file cannot put scripts or styles into the app.
// Images resolve through the zip's files: a link the zip has becomes the picture; anything else shows its
// alt text in a grey box (the file may be missing, and the app never fetches pictures from the network).
import MarkdownIt from "markdown-it";

/** A path in a link (`images/x.png`) to a picture's data URL, or null when the zip does not have it. */
export type Resolve = (path: string) => string | null;

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const esc = md.utils.escapeHtml;

// Tables scroll on their own when they are wider than the page.
md.renderer.rules.table_open = () => '<div class="mdtable"><table>\n';
md.renderer.rules.table_close = () => "</table></div>\n";

md.renderer.rules.image = (tokens, idx, options, env: { resolve?: Resolve }, self) => {
  const t = tokens[idx];
  const src = t.attrGet("src") ?? "";
  const alt = self.renderInlineAsText(t.children ?? [], options, env);
  const url = env.resolve?.(decodeURI(src)) ?? null;
  if (url && /^(data:image\/|blob:)/.test(url)) return `<img src="${esc(url)}" alt="${esc(alt)}">`;
  return `<span class="mdimg-missing" role="img" aria-label="${esc(alt || src)}" title="${esc(src)}">${esc(alt || src)}</span>`;
};

/** The page's HTML. */
export function renderMarkdown(src: string, resolve?: Resolve): string {
  return md.render(src, { resolve });
}

/** The zip-relative key of a link: no leading "./" or "/". */
export const linkKey = (path: string) => path.replace(/^(\.\/|\/)+/, "");
