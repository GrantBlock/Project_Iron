// A PDF from an opened folder (L08): pages drawn by pdf.js on a canvas in the prototype's page
// sheet, with the same Previous / Next and "Page x of y" as the sample documents (ui/center.ts
// turns the pages). Search finds PDF text (search.ts); the page itself has no highlights (A).
import type { DocumentItem } from "../data/sample";
import { openPdf } from "../pdf/pdf";
import type { AppState } from "../state";
import { el } from "./dom";
import type { ViewHandle } from "./model-view";

type Doc = Awaited<ReturnType<typeof openPdf>>;

export function createPdfView(item: DocumentItem, read: () => Promise<Uint8Array>): ViewHandle {
  const count = item.pages.length;
  const prev = el("button", { class: "l-b", id: "pp", type: "button", disabled: true }, "Previous");
  const next = el("button", { class: "l-b", id: "pn", type: "button", disabled: count <= 1 }, "Next");
  const label = el("span", { class: "pn" }, `Page 1 of ${count}`);
  const canvas = el("canvas", { "aria-label": `${item.title}, page 1` });
  const sheet = el("div", { class: "l-paper l-pdf", "data-state": "loading" }, canvas);
  const nodes = [el("h1", {}, item.title), el("div", { class: "sub" }, `PDF · ${count} pages`), el("div", { class: "l-pg" }, prev, label, next), sheet];

  let doc: Doc | null = null;
  let disposed = false;
  let page = 0;
  let drawing: { cancel(): void } | null = null;

  const draw = async () => {
    if (!doc || disposed) return;
    drawing?.cancel();
    const n = page;
    const p = await doc.getPage(n + 1);
    if (disposed || n !== page) return;
    const base = p.getViewport({ scale: 1 });
    const width = Math.max(sheet.clientWidth, 320);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = p.getViewport({ scale: (width / base.width) * ratio });
    const target = el("canvas", { "aria-label": `${item.title}, page ${n + 1}` });
    target.width = Math.floor(viewport.width);
    target.height = Math.floor(viewport.height);
    const task = p.render({ canvasContext: target.getContext("2d")!, viewport });
    drawing = task;
    try {
      await task.promise;
    } catch {
      return; // cancelled by a newer page turn
    }
    if (disposed || n !== page) return;
    sheet.replaceChildren(target);
    sheet.dataset.state = "ready";
    sheet.dataset.page = String(n + 1);
  };

  void (async () => {
    try {
      const opened = await openPdf(await read());
      if (disposed) return void opened.destroy();
      doc = opened;
      await draw();
    } catch (e) {
      if (disposed) return;
      sheet.dataset.state = "error";
      sheet.replaceChildren(el("p", { class: "l-pdf-error" }, "Lite could not show this PDF."));
      console.warn("[lite] PDF:", e);
    }
  })();

  return {
    nodes,
    update(s: AppState) {
      if (s.page === page) return;
      page = Math.min(Math.max(s.page, 0), count - 1);
      prev.disabled = page === 0;
      next.disabled = page === count - 1;
      label.textContent = `Page ${page + 1} of ${count}`;
      sheet.dataset.state = "loading";
      void draw();
    },
    dispose() {
      disposed = true;
      drawing?.cancel();
      void doc?.destroy();
      doc = null;
    },
  };
}
