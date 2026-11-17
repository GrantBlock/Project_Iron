import { describe, expect, it } from "vitest";
import { imageType, markdownText, parseMarkdown, resolveInside, type MdNode } from "./markdown";

/** A compact view of the tree: tag(children) / "text" / link / image. */
function show(nodes: readonly MdNode[]): string {
  return nodes
    .map((n) => {
      if (n.kind === "text") return JSON.stringify(n.text);
      if (n.kind === "image") return `img[${n.src}|${n.alt}]`;
      if (n.kind === "link") return `link[${n.href}](${show(n.children)})`;
      const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}=${v}`).join("");
      return `${n.tag}${attrs}(${show(n.children)})`;
    })
    .join(" ");
}

describe("parseMarkdown", () => {
  it("headings (shifted down one level), paragraphs, emphasis and lists", () => {
    const tree = parseMarkdown("# Guide\n\nCheck the **sprocket** and *chain*.\n\n- one\n- two `x`\n\n3. three\n4. four\n");
    expect(show(tree)).toBe(
      'h2("Guide") p("Check the " strong("sprocket") " and " em("chain") ".") ul(li("one") li("two " code("x"))) ol start=3(li("three") li("four"))',
    );
  });

  it("raw HTML stays text, never an element", () => {
    const tree = parseMarkdown("<script>document.title='pwned'</script><img src=x onerror=alert(1)>\n\nA <b>b</b> c");
    expect(show(tree)).toBe(`p("<script>document.title='pwned'</script><img src=x onerror=alert(1)>") p("A <b>b</b> c")`);
    const tags = JSON.stringify(tree).match(/"tag":"(\w+)"/g);
    expect(tags).toEqual(['"tag":"p"', '"tag":"p"']);
  });

  it("links keep their text; dangerous URLs are not links at all; no linkify", () => {
    expect(show(parseMarkdown("[site](https://example.com) and https://example.com"))).toBe('p(link[https://example.com]("site") " and https://example.com")');
    expect(show(parseMarkdown("[x](javascript:alert(1))"))).toBe('p("[x](javascript:alert(1))")');
  });

  it("images, code, quotes, rules, tables with alignment", () => {
    expect(show(parseMarkdown("![A pump](img/pump.png)"))).toBe("p(img[img/pump.png|A pump])");
    expect(show(parseMarkdown("```js\nlet a = '<b>';\n```"))).toBe(`pre(code("let a = '<b>';\\n"))`);
    expect(show(parseMarkdown("> note\n\n---"))).toBe('blockquote(p("note")) hr()');
    expect(show(parseMarkdown("| a | b |\n|:-:|--:|\n| 1 | 2 |"))).toBe(
      'table(thead(tr(th data-align=center("a") th data-align=right("b"))) tbody(tr(td data-align=center("1") td data-align=right("2"))))',
    );
    expect(show(parseMarkdown("a  \nb\nc"))).toBe('p("a" br() "b" "\\n" "c")');
  });

  it("only allowed tags ever come out", () => {
    const allowed = new Set(["p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "pre", "code", "br", "strong", "em", "s", "table", "thead", "tbody", "tr", "th", "td"]);
    const src = "# a\n###### b\n\n~~s~~ <iframe src=x></iframe>\n\n<div onclick=x>d</div>\n\n- [ ] task\n\n[ref]: http://x";
    const walk = (ns: readonly MdNode[]): void => ns.forEach((n) => n.kind === "element" ? (expect(allowed.has(n.tag), n.tag).toBe(true), walk(n.children)) : n.kind === "link" && walk(n.children));
    walk(parseMarkdown(src));
  });
});

describe("markdownText (what search looks through)", () => {
  it("the visible text, blocks on their own lines", () => {
    expect(markdownText("# Guide\n\nCheck the **sprocket** alignment.\n\n- one\n- two\n\n![Pump](p.png)")).toBe("Guide\nCheck the sprocket alignment.\none\ntwo\nPump");
    expect(markdownText("<script>x</script>")).toBe("<script>x</script>");
  });
});

describe("resolveInside (images)", () => {
  it("resolves against the Markdown file's folder", () => {
    expect(resolveInside("guide.md", "pump.png")).toBe("pump.png");
    expect(resolveInside("docs/guide.md", "./img/pump.png")).toBe("docs/img/pump.png");
    expect(resolveInside("docs/guide.md", "../pump.png?x=1#y")).toBe("pump.png");
    expect(resolveInside("docs/guide.md", "img/a%20b.png")).toBe("docs/img/a b.png");
  });

  it("refuses anything outside the folder or not a relative path", () => {
    for (const src of ["../pump.png", "docs/../../x.png", "/etc/x.png", "\\\\server\\share\\x.png", "C:\\x.png", "c:/x.png", "file:///x.png", "https://example.com/x.png", "//example.com/x.png", "data:image/png;base64,AAAA", "img\\x.png", "%2", "", ".", "img/.."]) {
      expect(resolveInside("guide.md", src), src).toBeNull();
    }
  });

  it("image types: raster only", () => {
    expect(imageType("a/b.PNG")).toBe("image/png");
    expect(imageType("x.jpeg")).toBe("image/jpeg");
    expect(imageType("x.svg")).toBeNull();
    expect(imageType("x")).toBeNull();
  });
});
