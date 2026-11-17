import { describe, expect, it } from "vitest";
import { splitMatches } from "./views";

describe("splitMatches (the page highlight, as the prototype's hl())", () => {
  it("no term: the text as one part", () => {
    expect(splitMatches("Oil volume", "")).toEqual([{ text: "Oil volume", match: false }]);
    expect(splitMatches("", "")).toEqual([]);
  });

  it("case-insensitive, every hit, keeps the page's own casing", () => {
    const parts = splitMatches("Mounting position. Oil volume depends on the mounting position; see", "mounting position");
    expect(parts).toEqual([
      { text: "Mounting position", match: true },
      { text: ". Oil volume depends on the ", match: false },
      { text: "mounting position", match: true },
      { text: "; see", match: false },
    ]);
  });

  it("a page without the term has no marks (ISSUES.md 4)", () => {
    expect(splitMatches("GB-220 gearbox. Ratio 20 to 1", "oil").some((p) => p.match)).toBe(false);
  });

  it("takes the term literally (regex characters are not special)", () => {
    expect(splitMatches("Ratio 20 to 1 (A).", "(a)")).toEqual([
      { text: "Ratio 20 to 1 ", match: false },
      { text: "(A)", match: true },
      { text: ".", match: false },
    ]);
    expect(splitMatches("a.b", ".").filter((p) => p.match)).toHaveLength(1);
  });

  it("parts joined give the text back", () => {
    const text = "Change the oil every 8,000 hours. Check the oil level.";
    expect(splitMatches(text, "OIL").map((p) => p.text).join("")).toBe(text);
  });
});
