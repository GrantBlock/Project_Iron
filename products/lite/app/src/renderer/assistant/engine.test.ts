import { describe, expect, it, vi } from "vitest";
import { ASSISTANT_TEXT, SUGGESTIONS } from "../data/sample";
import { snapshot } from "../hook";
import { addAnswer, askQuestion, initialState, select, viewInfo } from "../state";
import { cannedAnswerFor, citationPieces, createCannedEngine } from "./engine";

describe("canned answer engine (the prototype's matching)", () => {
  it("suggested questions, quirks included", () => {
    const oil = cannedAnswerFor(SUGGESTIONS[0]);
    expect(oil.sources.map((s) => [s.itemId, s.page, s.label])).toEqual([["d2", 3, "p. 4"], ["d3", 2, "p. 3"]]);
    // ISSUES.md 2: [1] appears twice, so three chips for two sources.
    expect(citationPieces(oil.text, oil.sources.length).filter((p) => "cite" in p)).toEqual([{ cite: 1 }, { cite: 1 }, { cite: 2 }]);
    // ISSUES.md 1: "servicing" does not match /service/.
    expect(cannedAnswerFor(SUGGESTIONS[1])).toEqual({ text: ASSISTANT_TEXT.fallback, sources: [] });
    expect(cannedAnswerFor(SUGGESTIONS[2]).sources).toEqual([{ itemId: "n1", page: 0, label: "note" }]);
  });

  it("first matching answer wins, keywords ignore case", () => {
    expect(cannedAnswerFor("LOTO steps?").sources).toEqual([{ itemId: "d3", page: 2, label: "p. 3" }]);
    expect(cannedAnswerFor("oil and torque").text).toContain("GB-220 gearbox oil"); // oil comes before torque
    expect(cannedAnswerFor("What is the torque and ratio?").sources.map((s) => s.page)).toEqual([0, 4]);
    expect(cannedAnswerFor("What colour is the building?").sources).toEqual([]);
  });

  it("answers after the prototype's 350 ms", async () => {
    vi.useFakeTimers();
    try {
      let got = "";
      void createCannedEngine().answer("bore?").then((a) => (got = a.text));
      await vi.advanceTimersByTimeAsync(349);
      expect(got).toBe("");
      await vi.advanceTimersByTimeAsync(1);
      expect(got).toContain("63 mm");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("citationPieces", () => {
  it("splits text and chips; unknown numbers stay text", () => {
    expect(citationPieces("A [1]. B [2]. C [3].", 2)).toEqual([{ text: "A " }, { cite: 1 }, { text: ". B " }, { cite: 2 }, { text: ". C [3]." }]);
    expect(citationPieces("No chips.", 0)).toEqual([{ text: "No chips." }]);
  });
});

describe("conversation state", () => {
  it("starts with the greeting and the suggestions", () => {
    const s = initialState();
    expect(s.messages).toEqual([{ role: "assistant", text: ASSISTANT_TEXT.greeting, sources: [] }]);
    expect(s.suggestionsShown).toBe(true);
  });

  it("asking adds the question and hides the suggestions; the answer follows", () => {
    let s = askQuestion(initialState(), SUGGESTIONS[0]);
    expect(s.suggestionsShown).toBe(false);
    s = addAnswer(s, cannedAnswerFor(SUGGESTIONS[0]));
    const m = snapshot(s, { narrow: false, highlights: 0 }).messages;
    expect(m.map((x) => [x.role, x.citations, x.sources])).toEqual([["assistant", 0, 0], ["user", 0, 0], ["assistant", 3, 2]]);
    expect(m[2].text).toBe(
      "Change the GB-220 gearbox oil every 8,000 operating hours or 12 months, whichever comes first, and check the level every 500 hours . Use ISO VG 220 synthetic gear oil . Lock out the machine first .",
    );
  });

  it("a citation opens the page and, under 900px, the View tab", () => {
    const s = select(initialState(), "d2", { page: 3, highlight: "", narrow: true });
    expect(viewInfo(s)).toEqual({ type: "document", page: 4, pageCount: 6 });
    expect(s.pane).toBe("view");
    // Opening the same page again still counts as an open (the view scrolls to the top).
    expect(select(s, "d2", { page: 3 }).opened).toBe(s.opened + 1);
  });
});
