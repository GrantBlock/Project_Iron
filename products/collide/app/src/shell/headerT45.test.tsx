// T45 acceptance (Run 4, Grant 2026-11-18 to 2026-11-19, scope items 6.2 to 6.6): the tab header's Copy, Save source
// and Save as; one callout toolbar for every tab type, without the save tools; Markdown's second row of text tools.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { Toolbar } from "../editor/Toolbar";
import { WsHead } from "./parts";

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

const head = (over: Partial<Parameters<typeof WsHead>[0]> = {}) => (
  <WsHead kind="snip" name="snip-1" path="Documents/Collide/Markups/snip-1" dirty={false} onClose={() => undefined} onMenu={() => undefined} {...over} />
);

describe("the tab header (6.3, 6.4)", () => {
  it("Save source, Save as and Copy to clipboard follow the Saved / Unsaved indicator", () => {
    const { container } = render(head({ onSave: () => undefined, canSave: true, onSaveSource: () => undefined, saveAs: { formats: ["png", "jpeg", "pdf"], onSave: () => undefined }, onCopy: () => undefined }));
    const all = [...container.querySelectorAll(".wshead > *")];
    const at = (el: Element) => all.findIndex((x) => x === el || x.contains(el));
    const state = container.querySelector(".savedstate")!;
    const source = screen.getByRole("button", { name: "Save source" });
    const as = screen.getByRole("button", { name: "Save as" });
    const copy = screen.getByRole("button", { name: "Copy to clipboard" });
    expect(at(source)).toBeGreaterThan(at(state));
    expect(at(as)).toBeGreaterThan(at(source));
    expect(at(copy)).toBeGreaterThan(at(state));
    expect(source.title).toMatch(/\.collide/);
  });

  it("Save source runs its handler; Copy runs its handler", () => {
    const onSaveSource = vi.fn();
    const onCopy = vi.fn();
    render(head({ onSaveSource, onCopy, saveAs: { formats: ["png"], onSave: () => undefined } }));
    fireEvent.click(screen.getByRole("button", { name: "Save source" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
    expect(onSaveSource).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("Save as opens a menu of the tab's formats; picking one saves it and closes the menu; Esc closes it", () => {
    const onSave = vi.fn();
    render(head({ kind: "markdown", saveAs: { formats: ["png", "jpeg", "pdf", "txt", "md"], onSave } }));
    const as = screen.getByRole("button", { name: "Save as" });
    expect(as.getAttribute("aria-haspopup")).toBe("menu");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(as);
    expect(as.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: "Save as" });
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["PNG", "JPEG", "PDF", "TXT", "MD"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "JPEG" }));
    expect(onSave).toHaveBeenCalledWith("jpeg");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(as);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("a header without them (Settings, a read-only file) has no Copy, Save source or Save as", () => {
    render(head({ kind: "settings" }));
    expect(screen.queryByRole("button", { name: "Save source" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save as" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy to clipboard" })).toBeNull();
  });
});

const bar = (label: string, second?: React.ReactNode, onAddBorder = () => undefined) => (
  <Toolbar
    label={label}
    tool="select"
    setTool={() => undefined}
    color={null}
    setColor={() => undefined}
    strokeWidth={3}
    setStrokeWidth={() => undefined}
    fileName="x"
    onUndo={() => undefined}
    onRedo={() => undefined}
    canUndo={false}
    canRedo={false}
    onAddBorder={onAddBorder}
    second={second}
  />
);
const names = (el: HTMLElement) => within(el).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);

describe("one callout toolbar for every tab type (6.4, 6.5, 6.6)", () => {
  it("has no save tools: no Export, Copy or Save as .collide", () => {
    render(bar("Markup tools"));
    const tb = screen.getByRole("toolbar", { name: "Markup tools" });
    for (const n of ["Export", "Copy to clipboard", "Copy PNG", "Save as .collide"]) expect(within(tb).queryByRole("button", { name: n })).toBeNull();
  });

  it("is the same set of buttons whatever the tab", () => {
    const sets = ["Markup tools", "PDF tools", "Markdown tools"].map((l) => {
      const { unmount } = render(bar(l));
      const out = names(screen.getByRole("toolbar", { name: l }));
      unmount();
      return out;
    });
    expect(sets[1]).toEqual(sets[0]);
    expect(sets[2]).toEqual(sets[0]);
    expect(sets[0]).toContain("Add border");
    expect(sets[0]).toContain("Rectangle");
  });

  it("Add border runs its handler", () => {
    const onAddBorder = vi.fn();
    render(bar("Markup tools", undefined, onAddBorder));
    fireEvent.click(screen.getByRole("button", { name: "Add border" }));
    expect(onAddBorder).toHaveBeenCalledTimes(1);
  });

  it("a second row (Markdown's text tools) comes below the callout tools, in the same toolbar", () => {
    render(bar("Markdown tools", <button type="button">Bold</button>));
    const tb = screen.getByRole("toolbar", { name: "Markdown tools" });
    const rows = tb.querySelectorAll(":scope > .tbrow");
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByRole("button", { name: "Rectangle" })).toBeTruthy();
    const second = within(tb).getByRole("group", { name: "Text tools" });
    expect(second).toBe(rows[1]);
    expect(within(second).getByRole("button", { name: "Bold" })).toBeTruthy();
  });
});

describe("Markdown tabs: a double-row toolbar (6.2)", () => {
  const openNewFile = () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole("complementary", { name: "Recents" })).getByRole("button", { name: "New file" }));
    return screen.getByRole("region", { name: "Workspace" });
  };

  it("Edit and Preview both show the callout tools on row 1 and the text tools on row 2", () => {
    const ws = openNewFile();
    for (const mode of ["Edit", "Preview"]) {
      fireEvent.click(within(ws).getByRole("button", { name: mode }));
      const tb = within(ws).getByRole("toolbar", { name: "Markdown tools" });
      expect(within(ws).getAllByRole("toolbar")).toHaveLength(1);
      const rows = tb.querySelectorAll(":scope > .tbrow");
      expect(rows).toHaveLength(2);
      expect(within(rows[0] as HTMLElement).getByRole("button", { name: "Rectangle" })).toBeTruthy();
      expect(within(rows[0] as HTMLElement).getByRole("button", { name: "Add border" })).toBeTruthy();
      const text = within(tb).getByRole("group", { name: "Text tools" });
      expect(text).toBe(rows[1]);
      expect(within(text).getByRole("combobox", { name: "Heading" })).toBeTruthy();
      expect(within(text).getByRole("button", { name: "Bold" })).toBeTruthy();
      expect(within(text).getByRole("button", { name: "Link" })).toBeTruthy();
    }
  });

  it("the header has Copy, Save source and Save as with TXT and MD", () => {
    const ws = openNewFile();
    expect(within(ws).getByRole("button", { name: "Copy to clipboard" })).toBeTruthy();
    expect(within(ws).getByRole("button", { name: "Save source" })).toBeTruthy();
    fireEvent.click(within(ws).getByRole("button", { name: "Save as" }));
    expect(within(screen.getByRole("menu", { name: "Save as" })).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["PNG", "JPEG", "PDF", "TXT", "MD"]);
  });

  it("a callout tool picked in Edit opens the Preview with that tool on", () => {
    const ws = openNewFile();
    fireEvent.click(within(ws).getByRole("button", { name: "Edit" }));
    expect(window.__collide!.state().mode).toBe("edit");
    fireEvent.click(within(ws).getByRole("button", { name: "Rectangle" }));
    expect(within(ws).getByRole("button", { name: "Preview" }).getAttribute("aria-pressed")).toBe("true");
    expect(window.__collide!.state().activeTool).toBe("rect");
  });

  it("Add border puts a numbered rectangle on the page's edge, in the pen's colour, as one undo step", () => {
    const ws = openNewFile();
    fireEvent.click(within(ws).getByRole("button", { name: "Add border" }));
    const items = window.__collide!.state().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "rect", number: 1, x: 0, y: 0, color: "red" });
    expect(items[0].w).toBeGreaterThan(100);
  });
});
