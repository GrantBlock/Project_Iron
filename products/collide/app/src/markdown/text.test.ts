import { describe, expect, it } from "vitest";
import { bold, imageLink, insertImageLink, insertTable, link, linePrefix, pastedName, TABLE } from "./text";

const at = (text: string, line: number) => text.split("\n").slice(0, line).join("\n").length + (line ? 1 : 0);

describe("Markdown text tools (RUN3 T34)", () => {
  const src = "# Title\n\nIntro\n- Left: a\n- Centre: b\n- Right: c\n";

  it("a heading goes on the cursor's line and replaces any mark it had; Normal text takes it off", () => {
    const h3 = linePrefix(src, at(src, 2), at(src, 2), "### ", true);
    expect(h3.text.split("\n")[2]).toBe("### Intro");
    const again = linePrefix(h3.text, at(h3.text, 2) + 2, at(h3.text, 2) + 2, "## ", true);
    expect(again.text.split("\n")[2]).toBe("## Intro");
    expect(linePrefix(again.text, at(again.text, 2), at(again.text, 2), "", true).text.split("\n")[2]).toBe("Intro");
    // The cursor ends after the changed line.
    expect(h3.start).toBe(at(h3.text, 2) + "### Intro".length);
  });

  it("Num list numbers the selected lines; Label then goes on the line the selection ends in", () => {
    const start = at(src, 3);
    const end = at(src, 5) + 3;
    const num = linePrefix(src, start, end, "1. ");
    expect(num.text.split("\n").slice(3, 6)).toEqual(["1. Left: a", "2. Centre: b", "3. Right: c"]);
    const label = linePrefix(num.text, num.start, num.end, "**Label:** ");
    expect(label.text.split("\n").slice(3, 6)).toEqual(["1. Left: a", "2. Centre: b", "**Label:** Right: c"]);
  });

  it("a list mark on every selected line toggles off", () => {
    const off = linePrefix(src, at(src, 3), at(src, 4), "- ");
    expect(off.text.split("\n").slice(3, 5)).toEqual(["Left: a", "Centre: b"]);
  });

  it("works on the first line and on text without a final newline", () => {
    expect(linePrefix("one", 0, 0, "- ").text).toBe("- one");
    expect(linePrefix("\nsecond", 0, 0, "- ").text).toBe("- \nsecond");
  });

  it("a table goes in on its own lines after a blank line", () => {
    expect(insertTable(src, src.length, src.length).text).toBe(`${src}\n${TABLE}`);
    expect(insertTable("Para", 4, 4).text).toBe(`Para\n\n${TABLE}`);
    expect(insertTable("", 0, 0).text).toBe(TABLE);
    expect(insertTable("A\n\n", 3, 3).text).toBe(`A\n\n${TABLE}`);
  });

  it("Bold wraps the selection; with none the cursor sits between the marks", () => {
    expect(bold("a word", 2, 6)).toEqual({ text: "a **word**", start: 10, end: 10 });
    expect(bold("ab", 1, 1)).toEqual({ text: "a****b", start: 3, end: 3 });
  });

  it("Link uses the selection as its text and selects the url to type over", () => {
    const r = link("see docs", 4, 8);
    expect(r.text).toBe("see [docs](url)");
    expect(r.text.slice(r.start, r.end)).toBe("url");
    expect(link("", 0, 0).text).toBe("[link](url)");
  });

  it("an image link goes in at the cursor on its own line, or at the end of the file", () => {
    const line = imageLink("Pasted image", "images/pasted-120000.png");
    expect(line).toBe("![Pasted image](images/pasted-120000.png)");
    const text = "# A\n\n## 6 States\n";
    const pos = text.indexOf("## 6");
    const r = insertImageLink(text, pos, pos, line);
    expect(r.text.split("\n").slice(2, 4)).toEqual([line, "## 6 States"]);
    expect(insertImageLink("# A\nmid", 5, 5, line).text).toBe(`# A\nm\n\n${line}\nid`);
    expect(insertImageLink("# A\n\n\n", null, null, line).text).toBe(`# A\n\n${line}\n`);
    expect(imageLink("a [b]", "x.png")).toBe("![a b](x.png)");
  });

  it("a pasted picture is named by the time and counts on when the name is taken", () => {
    const now = new Date(2026, 10, 17, 9, 5, 7);
    expect(pastedName(new Set(), now)).toBe("pasted-090507.png");
    expect(pastedName(new Set(["pasted-090507.png", "pasted-090508.png"]), now)).toBe("pasted-090509.png");
  });
});
