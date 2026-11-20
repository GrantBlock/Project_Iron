// The Markdown view (L10, Grant 2026-11-17): a .md file of an opened folder, formatted. The tree
// from markdown/markdown.ts becomes element and text nodes (el(), never innerHTML), so nothing in
// the file can become markup or script. Links show as link text and do not navigate (no href).
// An image shows only if its path resolves to a raster image inside the opened folder; it is read
// through the bridge (the main process checks the path again) into a blob: URL. Otherwise, and
// until it has loaded, its alt text shows.
import type { NoteItem } from "../data/sample";
import { imageType, parseMarkdown, resolveInside, type MdNode } from "../markdown/markdown";
import { el } from "./dom";
import type { ViewHandle } from "./model-view";

/** Reads a file of the opened folder by its relative path. */
export type FolderReader = (path: string) => Promise<Uint8Array>;

export function createMarkdownView(item: NoteItem, readFile?: FolderReader): ViewHandle {
  const urls: string[] = [];
  let disposed = false;
  const mdPath = item.source?.path ?? "";

  const image = (src: string, alt: string): Node => {
    const shown = el("span", { class: "l-md-alt", title: src }, alt || "Image");
    const path = resolveInside(mdPath, src);
    const type = path ? imageType(path) : null;
    if (!path || !type || !readFile) return shown;
    readFile(path)
      .then((bytes) => {
        if (disposed) return;
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
        urls.push(url);
        const img = el("img", { class: "l-md-img", src: url, alt });
        img.addEventListener("error", () => img.replaceWith(shown), { once: true });
        shown.replaceWith(img);
      })
      .catch(() => undefined); // not readable (outside the folder, too large, ...): the alt text stays
    return shown;
  };

  const nodes = [
    el("h1", {}, item.title),
    el("div", { class: "sub" }, "Markdown · read only"),
    el("div", { class: "l-md" }, ...markdownNodes(parseMarkdown(item.markdown ?? item.text), image)),
  ];
  return {
    nodes,
    update() {},
    dispose() {
      disposed = true;
      for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    },
  };
}

/** DOM nodes for a Markdown tree; `image` makes each image's node. */
export function markdownNodes(tree: readonly MdNode[], image: (src: string, alt: string) => Node): Node[] {
  return tree.map((n): Node => {
    switch (n.kind) {
      case "text":
        return document.createTextNode(n.text);
      case "image":
        return image(n.src, n.alt);
      case "link":
        return el("a", { class: "l-md-link", title: n.href ? `${n.href} (links do not open in Lite)` : undefined }, ...markdownNodes(n.children, image));
      case "element":
        return el(n.tag, { ...n.attrs }, ...markdownNodes(n.children, image));
    }
  });
}
