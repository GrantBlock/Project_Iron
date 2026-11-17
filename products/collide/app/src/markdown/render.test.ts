import { describe, expect, it } from "vitest";
import { linkKey, renderMarkdown } from "./render";
import { fitPage, PAGE_SIDE, PAGE_TOP, PAGE_W, scrollPage, zoomPage } from "./page";
import { screenToImage } from "../editor/viewport";

describe("Markdown rendering (RUN3 T34, markdown-it)", () => {
  it("renders headings, lists and tables; a table scrolls in its own box", () => {
    const html = renderMarkdown("# T\n\n- a\n1. b\n\n| Item | Owner |\n| --- | --- |\n| x | y |\n");
    expect(html).toContain("<h1>T</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toMatch(/<div class="mdtable"><table>[\s\S]*<th>Owner<\/th>[\s\S]*<\/table><\/div>/);
  });

  it("never passes raw HTML from the file through", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });

  it("a picture the zip has shows; anything else is a grey box with its alt text", () => {
    const url = "data:image/png;base64,AAAA";
    const resolve = (p: string) => (p === "images/a.png" ? url : null);
    expect(renderMarkdown("![Pasted image](images/a.png)", resolve)).toContain(`<img src="${url}" alt="Pasted image">`);
    const missing = renderMarkdown("![Plan](images/none.png)", resolve);
    expect(missing).toContain('role="img" aria-label="Plan"');
    expect(missing).not.toContain("<img");
    // Only pictures: a resolver giving anything else is not used.
    expect(renderMarkdown("![x](a.png)", () => "https://example.invalid/a.png")).not.toContain("<img");
  });

  it("link keys drop a leading ./ or /", () => {
    expect(linkKey("./images/a.png")).toBe("images/a.png");
    expect(linkKey("/images/a.png")).toBe("images/a.png");
  });
});

describe("the Markdown page's view (RUN3 T34)", () => {
  const pane = { width: 872, height: 690 };

  it("Fit centres the page with room for bubbles beside and above it, never above 100%", () => {
    const v = fitPage(pane);
    expect(v.scale).toBeCloseTo((pane.width - 44) / (PAGE_W + 2 * PAGE_SIDE), 6);
    expect(v.x).toBeCloseTo((pane.width - PAGE_W * v.scale) / 2, 6);
    expect(v.y).toBeCloseTo(PAGE_TOP * v.scale, 6);
    expect(fitPage({ width: 4000, height: 900 }).scale).toBe(1);
  });

  it("Ctrl + wheel zooms around the cursor: the page pixel under it stays", () => {
    const v = fitPage(pane);
    const at = { x: 300, y: 400 };
    const before = screenToImage(v, at);
    const z = zoomPage(v, at, 5);
    expect(z.scale).toBeCloseTo(v.scale * 1.1 ** 5, 6);
    const after = screenToImage(z, at);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomPage(v, at, 100).scale).toBe(4);
    expect(zoomPage(v, at, -100).scale).toBe(0.25);
  });

  it("the wheel scrolls the page between its top margin and its end", () => {
    const v = fitPage(pane);
    expect(scrollPage(v, pane, 2000, 0, -50).y).toBe(v.y); // already at the top
    expect(scrollPage(v, pane, 2000, 0, 100).y).toBeCloseTo(v.y - 100, 6);
    const end = scrollPage(v, pane, 2000, 0, 1e6);
    expect(end.y).toBeCloseTo(pane.height - (2000 + PAGE_TOP) * v.scale, 6);
    // A page shorter than the pane does not scroll.
    expect(scrollPage(v, pane, 100, 0, 300).y).toBe(v.y);
    // Across only when the page and its margins are wider than the pane.
    expect(scrollPage(v, pane, 2000, 50, 0).x).toBe(v.x);
    const wide = zoomPage(v, { x: 0, y: 0 }, 10);
    expect(scrollPage(wide, pane, 2000, 50, 0).x).toBeLessThan(wide.x);
  });
});
