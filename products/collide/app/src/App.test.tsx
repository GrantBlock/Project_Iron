import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

const recents = () => screen.getByRole("complementary", { name: "Recents" });

describe("App", () => {
  it("renders the empty canvas", () => {
    render(<App />);
    expect(screen.getByTestId("canvas")).toBeTruthy();
    // T31: home is the blank canvas of the layout shell.
    expect(screen.getByText("Blank canvas")).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("exposes the reference test hook: window.__collide.state() (T30)", () => {
    render(<App />);
    const s = window.__collide!.state();
    expect(s).toMatchObject({ version: 1, view: "blank", tabs: [], editor: null, activeTool: null, items: [], selection: [], zoom: null, splash: null });
    expect(s.sidebar.delay).toBe("No delay");
    // A fresh object each call; changing it changes nothing in the app.
    s.items.push({} as never);
    expect(window.__collide!.state()).not.toBe(s);
    expect(window.__collide!.state().items).toEqual([]);
  });

  it("the hook follows the app's state: the New snip delay", () => {
    render(<App />);
    // T31: the delay is a toggle in the sidebar (was a drop-down in the toolbar).
    fireEvent.click(within(screen.getByTestId("snip-delay")).getByRole("radio", { name: "5s" }));
    expect(window.__collide!.state().sidebar.delay).toBe("5 s");
  });

  it("the sidebar runs New snip, Add snip, Open, Search; both choices are toggles and are remembered (T31)", () => {
    const first = render(<App />);
    const side = within(recents());
    expect(side.getAllByRole("button").slice(2, 5).map((b) => b.textContent)).toEqual(["New snip", "Add snip", "Open"]);
    expect(side.getByRole("textbox", { name: "Search" })).toBeTruthy();
    const where = within(side.getByRole("radiogroup", { name: "Where Add snip captures" }));
    expect(where.getByRole("radio", { name: "Current" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(where.getByRole("radio", { name: "Behind" }));
    fireEvent.click(within(side.getByRole("radiogroup", { name: "Delay before New snip captures" })).getByRole("radio", { name: "10s" }));
    expect(window.__collide!.state().sidebar).toEqual({ delay: "10 s", addMode: "Behind", collapsed: false });
    first.unmount();
    render(<App />);
    expect(window.__collide!.state().sidebar).toEqual({ delay: "10 s", addMode: "Behind", collapsed: false });
  });

  it("themes apply to the whole app: the choice goes on <html> and is remembered (T31)", () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const pop = within(screen.getByRole("dialog", { name: "Appearance" }));
    fireEvent.click(pop.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.appTheme).toBe("light");
    fireEvent.click(pop.getByRole("button", { name: "Aura" }));
    fireEvent.click(pop.getByRole("button", { name: "moss" }));
    expect(document.documentElement.dataset).toMatchObject({ appTheme: "aura", auraTheme: "moss" });
    expect(window.__collide!.state()).toMatchObject({ theme: "aura", aura: "moss" });
    first.unmount();
    render(<App />);
    expect(window.__collide!.state()).toMatchObject({ theme: "aura", aura: "moss" });
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Appearance" })).getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.appTheme).toBe("dark");
    expect(document.documentElement.dataset.auraTheme).toBeUndefined();
  });

  it("collapse moves Recents to the right and is remembered (T31)", () => {
    render(<App />);
    fireEvent.click(within(recents()).getByRole("button", { name: "Collapse window" }));
    expect(window.__collide!.state().sidebar.collapsed).toBe(true);
    expect(screen.getByTestId("app-root").className).toContain("compact");
    fireEvent.click(within(recents()).getByRole("button", { name: "Expand window" }));
    expect(window.__collide!.state().sidebar.collapsed).toBe(false);
  });

  it("Settings opens as a tab; a change marks it and closing asks first; Esc keeps it (T31)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings and Connect" }));
    expect(window.__collide!.state()).toMatchObject({ view: "settings", tabs: [{ title: "Settings", kind: "settings", dirty: false, active: true }] });
    for (const title of ["Storage", "This computer", "Open from other computers", "Access password"]) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    // Opening it again goes to the same tab.
    fireEvent.click(screen.getByRole("button", { name: "Settings and Connect" }));
    expect(screen.getAllByRole("tab")).toHaveLength(1);

    fireEvent.click(screen.getByRole("radio", { name: /Connected/ }));
    expect(window.__collide!.state().tabs[0].dirty).toBe(true);
    expect(within(screen.getByRole("tab")).getByLabelText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close Settings" }));
    const splash = screen.getByRole("alertdialog", { name: "Save changes to Settings?" });
    expect(window.__collide!.state().splash).toEqual({ kind: "close", title: "Settings" });
    expect(document.activeElement).toBe(within(splash).getByRole("button", { name: "Save and close" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(1);

    // Save and close keeps the choice; the last tab closed shows the blank canvas.
    fireEvent.click(screen.getByRole("button", { name: "Close Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and close" }));
    expect(window.__collide!.state()).toMatchObject({ view: "blank", tabs: [], splash: null });
    expect(JSON.parse(localStorage.getItem("collide.settings")!)).toMatchObject({ mode: "client" });
    expect(screen.getByText("Connected")).toBeTruthy();
  });

  it("the access password is never stored (T31)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings and Connect" }));
    fireEvent.change(screen.getByPlaceholderText("No password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("radio", { name: /Connected/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.stringify({ ...localStorage })).not.toContain("hunter2");
  });

  it("the sample Recents load only when the address asks for them: Today, Earlier, zips with their trees (T31)", () => {
    const plain = render(<App />);
    expect(within(recents()).queryByRole("button", { name: /^Line 3 conveyor guard/ })).toBeNull();
    expect(within(recents()).getByText(/No markups yet/)).toBeTruthy();
    plain.unmount();

    window.history.replaceState(null, "", "/?sample");
    render(<App />);
    const side = within(recents());
    expect(side.getByText("Today")).toBeTruthy();
    expect(side.getByText("Earlier")).toBeTruthy();
    expect(side.getByRole("button", { name: /^Line 3 conveyor guard/ }).textContent).toContain("4 callouts · 1280 × 720");
    // A zip's tree starts open as in the prototype; a file opens in its own tab, and again goes to the same tab.
    fireEvent.click(side.getByRole("button", { name: "P06-Project-Workspace-Spec.md" }));
    fireEvent.click(side.getByRole("button", { name: "README.md" }));
    fireEvent.click(side.getByRole("button", { name: "P06-Project-Workspace-Spec.md" }));
    expect(window.__collide!.state().tabs.map((t) => [t.title, t.kind, t.active])).toEqual([
      ["P06-Project-Workspace-Spec.md", "markdown", true],
      ["README.md", "markdown", false],
    ]);
    // Ctrl+Tab goes round; Ctrl+W closes the tab in front.
    fireEvent.keyDown(window, { key: "Tab", ctrlKey: true });
    expect(window.__collide!.state().tabs.map((t) => t.active)).toEqual([false, true]);
    fireEvent.keyDown(window, { key: "w", ctrlKey: true });
    expect(window.__collide!.state().tabs.map((t) => t.title)).toEqual(["P06-Project-Workspace-Spec.md"]);
    // A middle click closes too.
    fireEvent(screen.getByRole("tab"), new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(window.__collide!.state()).toMatchObject({ view: "blank", tabs: [] });

    // Search narrows Recents; a tag fills Search.
    fireEvent.change(side.getByRole("textbox", { name: "Search" }), { target: { value: "weld" } });
    expect(side.queryByRole("button", { name: /^HMI header grid/ })).toBeNull();
    expect(side.getByRole("button", { name: /^Line 3 conveyor guard/ })).toBeTruthy();
    fireEvent.click(side.getByRole("button", { name: "P&ID" }));
    expect(side.getByRole("button", { name: /^P&ID V-101 tag/ })).toBeTruthy();
    expect(side.queryByRole("button", { name: /^Line 3 conveyor guard/ })).toBeNull();
  });

  it("deleting a zip from Recents asks first; Esc keeps it; Delete closes its tabs and removes it (T31)", async () => {
    window.history.replaceState(null, "", "/?sample");
    render(<App />);
    const side = within(recents());
    fireEvent.click(side.getByRole("button", { name: "P06-Project-Workspace-Spec.md" }));
    fireEvent.click(side.getByRole("button", { name: "Delete builder-v0.1.zip" }));
    const splash = screen.getByRole("alertdialog", { name: "Delete builder-v0.1.zip?" });
    expect(splash.textContent).toContain("1 open tab closes without saving.");
    expect(window.__collide!.state().splash).toEqual({ kind: "delete", title: "builder-v0.1.zip" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(side.getByRole("button", { name: /^builder-v0\.1\.zip/ })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(1);

    // The Delete key on a row asks the same question.
    fireEvent.keyDown(side.getByRole("button", { name: /^builder-v0\.1\.zip/ }), { key: "Delete" });
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete builder-v0.1.zip?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(side.queryByRole("button", { name: /^builder-v0\.1\.zip/ })).toBeNull());
    expect(window.__collide!.state()).toMatchObject({ view: "blank", tabs: [], splash: null });
    expect(side.getByRole("button", { name: /^collide-run-2-notes\.zip/ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Deleted builder-v0.1.zip");
  });
});
