import { describe, expect, it } from "vitest";
import { ANSWERS, PACKAGE, PROJECTS, SUGGESTIONS, allItems, cannedAnswer, contentsSummary, findItem, projectOf } from "./sample";

describe("sample package (as the prototype)", () => {
  it("has two projects with their items in tree order", () => {
    expect(PROJECTS.map((p) => [p.code, p.name, p.items.map((i) => i.id)])).toEqual([
      ["BC-Q-26041", "Palletizer retrofit", ["d1", "d2", "m1", "n1"]],
      ["ENG-RES", "Engineering resources", ["d3", "m2", "n2"]],
    ]);
    expect(allItems().map((i) => i.title)).toEqual([
      "Process document, rev 3",
      "GB-220 gearbox data sheet",
      "Palletizer frame v4",
      "Pneumatic cylinder sizing",
      "Lockout procedure LOTO-004",
      "Standard guard layout",
      "Handoff log template",
    ]);
  });

  it("ids are unique and each item's type matches its id", () => {
    const ids = allItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of allItems()) expect(i.id[0]).toBe({ document: "d", model: "m", note: "n" }[i.type]);
  });

  it("documents have the prototype's page counts; models their parts; notes their text", () => {
    const pages = (id: string) => {
      const i = findItem(id);
      return i?.type === "document" ? i.pages.length : -1;
    };
    expect([pages("d1"), pages("d2"), pages("d3")]).toEqual([3, 6, 3]);
    const m1 = findItem("m1");
    expect(m1?.type === "model" && m1.parts.map((p) => `${p.name}: ${p.bodies}`)).toEqual([
      "Frame: 1 body",
      "Transfer axis: 3 bodies",
      "Guard door: 2 bodies",
      "Gearbox GB-220: 1 body",
    ]);
    const n1 = findItem("n1");
    expect(n1?.type === "note" && n1.text).toContain("Open item: confirm the rod diameter with the vendor.");
  });

  it("About facts", () => {
    expect(PACKAGE.title).toBe("Site 7332 maintenance package");
    expect(PACKAGE.byline).toBe("[Client or site] · Rev A · built by Block Concepts");
    expect(contentsSummary()).toBe("3 documents, 2 models, 2 notes");
  });

  it("finds items and their folders", () => {
    expect(findItem("zz")).toBeUndefined();
    expect(projectOf("d3")?.name).toBe("Engineering resources");
    expect(projectOf("about")).toBeUndefined();
  });

  it("every canned citation points at an existing item and page; chips match sources", () => {
    for (const a of ANSWERS) {
      for (const s of a.sources) {
        const item = findItem(s.itemId);
        expect(item, s.itemId).toBeDefined();
        if (item?.type === "document") {
          expect(s.page).toBeLessThan(item.pages.length);
          expect(s.label).toBe(`p. ${s.page + 1}`);
        } else expect(s.label).toBe("note");
      }
      const chips = [...a.text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      expect(Math.max(...chips)).toBe(a.sources.length);
    }
  });

  it("canned answers match as the prototype, with ISSUES.md 1 fixed (Grant 2026-11-17)", () => {
    expect(cannedAnswer(SUGGESTIONS[0])?.sources).toHaveLength(2);
    expect(cannedAnswer(SUGGESTIONS[1])?.sources).toEqual([{ itemId: "d3", page: 2, label: "p. 3" }]);
    expect(cannedAnswer(SUGGESTIONS[2])?.text).toContain("63 mm");
    expect(cannedAnswer("What is the torque and ratio?")?.sources.map((s) => s.page)).toEqual([0, 4]);
    expect(cannedAnswer("What colour is the building?")).toBeUndefined();
  });
});
