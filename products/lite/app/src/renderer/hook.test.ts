import { describe, expect, it } from "vitest";
import { messageText, snapshot } from "./hook";
import { initialState, select, setPane, setQuery, toggleAssistant, toggleFolder } from "./state";

const wide = { narrow: false, highlights: 0 };

describe("window.__lite.state() snapshot (HOOK.md)", () => {
  it("has the HOOK.md shape at start", () => {
    expect(snapshot(initialState(), wide)).toEqual({
      selected: { id: "about", type: "about", title: "Site 7332 maintenance package", path: "About this package" },
      openFolders: ["Palletizer retrofit", "Engineering resources"],
      view: { type: "about", page: null, pageCount: null },
      search: { query: "", matchCount: 7, highlights: 0 },
      assistantShown: true,
      tab: null,
      messages: [
        {
          role: "assistant",
          text: "I answer from this package only, and everything runs on this computer. Ask about the documents, models or notes.",
          citations: 0,
          sources: 0,
        },
      ],
    });
  });

  it("follows the selection, folders, Assistant and tab", () => {
    let s = select(initialState(), "d3", { page: 2 });
    s = toggleFolder(s, "Palletizer retrofit");
    s = toggleAssistant(s);
    const snap = snapshot(s, { narrow: true, highlights: 2 });
    expect(snap.selected).toEqual({ id: "d3", type: "document", title: "Lockout procedure LOTO-004", path: "Engineering resources / Lockout procedure LOTO-004" });
    expect(snap.view).toEqual({ type: "document", page: 3, pageCount: 3 });
    expect(snap.openFolders).toEqual(["Engineering resources"]);
    expect(snap.assistantShown).toBe(false);
    expect(snap.search.highlights).toBe(2);
    expect(snap.tab).toBe("files");
    expect(snapshot(setPane(s, "chat"), { narrow: true, highlights: 0 }).tab).toBe("assistant");
    expect(snapshot(setPane(s, "chat"), wide).tab).toBeNull();
  });

  it("reports the query", () => {
    expect(snapshot(setQuery(initialState(), "oil"), wide).search.query).toBe("oil");
  });

  it("messages: text without chips, citations counted each time", () => {
    const s = {
      ...initialState(),
      messages: [
        { role: "user" as const, text: "Oil?", sources: [] },
        { role: "assistant" as const, text: "Every 500 hours [1]. Use oil [1]. Lock out [2].", sources: [{ itemId: "d2", page: 3, label: "p. 4" }, { itemId: "d3", page: 2, label: "p. 3" }] },
      ],
    };
    expect(snapshot(s, wide).messages).toEqual([
      { role: "user", text: "Oil?", citations: 0, sources: 0 },
      { role: "assistant", text: "Every 500 hours . Use oil . Lock out .", citations: 3, sources: 2 },
    ]);
    expect(messageText("  a [1]\n b ")).toBe("a b");
  });
});
